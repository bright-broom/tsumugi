/**
 * 営業リスト（leadfinder、Issue #24、ADR 0039）。
 * 自動収集・自動送信はしない。オーナーが用意した CSV を取り込み、正規化・重複の統合・評価・絞り込み・CRM 向けの CSV 出力をする。
 * 入力元・収集方法・利用条件はオーナーが決める。ツールは取り込みごとに入力元と保存期限を必須にし、期限を過ぎた値を出力しない。
 */
import { z } from 'zod';
import { sha256 } from '../shared/cli';
import { readCsvRecords, toCsv } from '../shared/csv';
import { type CanonicalUrl, canonicalUrl, nfkc, normalizePhone } from '../shared/normalize';
import { OpsError, idSchema } from '../shared/store';
import { addDays, dateSchema } from '../shared/time';

/** ガイドライン 4.1「食べログ・Instagram・ホットペッパー・LINE のみ＝ポータル依存」。 */
const PORTAL_HOSTS = ['tabelog.com', 'instagram.com', 'hotpepper.jp', 'line.me', 'lin.ee'];

const text = z.string().trim().min(1);
const STATES = ['unreviewed', 'needs_review', 'reviewed', 'excluded'] as const;
type ReviewState = (typeof STATES)[number];
export const STATE_LABELS: Record<ReviewState, string> = {
  unreviewed: '未確認',
  needs_review: '要確認',
  reviewed: '確認済み',
  excluded: '対象外',
};

const observationSchema = z.strictObject({
  source: z.strictObject({
    label: text,
    collectedOn: dateSchema,
    /** null は期限なし（オーナーが明示した場合だけ）。 */
    expiresOn: dateSchema.nullable(),
    line: z.int().min(2),
  }),
  /** 保存期限を過ぎて、place_id 以外を破棄した記録。 */
  purged: z.boolean(),
  placeId: text.optional(),
  name: text.optional(),
  phone: text.optional(),
  website: text.optional(),
  industry: text.optional(),
  area: text.optional(),
  rating: z.number().min(0).max(5).optional(),
  reviewCount: z.int().min(0).optional(),
});
type Observation = z.infer<typeof observationSchema>;

const leadSchema = z.strictObject({
  id: idSchema,
  observations: z.array(observationSchema).min(1),
  review: z.strictObject({
    state: z.enum(STATES),
    by: text.optional(),
    on: dateSchema.optional(),
    /** 自分で確認・ヒアリングした内容。保存期限の破棄の対象外。 */
    note: text.optional(),
  }),
});
type Lead = z.infer<typeof leadSchema>;

export const ledgerSchema = z.strictObject({
  imports: z.array(z.strictObject({ sha256: z.string(), label: text, collectedOn: dateSchema })),
  leads: z.array(leadSchema),
});
export type Ledger = z.infer<typeof ledgerSchema>;

const nameKey = (name: string) =>
  nfkc(name)
    .replace(/株式会社|有限会社|合同会社|\(株\)|\(有\)|\(同\)/g, '')
    .replace(/\s/g, '')
    .toLowerCase();

function keysOf(o: Observation): string[] {
  const keys: string[] = [];
  if (o.placeId) keys.push(`place:${o.placeId}`);
  if (o.purged) return keys;
  const phone = normalizePhone(o.phone);
  if (phone?.valid) keys.push(`tel:${phone.digits}`);
  const url = canonicalUrl(o.website);
  // ポータルのトップだけ（パスなし）は店を特定できないので、重複の判定に使わない。
  if (url && url !== 'invalid' && url.key !== url.host) keys.push(`url:${url.key}`);
  else if (url && url !== 'invalid' && !isPortal(url)) keys.push(`url:${url.key}`);
  return keys;
}
const isPortal = (url: CanonicalUrl) =>
  PORTAL_HOSTS.some((h) => url.host === h || url.host.endsWith(`.${h}`));

export function importLeads(
  ledger: Ledger,
  csv: string,
  source: { label: string; collectedOn: string; retentionDays: number | null },
): { ledger: Ledger; added: number; updated: number; merged: number } {
  const hash = sha256(csv);
  const same = ledger.imports.find((i) => i.sha256 === hash);
  if (same)
    throw new OpsError(
      `同じ内容のファイルは取り込み済みです（${same.label}、${same.collectedOn}）`,
    );
  if (
    source.retentionDays !== null &&
    (!Number.isInteger(source.retentionDays) || source.retentionDays < 1)
  )
    throw new OpsError('保存期限の日数は 1 以上の整数');
  const expiresOn =
    source.retentionDays === null ? null : addDays(source.collectedOn, source.retentionDays);

  const leads: Lead[] = ledger.leads.map((l) => ({ ...l, observations: [...l.observations] }));
  let added = 0;
  let updated = 0;
  let merged = 0;
  for (const { line, values } of readCsvRecords(csv, ['name'])) {
    const number = (name: string, integer: boolean) => {
      const raw = values[name];
      if (!raw) return undefined;
      const value = Number(nfkc(raw));
      if (!Number.isFinite(value) || (integer && !Number.isInteger(value)))
        throw new OpsError(`${line} 行目: ${name} を数値として読めません`);
      return value;
    };
    const optional = (name: string) => (values[name] ? nfkc(values[name]!) : undefined);
    const name = optional('name');
    if (!name) throw new OpsError(`${line} 行目: name が空です`);
    const candidate = {
      source: { label: source.label, collectedOn: source.collectedOn, expiresOn, line },
      purged: false,
      name,
      placeId: optional('place_id'),
      phone: optional('phone'),
      website: optional('website'),
      industry: optional('industry'),
      area: optional('area'),
      rating: number('rating', false),
      reviewCount: number('review_count', true),
    };
    const parsed = observationSchema.safeParse(
      Object.fromEntries(Object.entries(candidate).filter(([, v]) => v !== undefined)),
    );
    if (!parsed.success) throw new OpsError(`${line} 行目: ${parsed.error.issues[0]?.message}`);
    const observation = parsed.data;

    const keys = new Set(keysOf(observation));
    const matches = leads.filter((l) =>
      l.observations.some((o) => keysOf(o).some((k) => keys.has(k))),
    );
    if (!matches.length) {
      const seed =
        [...keys][0] ??
        `${nameKey(name)}|${observation.area ?? ''}|${source.label}|${source.collectedOn}|${line}`;
      leads.push({
        id: `lead-${sha256(seed).slice(0, 12)}`,
        observations: [observation],
        review: { state: 'unreviewed' },
      });
      added++;
      continue;
    }
    const [target, ...rest] = matches;
    const combined: Lead = {
      ...target!,
      observations: [...target!.observations, ...rest.flatMap((l) => l.observations), observation],
      // 確認済みでも、新しい情報が加わったら確かめ直す。対象外は対象外のまま。
      review:
        target!.review.state === 'excluded' || rest.some((l) => l.review.state === 'excluded')
          ? { ...target!.review, state: 'excluded' }
          : {
              ...target!.review,
              state:
                target!.review.state === 'unreviewed' && !rest.length
                  ? 'unreviewed'
                  : 'needs_review',
            },
    };
    if (rest.length) merged += rest.length;
    else updated++;
    const removed = new Set(rest.map((l) => l.id));
    leads.splice(
      0,
      leads.length,
      ...leads.filter((l) => !removed.has(l.id)).map((l) => (l.id === target!.id ? combined : l)),
    );
  }
  return {
    ledger: {
      imports: [
        ...ledger.imports,
        { sha256: hash, label: source.label, collectedOn: source.collectedOn },
      ],
      leads,
    },
    added,
    updated,
    merged,
  };
}

type SiteStatus = 'none' | 'portal_only' | 'own_site' | 'unreadable';
const SITE_LABELS: Record<SiteStatus, string> = {
  none: 'サイトなし',
  portal_only: 'ポータル依存',
  own_site: '自社サイトあり',
  unreadable: 'URL を読めない',
};

export interface LeadView {
  id: string;
  name: string;
  phone: string;
  website: string;
  siteStatus: SiteStatus;
  industry: string;
  area: string;
  score: number;
  scoreParts: { label: string; points: number; max: number; basis: string }[];
  state: ReviewState;
  reasons: string[];
  sources: string[];
  expiresOn: string | null;
  expired: boolean;
  nameAreaKey: string;
  placeId: string;
  /** false：保存期限を過ぎて破棄済み（place_id と確認メモだけ）。 */
  live: boolean;
}

/** 表示用の見方。保存しているのは情報源ごとの観測だけで、統合値・評価は毎回計算する。 */
function viewLead(lead: Lead, options: { today: string; reviewCap: number }): LeadView {
  const live = lead.observations
    .filter((o) => !o.purged)
    .sort((a, b) => b.source.collectedOn.localeCompare(a.source.collectedOn));
  const pick = <K extends keyof Observation>(key: K) =>
    live.find((o) => o[key] !== undefined)?.[key];
  const reasons: string[] = [];
  const distinct = (values: (string | undefined)[]) =>
    new Set(values.filter((v): v is string => !!v)).size;

  const name = pick('name') ?? '（保存期限を過ぎて破棄済み）';
  if (!live.length)
    reasons.push('保存期限を過ぎて破棄済み（place_id と確認メモだけが残っています）');
  if (distinct(live.map((o) => o.name && nameKey(o.name))) > 1)
    reasons.push('店名が情報源で異なる');
  const phones = live.map((o) => normalizePhone(o.phone));
  if (distinct(phones.map((p) => p?.digits)) > 1) reasons.push('電話番号が情報源で異なる');
  const phone = normalizePhone(pick('phone'));
  if (phone && !phone.valid) reasons.push('電話番号の形式を確認');
  const urls = live.map((o) => canonicalUrl(o.website));
  if (distinct(urls.map((u) => (u && u !== 'invalid' ? u.key : undefined))) > 1)
    reasons.push('サイトが情報源で異なる');
  const url = canonicalUrl(pick('website'));
  const siteStatus: SiteStatus = !url
    ? 'none'
    : url === 'invalid'
      ? 'unreadable'
      : isPortal(url)
        ? 'portal_only'
        : 'own_site';
  if (siteStatus === 'unreadable') reasons.push('URL を読めない');
  const reviewCount = pick('reviewCount');
  const rating = pick('rating');
  if (live.length && (reviewCount === undefined || rating === undefined))
    reasons.push('口コミ数・評価が未取得');

  const cap = options.reviewCap;
  const scoreParts = [
    {
      label: '口コミ数',
      max: 45,
      points: reviewCount === undefined ? 0 : Math.round((45 * Math.min(reviewCount, cap)) / cap),
      basis:
        reviewCount === undefined
          ? '未取得のため 0 点'
          : `${reviewCount} 件（${cap} 件以上を満点とする仮置き）`,
    },
    {
      label: '評価',
      max: 20,
      points: rating === undefined ? 0 : Math.round((20 * Math.max(0, rating - 1)) / 4),
      basis:
        rating === undefined
          ? '未取得のため 0 点'
          : `評価 ${rating}（1〜5 を 0〜20 点に比例させる仮置き）`,
    },
    {
      label: '電話番号',
      max: 20,
      points: phone?.valid ? 20 : 0,
      basis: phone?.valid ? '電話番号あり' : '電話番号なし・形式を確認',
    },
    {
      label: 'サイト状態',
      max: 15,
      points: siteStatus === 'none' || siteStatus === 'portal_only' ? 15 : 0,
      basis: `${SITE_LABELS[siteStatus]}（サイトなし・ポータル依存を対象にする）`,
    },
  ];
  const expiries = lead.observations
    .filter((o) => !o.purged)
    .map((o) => o.source.expiresOn)
    .filter((d): d is string => d !== null)
    .sort();
  const expiresOn = expiries[0] ?? null;
  const stored = lead.review.state;
  return {
    id: lead.id,
    name,
    phone: phone?.digits ?? '',
    website: url && url !== 'invalid' ? url.href : (pick('website') ?? ''),
    siteStatus,
    industry: pick('industry') ?? '',
    area: pick('area') ?? '',
    score: scoreParts.reduce((a, p) => a + p.points, 0),
    scoreParts,
    state: stored === 'unreviewed' && reasons.length ? 'needs_review' : stored,
    reasons,
    sources: [
      ...new Set(lead.observations.map((o) => `${o.source.label}（${o.source.collectedOn}）`)),
    ],
    expiresOn,
    expired: expiresOn !== null && expiresOn < options.today,
    nameAreaKey: live.length ? `${nameKey(name)}|${nfkc(pick('area') ?? '')}` : '',
    placeId: lead.observations.find((o) => o.placeId)?.placeId ?? '',
    live: live.length > 0,
  };
}

export function viewLedger(
  ledger: Ledger,
  options: { today: string; reviewCap: number },
): LeadView[] {
  const views = ledger.leads.map((l) => viewLead(l, options));
  // 店名と地域だけが同じ候補は統合しない（支店などを取り違えるため）。要確認として示す。
  const counts = new Map<string, number>();
  for (const v of views)
    if (v.nameAreaKey) counts.set(v.nameAreaKey, (counts.get(v.nameAreaKey) ?? 0) + 1);
  return views
    .map((v) =>
      (counts.get(v.nameAreaKey) ?? 0) > 1
        ? {
            ...v,
            reasons: [...v.reasons, '同じ店名・地域の候補が別にある'],
            state:
              v.state === 'unreviewed' || v.state === 'reviewed'
                ? ('needs_review' as const)
                : v.state,
          }
        : v,
    )
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

export function filterLeads(
  views: readonly LeadView[],
  filter: {
    industry?: string;
    area?: string;
    minScore?: number;
    state?: string;
    siteStatus?: string;
  },
): LeadView[] {
  const has = (value: string, query?: string) => !query || nfkc(value).includes(nfkc(query));
  return views.filter(
    (v) =>
      has(v.industry, filter.industry) &&
      has(v.area, filter.area) &&
      v.score >= (filter.minScore ?? 0) &&
      (!filter.state || v.state === filter.state) &&
      (!filter.siteStatus || v.siteStatus === filter.siteStatus),
  );
}

export function reviewLead(
  ledger: Ledger,
  id: string,
  review: { state: string; by: string; on: string; note?: string },
): Ledger {
  const state = z.enum(STATES).safeParse(review.state);
  if (!state.success || state.data === 'unreviewed')
    throw new OpsError('状態は needs_review・reviewed・excluded のどれか');
  if (!ledger.leads.some((l) => l.id === id)) throw new OpsError(`見込み客がありません: ${id}`);
  return ledgerSchema.parse({
    ...ledger,
    leads: ledger.leads.map((l) =>
      l.id === id
        ? {
            ...l,
            review: {
              state: state.data,
              by: review.by,
              on: review.on,
              ...(review.note
                ? { note: review.note }
                : l.review.note
                  ? { note: l.review.note }
                  : {}),
            },
          }
        : l,
    ),
  });
}

/** 保存期限を過ぎた観測から、place_id 以外の値を捨てる。確認メモ（自分で聞いた内容）は残す。 */
export function purgeExpired(ledger: Ledger, today: string): { ledger: Ledger; purged: number } {
  let purged = 0;
  const leads = ledger.leads.map((l) => ({
    ...l,
    observations: l.observations.map((o) => {
      if (o.purged || o.source.expiresOn === null || o.source.expiresOn >= today) return o;
      purged++;
      return { source: o.source, purged: true, ...(o.placeId ? { placeId: o.placeId } : {}) };
    }),
  }));
  return { ledger: ledgerSchema.parse({ ...ledger, leads }), purged };
}

/** CRM へ渡す CSV。確認済み（指定すれば要確認も）だけ。期限切れの値が残っていれば出さない。 */
export function exportForCrm(
  views: readonly LeadView[],
  options: { includeNeedsReview: boolean },
): string {
  const expired = views.filter((v) => v.expired);
  if (expired.length)
    throw new OpsError(
      `保存期限を過ぎた情報が ${expired.length} 件残っています。先に purge してください`,
    );
  // 破棄済みの見込み客は渡さない。商談に入る先は、期限内に確認して CRM へ移す。
  const rows = views.filter(
    (v) =>
      v.live &&
      (v.state === 'reviewed' || (options.includeNeedsReview && v.state === 'needs_review')),
  );
  return toCsv([
    [
      'lead_id',
      'place_id',
      'name',
      'phone',
      'website',
      'site_status',
      'industry',
      'area',
      'score',
      'score_basis',
      'review_state',
      'review_reasons',
      'sources',
      'expires_on',
    ],
    ...rows.map((v) => [
      v.id,
      v.placeId,
      v.name,
      v.phone,
      v.website,
      SITE_LABELS[v.siteStatus],
      v.industry,
      v.area,
      v.score,
      v.scoreParts.map((p) => `${p.label} ${p.points}/${p.max}：${p.basis}`).join('／'),
      STATE_LABELS[v.state],
      v.reasons.join('／'),
      v.sources.join('／'),
      v.expiresOn ?? '',
    ]),
  ]);
}
