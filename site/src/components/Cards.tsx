import { NAV_IC } from '@/content/nav';
import { ic } from '@/lib/ic';
import { raw } from '@/lib/raw';

export interface Card {
  title: string; desc: string;
  link?: [label: string, href: string];
}
interface Props { items: Card[]; cls?: string }

export default function Cards({ items, cls = 'g3' }: Props) {
  return (
    <div className="cards"><div className={`g ${cls}`}>
      {items.map((it, i) => {
        const mark = it.link && NAV_IC[it.link[1]];
        return (
          <div className="card" key={i}>
            {/* 見出しは HTML 文字列なので、章の目印も文字列にして前に足す */}
            <h3 dangerouslySetInnerHTML={raw((mark ? ic(mark, 'ic-sm') : '') + it.title)} />
            <p className="meta" dangerouslySetInnerHTML={raw(it.desc)} />
            {it.link && <a className="more" href={it.link[1]}>{it.link[0]}</a>}
          </div>
        );
      })}
    </div></div>
  );
}
