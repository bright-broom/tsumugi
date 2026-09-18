import { routeLinks } from '@/content/nav';
import type { RouteId } from '@/routing/registry';
import Icon from '@/components/Icon';

/** セクションから詳細ページへの導線。文言とアイコンはナビと共通（content/nav）。 */
export default function RouteLinks({ ids }: { ids: readonly Exclude<RouteId, '404'>[] }) {
  return (
    <ul className="route-links">
      {routeLinks(ids).map((link) => (
        <li key={link.id}>
          <a href={link.path}>
            <Icon name={link.icon} sm />
            <span>{link.label}</span>
            <Icon name="arrow-right" sm />
          </a>
        </li>
      ))}
    </ul>
  );
}
