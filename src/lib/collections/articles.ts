import { z } from 'zod';
import { blockSchema, bodyReadiness, entryReadiness, entryShape } from '@/lib/collections/core';

/** News and explanatory articles share one model; `kind` separates their labels. */
const articleSchema = z.object({
  ...entryShape,
  kind: z.enum(['news', 'column']),
  body: z.array(blockSchema),
  /** Contracted intake slot (initial articles, plan add-ons). Only used for the intake report. */
  intake: z
    .object({ slot: z.string(), group: z.enum(['initial', 'additional']) })
    .optional(),
});
export const articlesSchema = z.object({ entries: z.array(articleSchema) });
export type Article = z.infer<typeof articleSchema>;
export type ArticlesInput = z.input<typeof articlesSchema>;

export function articleReadiness(article: Article): string[] {
  return [...entryReadiness(article), ...bodyReadiness(article.body)];
}
