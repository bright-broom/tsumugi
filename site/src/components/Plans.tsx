import * as P from '@/content/prices';

/** プランは3枚並列にしない。真ん中を大きくして、選ぶ理由を書く。
    支払い方の切り替えはラジオ＋:has()で、JavaScriptは使わない。 */
interface Props { withSwitch?: boolean; feat?: number }

const RUN_FOR = { basic: 'run_basic', standard: 'run_standard', pro: 'run_growth' } as const;
const n = (v: number) => v.toLocaleString('en-US');

export default function Plans({ withSwitch = true, feat = 6 }: Props) {
  if (!withSwitch) return null;
  return (
    <div className="switcher">
      <div className="seg" role="group" aria-label="お支払い方法の表示切り替え">
        <input type="radio" name="pay" id="pm" defaultChecked /><label htmlFor="pm">毎月払う</label>
        <input type="radio" name="pay" id="pb" /><label htmlFor="pb">まとめて払う</label>
      </div>
      <p className="segnote"><span>
        <span className="n-m">{`制作費${P.INSTALLMENT_COUNT}回＋運用費の合計です。手数料0円なので総額は同じ。`}</span>
        <span className="n-b">制作費を一度で払う場合。このあと運用費が毎月かかります。</span>
      </span></p>
      <div className="cq"><div className="plans">
        {P.BUILD.map((p) => {
          const ins = P.INSTALLMENT[p.key];
          const rn = P.run(RUN_FOR[p.key]);
          const pick = 'recommended' in p && p.recommended;
          const monthly = ins.monthly + rn.price;
          return (
            <div className={`plan${pick ? ' pick' : ''}`} key={p.key}>
              {pick && <span className="tag">迷ったらこれです</span>}
              <div className="pn">{p.name}</div>
              <div className="pmeta">{`${p.pages}ページ・約${p.weeks}週間でお渡し`}</div>
              <div className="pv">
                <span className="v-m">
                  <span className="amt tnum">{n(monthly)}<span className="u">円／月</span></span>
                  <span className="sub2">
                    {`初回 ${n(ins.initial)}円 ＋ 毎月 ${n(ins.monthly)}円×${P.INSTALLMENT_COUNT}回 ＋ 運用 ${n(rn.price)}円／月`}
                  </span>
                </span>
                <span className="v-b">
                  <span className="amt tnum">{n(p.price)}<span className="u">円</span></span>
                  <span className="sub2">{`一度だけ。このあと運用 ${n(rn.price)}円／月`}</span>
                </span>
              </div>
              <div className="why">{p.lede}</div>
              <ul>{p.includes.slice(0, feat).map((i) => <li key={i}>{i}</li>)}</ul>
              {feat < p.includes.length && (
                <a className="more" href="price.html">{`ほか${p.includes.length - feat}項目`}</a>)}
              <div className="flex"></div>
              <a className={`btn ${pick ? 'btn-1' : 'btn-2'}`} href="contact.html">このプランで相談する</a>
            </div>
          );
        })}
      </div></div>
    </div>
  );
}
