import { useMessages } from '@/components/ContentProvider';
import Icon from '@/components/Icon';
import type { Messages } from '@/i18n/catalog';

/** Static local navigation; labels and fragment names live together in the catalog. */
export default function PageIndex({
  page,
}: {
  page: keyof Messages['shell']['pageIndex']['pages'];
}) {
  const copy = useMessages('shell').pageIndex;
  return (
    <nav className="page-index" aria-label={copy.label}>
      <ul>
        {copy.pages[page].map(([id, label]) => (
          <li key={id}>
            <a href={`#${id}`}>
              <span>{label}</span>
              <Icon name="arrow-down" sm />
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
