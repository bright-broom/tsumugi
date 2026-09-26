import { ActionLink } from '@/components/Action';
import { href } from '@/routing/registry';
import { useMessages } from '@/components/ContentProvider';
import { format } from '@/i18n/format';
import * as P from '@/content/prices';
import Icon from '@/components/Icon';

/** 入口の1ページ商品。料金ページで 2 つのプランの上に置く別の器 */
const n = (v: number) => v.toLocaleString('en-US');

export default function Entry() {
  const copy = useMessages('entry');
  const sg = P.SINGLE;
  return (
    <div className="entry">
      <div>
        <span className="lab">
          <Icon name="key" sm />
          {copy.lab}
        </span>
        <div className="pn">{format(copy.pn, { sgName: sg.name, sgPages: sg.pages })}</div>
        <span className="amt tnum">
          {n(sg.price)}
          <span className="u">{copy.u}</span>
        </span>
        <span className="sub2">
          {format(copy.sub2, { sgWeeks: sg.weeks })}
          <br />
          {copy.sub22}
        </span>
      </div>
      <div>
        <p className="entry-lede">{sg.lede}</p>
        <ul className="plain">
          {sg.includes.map((i) => (
            <li key={i}>
              <Icon name="check" sm />
              <span>{i}</span>
            </li>
          ))}
        </ul>
        <p className="dim entry-exclusions">
          {format(copy.dim, { sgNotIncludesJoin: sg.notIncludes.join('／') })}
        </p>
        <div className="btns">
          <ActionLink variant="secondary" href={href('contact')}>
            {copy.btn}
          </ActionLink>
          <ActionLink variant="secondary" href={href('owned')}>
            {copy.btn2}
          </ActionLink>
        </div>
      </div>
    </div>
  );
}
