/**
 * microCMS から記事・事例を取り込む（ADR 0080、監査 C01）。
 *
 * - 取得するのは公開済みのコンテンツだけ（API キーでは下書きは返らない）。
 * - 本文は HTML を受け取らず、繰り返しフィールドのカスタムフィールド（段落・見出し・リスト・画像）で受け取る。
 *   公開サイトは型付きのブロックとして React で描画し、外部の HTML を信頼しない（監査 D11）。
 * - 画像は images.microcms-assets.io のものだけを受け付け、ビルド時に自サイトへ取り込む（images.ts）。
 * - 形式の違う項目は推測で補わず、どのコンテンツのどの項目かを示して止める。
 */
import { z } from 'zod';

type Fetch = typeof globalThis.fetch;

export const CMS_ENDPOINTS = { articles: 'articles', cases: 'cases' } as const;

export class CmsError extends Error {}

// ── microCMS の応答 ─────────────────────────────────────

const text = z.string();
const optionalText = z.string().nullish();
const cmsImage = z.object({
  url: z
    .string()
    .regex(
      /^https:\/\/images\.microcms-assets\.io\/[^?#\s]+$/,
      'microCMS の画像 URL ではありません',
    ),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
type CmsImage = z.infer<typeof cmsImage>;

/** 本文の繰り返しフィールド。fieldId は microCMS のカスタムフィールド ID。 */
const bodyField = z.discriminatedUnion('fieldId', [
  z.object({ fieldId: z.literal('paragraph'), text }),
  z.object({ fieldId: z.literal('heading'), text }),
  z.object({ fieldId: z.literal('list'), items: text }),
  z.object({
    fieldId: z.literal('image'),
    image: cmsImage,
    alt: text,
    caption: optionalText,
  }),
]);

const common = {
  id: text,
  slug: text,
  title: text,
  /** 掲載日（日時フィールド）。なければ microCMS の公開日時 */
  date: optionalText,
  publishedAt: text,
  revisedAt: optionalText,
  seoTitle: optionalText,
  seoDescription: optionalText,
  image: cmsImage.nullish(),
  imageAlt: optionalText,
  order: z.number().int().nullish(),
  body: z.array(bodyField).nullish(),
};

const articleContent = z.object({
  ...common,
  kind: z.array(z.enum(['news', 'column'])).length(1, '種類（kind）を1つ選んでください'),
});

const caseContent = z.object({
  ...common,
  industry: text,
  categories: z.array(text),
  area: z.array(text).max(1).nullish(),
  summary: text,
  fields: z.array(z.object({ fieldId: z.literal('field'), key: text, value: text })).nullish(),
  gallery: z.array(z.object({ fieldId: z.literal('photo'), image: cmsImage, alt: text })).nullish(),
});

const listResponse = z.object({
  contents: z.array(z.unknown()),
  totalCount: z.number().int().min(0),
  offset: z.number().int().min(0),
  limit: z.number().int().min(1),
});

// ── 取得 ─────────────────────────────────────────

export interface CmsClientOptions {
  serviceDomain: string;
  apiKey: string;
  fetch?: Fetch;
  /** 429・5xx の再試行の間隔（テストでは 0） */
  retryDelayMs?: number;
}

const PAGE = 100;
const MAX_CONTENTS = 10_000;

export function createCmsClient(options: CmsClientOptions) {
  if (!/^[a-z0-9-]{1,63}$/.test(options.serviceDomain))
    throw new CmsError('MICROCMS_SERVICE_DOMAIN はサービス ID（英小文字・数字・ハイフン）です');
  if (!options.apiKey.trim()) throw new CmsError('MICROCMS_API_KEY がありません');
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const delay = options.retryDelayMs ?? 2000;

  async function get(url: string): Promise<unknown> {
    for (let attempt = 1; ; attempt++) {
      let response: Response;
      try {
        response = await fetchImpl(url, {
          headers: { 'X-MICROCMS-API-KEY': options.apiKey },
          signal: AbortSignal.timeout(20_000),
        });
      } catch (error) {
        if (attempt >= 3)
          throw new CmsError(`microCMS に接続できません: ${(error as Error).message}`);
        await new Promise((r) => setTimeout(r, delay * attempt));
        continue;
      }
      if (response.ok) return response.json();
      await response.body?.cancel();
      if ((response.status === 429 || response.status >= 500) && attempt < 3) {
        await new Promise((r) => setTimeout(r, delay * attempt));
        continue;
      }
      throw new CmsError(
        `microCMS の取得に失敗しました: HTTP ${response.status}（${new URL(url).pathname}）`,
      );
    }
  }

  /** 1 つの API の公開済みコンテンツをすべて取得する。 */
  async function listAll(endpoint: string): Promise<unknown[]> {
    const all: unknown[] = [];
    for (let offset = 0; ; offset += PAGE) {
      const url = `https://${options.serviceDomain}.microcms.io/api/v1/${endpoint}?limit=${PAGE}&offset=${offset}&depth=0`;
      const page = listResponse.safeParse(await get(url));
      if (!page.success) throw new CmsError(`${endpoint}: 一覧の形式が違います`);
      all.push(...page.data.contents);
      if (all.length >= page.data.totalCount || !page.data.contents.length) break;
      if (all.length > MAX_CONTENTS)
        throw new CmsError(`${endpoint}: ${MAX_CONTENTS} 件を超えています`);
    }
    return all;
  }

  return { listAll };
}

// ── サイトの記事・事例へ変換 ──────────────────────────────────

const JST = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' });
const day = (iso: string) => JST.format(new Date(iso));

interface ImageRequest extends CmsImage {
  alt: string;
}
/** 画像の取り込み先を決める関数。images.ts が実物を保存し、サイト内のパスと寸法を返す。 */
export type ImageResolver = (image: ImageRequest) => {
  src: string;
  alt: string;
  width: number;
  height: number;
};

function describe(collection: string, raw: unknown, error: z.ZodError): CmsError {
  const id = (raw as { id?: unknown })?.id;
  const where = typeof id === 'string' ? `${collection}/${id}` : collection;
  return new CmsError(
    `${where}: ${error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ')}`,
  );
}

function blocks(body: z.infer<typeof bodyField>[] | null | undefined, image: ImageResolver) {
  return (body ?? []).map((field) => {
    switch (field.fieldId) {
      case 'paragraph':
        return { type: 'paragraph' as const, text: field.text };
      case 'heading':
        return { type: 'heading' as const, text: field.text };
      case 'list':
        return {
          type: 'list' as const,
          items: field.items
            .split(/\r?\n/)
            .map((item) => item.trim())
            .filter(Boolean),
        };
      case 'image':
        return {
          type: 'image' as const,
          image: image({ ...field.image, alt: field.alt }),
          ...(field.caption ? { caption: field.caption } : {}),
        };
    }
  });
}

function base(content: z.infer<z.ZodObject<typeof common>>, image: ImageResolver) {
  return {
    slug: content.slug,
    status: 'published' as const,
    title: content.title,
    publishedAt: day(content.date ?? content.publishedAt),
    ...(content.revisedAt ? { updatedAt: day(content.revisedAt) } : {}),
    ...(content.order != null ? { order: content.order } : {}),
    ...(content.image ? { image: image({ ...content.image, alt: content.imageAlt ?? '' }) } : {}),
    seo: { title: content.seoTitle ?? content.title, description: content.seoDescription ?? '' },
  };
}

export function mapArticles(raw: readonly unknown[], image: ImageResolver) {
  return raw.map((item) => {
    const parsed = articleContent.safeParse(item);
    if (!parsed.success) throw describe('articles', item, parsed.error);
    const c = parsed.data;
    return { ...base(c, image), kind: c.kind[0]!, body: blocks(c.body, image) };
  });
}

export function mapCases(raw: readonly unknown[], image: ImageResolver) {
  return raw.map((item) => {
    const parsed = caseContent.safeParse(item);
    if (!parsed.success) throw describe('cases', item, parsed.error);
    const c = parsed.data;
    const fields: Record<string, string> = {};
    for (const f of c.fields ?? []) {
      if (Object.hasOwn(fields, f.key))
        throw new CmsError(`cases/${c.id}: 詳細項目「${f.key}」が重複しています`);
      fields[f.key] = f.value;
    }
    return {
      ...base(c, image),
      industry: c.industry,
      categories: c.categories,
      ...(c.area?.[0] ? { area: c.area[0] } : {}),
      summary: c.summary,
      fields,
      gallery: (c.gallery ?? []).map((photo) => image({ ...photo.image, alt: photo.alt })),
      body: blocks(c.body, image),
    };
  });
}
