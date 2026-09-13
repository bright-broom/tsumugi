/**
 * 月額制との総額比較。React + TypeScript で書いてあるが、
 * `client:` ディレクティブを付けていないので **ビルド時にHTMLへ焼かれ、
 * 実行時JSは1バイトも増えない**。これがこのスタックを選んだ理由。
 */
import {
  BUILD, COMPARE_MONTHS, SINGLE, SUBS_MARKET, SUBS_SOURCE, SUBS_TRANSFER_MONTHS,
  oursTotal, run, subsTotal, type RunKey,
} from '../data/prices';

type Pair = {
  sub: (typeof SUBS_MARKET)[number];
  ourName: string; ourPages: number; ourPrice: number; runKey: RunKey;
};

const PAIRS: Pair[] = [
  { sub: SUBS_MARKET[0], ourName: SINGLE.name, ourPages: SINGLE.pages,
    ourPrice: SINGLE.price, runKey: 'run_light' },
  { sub: SUBS_MARKET[1], ourName: BUILD[0].name, ourPages: BUILD[0].pages,
    ourPrice: BUILD[0].price, runKey: 'run_basic' },
  { sub: SUBS_MARKET[2], ourName: BUILD[1].name, ourPages: BUILD[1].pages,
    ourPrice: BUILD[1].price, runKey: 'run_standard' },
];

const yen = (n: number) => `${n.toLocaleString('en-US')}円`;

export default function TotalCompare({ brand }: { brand: string }) {
  return (
    <div className="tblwrap stack">
      <div className="tbl">
        <table>
          <thead><tr>
            <th scope="col">同じくらいのページ数で</th>
            <th scope="col">月額制（公開料金）</th>
            <th scope="col">{brand}</th>
          </tr></thead>
          <tbody>
            {PAIRS.map((p) => {
              const st = subsTotal(p.sub);
              const ot = oursTotal(p.ourPrice, p.runKey);
              const diff = ot - st;
              return (
                <tr key={p.sub.name}>
                  <th scope="row">{p.sub.pages}ページ前後</th>
                  <td data-h="月額制（公開料金）">
                    月{p.sub.monthly.toLocaleString('en-US')}円 × {COMPARE_MONTHS}か月<br />
                    <strong>{yen(st)}</strong><br />
                    <span className="dim">
                      {SUBS_TRANSFER_MONTHS}か月未満でやめるとサイトは非公開
                    </span>
                  </td>
                  <td data-h={brand}>
                    買い切り{p.ourPrice.toLocaleString('en-US')}円 ＋ 運用 月
                    {run(p.runKey).price.toLocaleString('en-US')}円<br />
                    <strong>{yen(ot)}</strong><br />
                    {diff < 0
                      ? <span className="yes">{yen(-diff)} 安い</span>
                      : <span className="dim">{yen(diff)} 高い</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="tbl-note">
        {SUBS_SOURCE}。金額は税別です。運用はいつでもやめられ、やめてもサイトは残ります。
      </p>
    </div>
  );
}
