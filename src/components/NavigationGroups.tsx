import Icon from '@/components/Icon';
import { NAV_GROUPS } from '@/content/nav';

export default function NavigationGroups({
  file,
  surface,
}: {
  file: string;
  surface: 'menu' | 'footer';
}) {
  return NAV_GROUPS.map((group) => {
    const labelId = `${surface}-nav-${group.id}`;
    return (
      <div className="nav-group" key={group.id}>
        <p className="nav-group-title" id={labelId}>
          {group.label}
        </p>
        <ul className={surface === 'footer' ? 'footer-links' : undefined} aria-labelledby={labelId}>
          {group.entries.map((entry) => (
            <li key={entry.id}>
              <a href={entry.path} aria-current={entry.file === file ? 'page' : undefined}>
                {surface === 'footer' && <Icon name={entry.icon} sm />}
                <span>{entry.label}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    );
  });
}
