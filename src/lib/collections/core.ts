/**
 * Collections: typed, build-time documents (articles, case studies, service areas, client work).
 *
 * The engine is framework-free and site-independent. A site supplies raw entries (usually from its
 * locale catalog), the schemas here validate them, and only `published` entries that pass the
 * pre-publication checks become routes. Drafts may be incomplete; published entries may not.
 * Problem messages are developer-facing and stay in English so that they never leak into pages.
 */
import { z } from 'zod';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const slugSchema = z.string().regex(SLUG, 'Use lowercase letters, digits and single hyphens');

const calendarDay = (value: string) => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
};
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine(calendarDay, 'Not a calendar date');

/** Images live in public/images/. Dimensions are required so pages never shift while loading. */
export const imageSchema = z.object({
  src: z.string().regex(/^\/images\/[a-z0-9][a-z0-9/_.-]*\.(?:avif|webp|jpe?g|png|svg)$/),
  alt: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
export type CollectionImage = z.infer<typeof imageSchema>;

/** Share images must be existing files under public/og/; otherwise the site's shared card is used. */
const seoSchema = z.object({
  title: z.string(),
  description: z.string(),
  ogImage: z
    .string()
    .regex(/^\/og\/[a-z0-9][a-z0-9/_-]*\.png$/)
    .optional(),
});

/** Body content is structured data rendered by React, never trusted HTML. */
export const blockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('heading'), text: z.string() }),
  z.object({ type: z.literal('paragraph'), text: z.string() }),
  z.object({ type: z.literal('list'), items: z.array(z.string()) }),
  z.object({ type: z.literal('image'), image: imageSchema, caption: z.string().optional() }),
]);
export type Block = z.infer<typeof blockSchema>;

export const entryShape = {
  slug: slugSchema,
  status: z.enum(['draft', 'published']),
  title: z.string(),
  publishedAt: dateSchema.optional(),
  updatedAt: dateSchema.optional(),
  /** Lower numbers first; entries without an order follow, newest first. */
  order: z.number().int().optional(),
  image: imageSchema.optional(),
  seo: seoSchema,
};
export type BaseEntry = z.infer<z.ZodObject<typeof entryShape>>;

/** Limits mirror the delivery checks (title ≤ 70 with the site suffix, description 40–160). */
const TITLE_MAX = 50;
const DESCRIPTION_MIN = 40;
const DESCRIPTION_MAX = 160;
/** Intake slots ship with this slug prefix and must be renamed before publishing. */
const INTAKE_SLUG_PREFIX = 'draft-';

export const chars = (text: string) => [...text].length;

/** Calendar parts for the catalog's date pattern; months and days are not zero-padded. */
export function dateParts(date: string): { year: string; month: string; day: string } {
  const [year = '', month = '', day = ''] = date.split('-');
  return { year, month: String(Number(month)), day: String(Number(day)) };
}

export interface CollectionProblem {
  collection: string;
  slug: string;
  reason: string;
}

export class CollectionError extends Error {
  constructor(readonly problems: readonly CollectionProblem[]) {
    super(
      `Collection entries are not publishable:\n${problems
        .map((p) => `  ${p.collection}/${p.slug}: ${p.reason}`)
        .join('\n')}`,
    );
  }
}

/** Parse raw data with a schema, reporting the collection name and every issue path. */
export function parseCollection<S extends z.ZodType>(collection: string, schema: S, raw: unknown) {
  const result = schema.safeParse(raw);
  if (!result.success)
    throw new Error(`Invalid ${collection} data:\n${z.prettifyError(result.error)}`);
  return result.data as z.infer<S>;
}

export function isPublished<T extends { status: string }>(entry: T): boolean {
  return entry.status === 'published';
}

export function sortEntries<T extends BaseEntry>(entries: readonly T[]): T[] {
  return [...entries].sort(
    (a, b) =>
      (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) ||
      (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '') ||
      a.slug.localeCompare(b.slug),
  );
}

export function blockText(blocks: readonly Block[]): string {
  return blocks
    .map((block) =>
      block.type === 'list'
        ? block.items.join('\n')
        : block.type === 'image'
          ? (block.caption ?? '')
          : block.text,
    )
    .join('\n')
    .trim();
}

/** Pre-publication checks shared by every collection. */
export function entryReadiness(entry: BaseEntry): string[] {
  const problems: string[] = [];
  const title = entry.seo.title || entry.title;
  if (!entry.title.trim()) problems.push('title is empty');
  if (chars(title) > TITLE_MAX) problems.push(`page title exceeds ${TITLE_MAX} characters`);
  const description = chars(entry.seo.description);
  if (description < DESCRIPTION_MIN || description > DESCRIPTION_MAX)
    problems.push(
      `seo.description must be ${DESCRIPTION_MIN}-${DESCRIPTION_MAX} characters (now ${description})`,
    );
  if (!entry.publishedAt) problems.push('publishedAt is required');
  if (entry.publishedAt && entry.updatedAt && entry.updatedAt < entry.publishedAt)
    problems.push('updatedAt is earlier than publishedAt');
  if (entry.slug.startsWith(INTAKE_SLUG_PREFIX)) problems.push('slug is still an intake placeholder');
  if (entry.image && !entry.image.alt.trim()) problems.push('image.alt is empty');
  return problems;
}

export function bodyReadiness(blocks: readonly Block[]): string[] {
  const problems: string[] = [];
  if (!blocks.some((block) => block.type === 'paragraph' && block.text.trim()))
    problems.push('body needs at least one paragraph');
  blocks.forEach((block, index) => {
    if (block.type === 'image' && !block.image.alt.trim())
      problems.push(`body[${index}] image alt is empty`);
    if ((block.type === 'heading' || block.type === 'paragraph') && !block.text.trim())
      problems.push(`body[${index}] ${block.type} is empty`);
    if (block.type === 'list' && !block.items.some((item) => item.trim()))
      problems.push(`body[${index}] list is empty`);
  });
  return problems;
}

export function duplicateSlugs(entries: readonly { slug: string }[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const { slug } of entries) (seen.has(slug) ? duplicates : seen).add(slug);
  return [...duplicates];
}

/** Character trigram Jaccard similarity in [0, 1]; used to refuse boilerplate pages. */
export function similarity(a: string, b: string): number {
  const grams = (text: string) => {
    const letters = [...text.replace(/\s+/g, '')];
    const set = new Set<string>();
    for (let i = 0; i + 3 <= letters.length; i += 1) set.add(letters.slice(i, i + 3).join(''));
    return set;
  };
  const left = grams(a);
  const right = grams(b);
  if (!left.size && !right.size) return 1;
  let shared = 0;
  for (const gram of left) if (right.has(gram)) shared += 1;
  return shared / (left.size + right.size - shared);
}
