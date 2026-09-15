import type { Messages } from '@/i18n/catalog';
import { format } from '@/i18n/format';
import { dateParts } from '@/lib/collections/core';

export function formatDate(copy: Messages['collections'], date: string): string {
  return format(copy.date, dateParts(date));
}

/** Publication and update dates; the update is shown only when it differs. */
export default function EntryDates({
  copy,
  entry,
}: {
  copy: Messages['collections'];
  entry: { publishedAt?: string; updatedAt?: string };
}) {
  const { publishedAt, updatedAt } = entry;
  if (!publishedAt) return null;
  return (
    <p className="entry-dates">
      <span>
        <span className="entry-date-label">{copy.publishedAt}</span>
        <time dateTime={publishedAt}>{formatDate(copy, publishedAt)}</time>
      </span>
      {updatedAt && updatedAt !== publishedAt && (
        <span>
          <span className="entry-date-label">{copy.updatedAt}</span>
          <time dateTime={updatedAt}>{formatDate(copy, updatedAt)}</time>
        </span>
      )}
    </p>
  );
}
