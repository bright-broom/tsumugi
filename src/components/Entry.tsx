import { ActionLink } from '@/components/Action';
import { href } from '@/routing/registry';
import { useMessages } from '@/components/ContentProvider';
import { format } from '@/i18n/format';
import * as P from '@/content/prices';
import Icon from '@/components/Icon';

/** 入口の1ページ商品。3プランの上に置く別の器 */
interface Props {
  full?: boolean;
}

const n = (v: number) => v.toLocaleString('en-US');

export default function Entry({ full = false }: Props) {
  const copy = useMessages('entry');
  const sg = P.SINGLE;
  const sub = P.SUBS_MARKET[0];
  const items = full ? sg.includes : sg.includes.slice(0, 4);
  const rest = sg.includes.length - 4;
  return (
    <>
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
            {items.map((i) => (
              <li key={i}>
                <Icon name="check" sm />
                <span>{i}</span>
              </li>
            ))}
          </ul>
          {full && (
            <p className="dim entry-exclusions">
              {format(copy.dim, { sgNotIncludesJoin: sg.notIncludes.join('／') })}
            </p>
          )}
          {!full && (
            <a className="more" href={href('price')}>
              {format(copy.more, { rest: rest })}
            </a>
          )}
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
      {full && (
        <p className="fine-note">
          {format(copy.fineNote, {
            subMonthly: n(sub.monthly),
            pCOMPAREMONTHS: P.COMPARE_MONTHS,
            pSubsTotalSub: n(P.subsTotal(sub)),
          })}
          <strong>{format(copy.strong, { pSUBSTRANSFERMONTHS: P.SUBS_TRANSFER_MONTHS })}</strong>
          {format(copy.fineNote2, { pSUBSSOURCE: P.SUBS_SOURCE })}
        </p>
      )}
    </>
  );
}
