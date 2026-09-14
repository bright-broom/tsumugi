import Icon from '@/components/Icon';
import { href } from '@/routing/registry';
import { useMessages } from '@/components/ContentProvider';
import { format } from '@/i18n/format';
import * as P from '@/content/prices';

export default function Plans({ feat = 6 }: { feat?: number }) {
  const copy = useMessages('plans');
  return (
    <div className="cq">
      <p className="segnote">{copy.nB}</p>
      <div className="plans production-plans">
        {P.BUILD.map((p) => (
          <div className={`plan${p.recommended ? ' pick' : ''}`} key={p.key}>
            {p.recommended && <span className="tag">{copy.tag}</span>}
            <div className="pn">{p.name}</div>
            <div className="pmeta">{format(copy.pmeta, { pPages: p.pages, pWeeks: p.weeks })}</div>
            <div className="pv">
              <span className="amt tnum">
                {p.price.toLocaleString('en-US')}
                <span className="u">{copy.u2}</span>
              </span>
              <span className="sub2">{copy.sub22}</span>
            </div>
            <div className="why">{p.lede}</div>
            <ul>
              {p.includes.slice(0, feat).map((i) => (
                <li key={i}>
                  <Icon name="check" sm />
                  <span>{i}</span>
                </li>
              ))}
            </ul>
            {feat < p.includes.length && (
              <a className="more" href={href('price')}>
                {format(copy.more, { pIncludesLengthFeat: p.includes.length - feat })}
              </a>
            )}
            <div className="flex" />
            {p.preparing ? (
              <p className="pmeta">{copy.preparing}</p>
            ) : (
              <a className="btn btn-1" href={href('contact')}>
                {copy.a}
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
