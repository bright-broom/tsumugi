import * as C from '../data/config';
import * as P from '../data/prices';
import * as D from '../lib/diagrams';
import { NOT_SELLING } from '../data/spec';
import Base from '../layouts/Base';
import Section from '../components/Section';
import Table from '../components/Table';
import Note from '../components/Note';
import Calc from '../components/Calc';
import Entry from '../components/Entry';
import Plans from '../components/Plans';
import Figure from '../components/Figure';

export const config = { unstable_runtimeJS: false };

const file = 'price.html';
const n = (v: number) => v.toLocaleString('en-US');
const std = P.build('standard');
const basic = P.build('basic');
const rows = P.compareRows();
const last = rows[2]!;

const title = `料金｜1ページ${n(P.SINGLE.price)}円から・買い切り｜${C.BRAND_T}`;
const desc =
  `1ページ${n(P.SINGLE.price)}円から。9ページの本格的な構成は${n(std.price)}円です。` +
  `月額制との${P.COMPARE_MONTHS}か月の総額も並べて出しています。` +
  '分割の手数料は0円、契約期間の縛りもありません。';

const rivalTotal = 29_800 * 24;

export default function PricePage() {
  return (
    <Base file={file} title={title} desc={desc}>
      <Section eyebrow="料金" h1 navKey={file}
        heading={`1ページ${n(P.SINGLE.price)}円から、<br>9ページ${n(std.price)}円まで`}
        lede="金額はすべて税別です。<strong>業種によって値段は変えません。</strong>変わるのはページ数と、作るページの中身です。">
        <p><strong>1ページから始められます。</strong>あとから増やすときは差額だけで、
          最初に払ったぶんは無駄になりません。</p>
        <Entry full />
        <h3 style={{ margin: '48px 0 18px' }}>最初から一式で作る場合</h3>
        <Plans />
      </Section>

      <Section tone="tint" eyebrow="月額制と比べる" heading={`${P.COMPARE_MONTHS}か月の総額で並べます`}
        lede={`月額制のホームページは、月々だけ見ると安く見えます。<strong>${P.COMPARE_MONTHS}か月の総額</strong>と、<strong>サイトがお客様のものになる時点</strong>の2つで比べてください。`}>
        <Table headers={['同じくらいのページ数で', '月額制（公開料金）', C.BRAND]}
          rows={rows.map((r) => [
            `${r.sub_pages}ページ前後`,
            `月${n(r.sub_monthly)}円＋初期${n(P.SUBS_MARKET[0].init)}円<br><strong>${n(r.sub_total)}円</strong>`,
            `買い切り${n(r.our_price)}円＋運用月${n(r.our_run)}円<br>` +
              `<strong>${n(r.our_total)}円</strong><br>` +
              (r.diff < 0
                ? `<span class="yes">${n(-r.diff)}円 安い</span>`
                : `<span class="dim">${n(r.diff)}円 高い</span>`),
          ])}
          caption={`${P.SUBS_SOURCE}。金額は税別です。月額制は最低契約${P.SUBS_MIN_TERM}か月で、<strong>${P.SUBS_TRANSFER_MONTHS}か月未満で解約するとサイトは非公開</strong>と明記されています。`}
          foot="当方は買い切りなので、運用を途中でやめても表の左側の金額だけが減り、<strong>サイトは残ります。</strong>" />
        <Note heading="ページ数が多い側は、こちらのほうが高くなります" kind="good">
          <p>{`${last.sub_pages}ページ前後だと${P.COMPARE_MONTHS}か月で${n(last.diff)}円（月あたり${n(Math.floor(last.diff / P.COMPARE_MONTHS))}円）の差になります。`}</p>
          <p>差の中身は、<strong>{`出張撮影（単品${n(P.OPTIONS[1].price)}円）`}</strong>、
            <strong>取材して書く原稿</strong>、<strong>修正の回数制限なし</strong>、
            <strong>Googleマップの運用</strong>です。
            月額制の制作は、お客様がフォームに素材を入力するところから始まります。
            写真も文章も手元にあって、更新もあまりしない、という方には月額制のほうが向いています。</p>
        </Note>
      </Section>

      <Section tone="tint" eyebrow="値段の中身" heading="この金額に何が入っているか"
        lede={`「なぜこの金額なのか」が分からないと、判断のしようがありません。スタンダード${n(std.price)}円の中身を、単品で頼んだ場合の金額と並べて書きます。`}>
        <Calc title={`スタンダード 9ページ ${n(std.price)}円（税別）の中身`} rows={[
          { label: 'サイトの設計と9ページの制作', value: '—', cls: 'small', sub: '業種ごとに作るページが決まっています' },
          { label: '出張撮影 半日（30カット・加工込み）', value: '55,000円', cls: 'small', sub: '単品の場合。交通費は実費' },
          { label: '原稿の聞き取りと執筆 9ページ分', value: '148,500円', cls: 'small', sub: '単品なら16,500円／ページ' },
          { label: '解説記事 3本', value: '99,000円', cls: 'small', sub: '単品なら33,000円／本' },
          { label: 'ドメイン取得・Googleマップ整備・速度計測・ソース納品', value: '—', cls: 'small' },
          { label: '単品で積んだ場合のおよその金額', value: '600,000円前後', cls: 'sum' },
          { label: 'スタンダードの価格', value: `${n(std.price)}円`, cls: 'net' },
        ]} />
        <Note heading="撮影と原稿をまとめてやるから安くできるだけで、作業は減らしていません">
          <p>逆に、効果の根拠がないものは最初から入れていません。
            <a href="spec.html">売らないと決めているもの</a>も公開しています。</p>
        </Note>
        <Note heading="全国どこでもお受けします" kind="warn">
          <p>打ち合わせ・原稿の聞き取り・納品後の修正は、<strong>すべてオンラインと電話で完結します。</strong>
            対面が必要な工程はありません。</p>
          <p>出張撮影だけは現地に伺うので、<strong>交通費は実費をご負担いただきます。</strong>
            お手持ちの写真や、すでに撮影済みの素材をお使いいただく場合は撮影を省けます
            （その分の減額はご相談ください）。</p>
        </Note>
      </Section>

      <Section eyebrow="お支払いの方法" heading="買い切りでも、分割でも、総額は同じです">
        <Table headers={['プラン', '#買い切り', '#分割の初回', `#分割 月額×${P.INSTALLMENT_COUNT}回`, '#分割の総額']}
          rows={P.BUILD.map((p) => {
            const ins = P.INSTALLMENT[p.key];
            const [tot] = P.totalInstallment(p.key);
            return [
              `<strong>${p.name}</strong><br><span class="dim">${p.pages}ページ・約${p.weeks}週間</span>`,
              n(p.price), n(ins.initial), n(ins.monthly),
              `${n(tot)}<br><span class="yes">手数料0円</span>`,
            ];
          })}
          caption="金額は税別。分割の総額は買い切りと同額です"
          foot={`分割払いは運用プランとの同時ご契約が条件です。${P.INSTALLMENT_COUNT}回のお支払いが終わったあとは、運用の月額だけになります。ドメイン・ホームページ・ソースコードは、最初からお客様のものです。`} />
        <Table headers={['あとからページを増やすとき', '扱い']} rows={[
          ['シングルからベーシックへ',
            `差額のみ（${n(basic.price)}円 − ${n(P.SINGLE.price)}円 ＝ <strong>${n(basic.price - P.SINGLE.price)}円</strong>）`],
          ['ベーシックからスタンダードへ', `差額のみ（<strong>${n(std.price - basic.price)}円</strong>）`],
          ['構成にないページを1枚だけ足す', `${n(P.OPTIONS[0].price)}円／ページ`],
        ]}
          caption="最初に払った金額は、次の段の差額に充てます。払い直しにはなりません。"
          foot="この扱いは契約書にも書きます（<a href='terms.html'>ご契約とお約束</a>）。" />
        <Note heading="分割にしても、総額は1円も変わりません" kind="good">
          <p>金融機関やクレジット会社を通さず、当方とお客様の間だけで分割にするので、
            手数料が発生しません。だからお客様に手数料を請求する理由がありません。</p>
          <p>契約期間の縛りもありません。
            <strong>途中でまとめてお支払いいただくこともできますし、やめてもサイトは残ります。</strong></p>
        </Note>
      </Section>

      <Section tone="tint" eyebrow="運用（月額）" heading="制作して放置、がいちばんもったいない"
        lede="作ったあとを一緒にやる部分です。<strong>ここに更新も集客も全部入れています。</strong>オプションの足し算にはしません。">
        <div className="plans">{P.RUN.map((r) => {
          const pick = 'recommended' in r && r.recommended;
          return (
            <div className={`plan${pick ? ' pick' : ''}`} key={r.name}>
              {pick && <span className="tag">いちばん多い選択</span>}
              <div className="pn">{r.name}</div>
              <div className="pmeta">{`${P.RUN_TERM}のご契約`}</div>
              <div className="pv"><span className="amt tnum">{n(r.price)}<span className="u">円／月</span></span></div>
              <div className="why">{r.lede}</div>
              <ul>{r.includes.map((i, k) => <li key={k}>{i}</li>)}</ul>
            </div>
          );
        })}</div>
        <Note heading="運用の中心は「口コミの鮮度を保つこと」です">
          <p>ホームページを直すことより、Googleマップの投稿と口コミへの返信のほうが来店に効きます。
            調査では<strong>74%の方が直近3か月以内の口コミを重視し、
            42%は口コミに返信していないお店を避ける</strong>という結果が出ています。
            スタンダード以上では、ここを当方が代行します。</p>
        </Note>
      </Section>

      <Section tone="dark" eyebrow="2年後にどうなるか" heading="安い月額には、たいてい理由があります"
        lede="月額制のサービスは、月々の金額だけを見ると安く見えます。<strong>2年経ったときに何が残るか</strong>で比べてください。">
        <Figure svg={D.afterTwoYears(29_800, P.INSTALLMENT.standard.initial,
          P.INSTALLMENT.standard.monthly + P.run('run_standard').price)} />
        <Table headers={['図に出ていない条件', 'ある工務店向けサービス', '当方 スタンダード']} rows={[
          ['契約期間の縛り', '<span class="no">2年（必須）</span>', '<span class="yes">なし</span>'],
          ['ソースコード', '<span class="no">お渡しなし</span>', '<span class="yes">お渡しします</span>'],
          ['修正・更新', '<span class="dim">月1回1時間／月3箇所などの上限があるのが一般的</span>',
            '<span class="yes">何回でも</span>'],
          ['一括で払った場合',
            `<span class="dim">649,800円。2年払い切ると${n(rivalTotal - 649_800)}円多く払うことになります</span>`,
            `${n(std.price)}円（総額は分割と同じ）`],
        ]} />
        <Note heading="解約したらサイトが消える契約は、実際にあります" kind="bad">
          <p>削除か買い取りかを選ばされる、移管に手数料がかかる、
            36か月未満だと非公開になる。契約書に書かれているので違法ではありませんが、
            <strong>知らずに契約されている方が多いです。</strong></p>
          <p>当方は<strong>ドメインを最初からお客様の名義で取得します。</strong></p>
        </Note>
      </Section>

      <Section eyebrow="そのほか" heading="標準で含まれるもの・追加のもの">
        <Table headers={['標準で含まれるもの（追加料金なし）', '他社の一般的な料金']}
          rows={P.FREE_ITEMS.map((f) => [`<strong>${f.name}</strong>`, `<span class="dim">${f.market}</span>`])} />
        <Table headers={['項目', '#金額', '備考']}
          rows={P.OPTIONS.map((o) => [o.name, n(o.price), o.note])}
          caption="税別。運用プランに含まれないものだけを載せています" />
      </Section>

      <Section tone="tint" heading="売らないと決めているもの">
        <Note heading="こういうものは売りません" kind="bad">
          <ul className="plain">{NOT_SELLING.map(([nm, r]) => (
            <li key={nm}><strong>{nm}</strong><br />{r}</li>
          ))}</ul>
          <p>根拠は<a href="spec.html">納品する仕様</a>に全部書いています。</p>
        </Note>
        <div className="btns">
          <a className="btn btn-1" href={`tel:${C.TEL_LINK}`}>{`電話する　${C.TEL}`}</a>
          <a className="btn btn-2" href="contact.html">フォームで相談する</a>
        </div>
      </Section>
    </Base>
  );
}
