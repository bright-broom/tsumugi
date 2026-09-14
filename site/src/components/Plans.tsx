import { href } from '@/routing/registry';
import { useMessages } from '@/components/ContentProvider';
import { format } from '@/i18n/format';
import * as P from '@/content/prices';

/** プランは3枚並列にしない。真ん中を大きくして、選ぶ理由を書く。
    支払い方の切り替えはラジオ＋:has()で、JavaScriptは使わない。 */
interface Props {
  withSwitch?: boolean;
  feat?: number;
}

const RUN_FOR = { basic: 'run_basic', standard: 'run_standard', pro: 'run_growth' } as const;
const n = (v: number) => v.toLocaleString('en-US');

export default function Plans({ withSwitch = true, feat = 6 }: Props) {
  const copy = useMessages('plans');
  if (!withSwitch) return null;
  return (
    <div className="switcher">
      <div className="seg" role="group" aria-label={copy.ariaLabel}>
        <input type="radio" name="pay" id="pm" defaultChecked />
        <label htmlFor="pm">{copy.label}</label>
        <input type="radio" name="pay" id="pb" />
        <label htmlFor="pb">{copy.label2}</label>
      </div>
      <p className="segnote">
        <span>
          <span className="n-m">{format(copy.nM, { pINSTALLMENTCOUNT: P.INSTALLMENT_COUNT })}</span>
          <span className="n-b">{copy.nB}</span>
        </span>
      </p>
      <div className="cq">
        <div className="plans">
          {P.BUILD.map((p) => {
            const ins = P.INSTALLMENT[p.key];
            const rn = P.run(RUN_FOR[p.key]);
            const pick = 'recommended' in p && p.recommended;
            const monthly = ins.monthly + rn.price;
            return (
              <div className={`plan${pick ? ' pick' : ''}`} key={p.key}>
                {pick && <span className="tag">{copy.tag}</span>}
                <div className="pn">{p.name}</div>
                <div className="pmeta">
                  {format(copy.pmeta, { pPages: p.pages, pWeeks: p.weeks })}
                </div>
                <div className="pv">
                  <span className="v-m">
                    <span className="amt tnum">
                      {n(monthly)}
                      <span className="u">{copy.u}</span>
                    </span>
                    <span className="sub2">
                      {format(copy.sub2, {
                        insInitial: n(ins.initial),
                        insMonthly: n(ins.monthly),
                        pINSTALLMENTCOUNT: P.INSTALLMENT_COUNT,
                        rnPrice: n(rn.price),
                      })}
                    </span>
                  </span>
                  <span className="v-b">
                    <span className="amt tnum">
                      {n(p.price)}
                      <span className="u">{copy.u2}</span>
                    </span>
                    <span className="sub2">{format(copy.sub22, { rnPrice: n(rn.price) })}</span>
                  </span>
                </div>
                <div className="why">{p.lede}</div>
                <ul>
                  {p.includes.slice(0, feat).map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
                {feat < p.includes.length && (
                  <a className="more" href={href('price')}>
                    {format(copy.more, { pIncludesLengthFeat: p.includes.length - feat })}
                  </a>
                )}
                <div className="flex"></div>
                <a className={`btn ${pick ? 'btn-1' : 'btn-2'}`} href={href('contact')}>
                  {copy.a}
                </a>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
