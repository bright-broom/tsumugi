import * as P from '../data/prices';
import Icon from './Icon';

/** 入口の1ページ商品。3プランの上に置く別の器 */
interface Props { full?: boolean }

const n = (v: number) => v.toLocaleString('en-US');

export default function Entry({ full = false }: Props) {
  const sg = P.SINGLE;
  const sub = P.SUBS_MARKET[0];
  const items = full ? sg.includes : sg.includes.slice(0, 4);
  const rest = sg.includes.length - 4;
  return (
    <>
      <div className="entry">
        <div>
          <span className="lab"><Icon name="key" sm />まず1枚から</span>
          <div className="pn">{`${sg.name}　${sg.pages}ページ`}</div>
          <span className="amt tnum">{n(sg.price)}<span className="u">円</span></span>
          <span className="sub2">{`買い切り・税別／約${sg.weeks}週間でお渡し`}<br />
            {`運用をつける場合は月${n(P.run('run_light').price)}円から（いつでもやめられます）`}</span>
        </div>
        <div>
          <p style={{ marginBottom: '12px' }}>{sg.lede}</p>
          <ul className="plain">{items.map((i) => <li key={i}><Icon name="check" sm /><span>{i}</span></li>)}</ul>
          {full && (
            <p className="dim" style={{ margin: '-6px 0 16px' }}>{`含まれないもの：${sg.notIncludes.join('／')}`}</p>
          )}
          {!full && <a className="more" href="price.html">{`ほか${rest}項目`}</a>}
          <div className="btns">
            <a className="btn btn-2" href="contact.html">1ページで相談する</a>
            <a className="btn btn-2" href="owned.html">なぜ買い切りなのか</a>
          </div>
        </div>
      </div>
      <p className="fine-note">
        {`月額制の1ページは月${n(sub.monthly)}円。${P.COMPARE_MONTHS}か月で${n(P.subsTotal(sub))}円になり、`}
        <strong>{`${P.SUBS_TRANSFER_MONTHS}か月未満でやめるとサイトは非公開`}</strong>
        {`になります（${P.SUBS_SOURCE}）。`}
      </p>
    </>
  );
}
