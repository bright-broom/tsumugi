import { z } from 'zod';
import {
  blockSchema,
  blockText,
  bodyReadiness,
  chars,
  entryReadiness,
  entryShape,
  similarity,
} from '@/lib/collections/core';

/** One municipality the business actually serves, with text written for that place. */
const areaSchema = z.object({
  ...entryShape,
  prefecture: z.string(),
  municipality: z.string(),
  service: z.enum(['available', 'partial', 'unavailable']),
  /** Required for partial service: which districts or conditions apply. */
  serviceNote: z.string(),
  body: z.array(blockSchema),
});
export const areasSchema = z.object({ entries: z.array(areaSchema) });
export type ServiceArea = z.infer<typeof areaSchema>;
export type AreasInput = z.input<typeof areasSchema>;

/** Text that remains once the place names are removed must be substantial and distinct. */
export const AREA_MIN_SPECIFIC_CHARS = 120;
const AREA_MAX_SIMILARITY = 0.8;

function areaSpecificText(area: ServiceArea): string {
  let text = blockText(area.body);
  for (const name of [area.municipality, area.prefecture].filter((value) => value.trim()))
    text = text.replaceAll(name, '');
  return text.replace(/\s+/g, '');
}

export function areaReadiness(area: ServiceArea): string[] {
  const problems = [...entryReadiness(area), ...bodyReadiness(area.body)];
  if (!area.prefecture.trim() || !area.municipality.trim())
    problems.push('prefecture and municipality are required');
  if (area.service === 'unavailable')
    problems.push('service is "unavailable"; unavailable areas are not published');
  if (area.service === 'partial' && !area.serviceNote.trim())
    problems.push('partial service needs serviceNote');
  const specific = chars(areaSpecificText(area));
  if (specific < AREA_MIN_SPECIFIC_CHARS)
    problems.push(
      `body has ${specific} characters beyond the place names; ${AREA_MIN_SPECIFIC_CHARS} required`,
    );
  return problems;
}

/** Pairs of published areas whose place-independent text is nearly the same. */
export function areaDuplicates(areas: readonly ServiceArea[]): { slug: string; reason: string }[] {
  const problems: { slug: string; reason: string }[] = [];
  areas.forEach((area, index) => {
    for (const other of areas.slice(index + 1)) {
      const score = similarity(areaSpecificText(area), areaSpecificText(other));
      if (score >= AREA_MAX_SIMILARITY)
        problems.push({
          slug: other.slug,
          reason: `body is ${Math.round(score * 100)}% similar to ${area.slug}; write text specific to the area`,
        });
    }
  });
  return problems;
}
