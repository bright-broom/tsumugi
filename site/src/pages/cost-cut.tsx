import * as C from '@/content/config';
import * as P from '@/content/prices';
import * as D from '@/content/diagrams';
import Base from '@/layouts/Base';
import Section from '@/components/Section';
import Table from '@/components/Table';
import Note from '@/components/Note';
import Figure from '@/components/Figure';
import Cta from '@/components/Cta';

export const config = { unstable_runtimeJS: false };

const file = 'cost-cut.html';
const title = `掲載費の見直し｜${C.BRAND_T}`;
const desc =
  '食べログ・ぐるなび・ホットペッパーの掲載費と手数料を棚卸しして、' +
  'ホームページの運用費に振り替えます。いきなりやめる提案はしません。';

const runStd = P.run('run_standard').price;
const n = (v: number) => v.toLocaleString('en-US');

/** 上のプランから1段下げたときの差額が、運用スタンダードに届くかを並べる（安い順に出す） */
const rows = P.PORTAL_TABELOG.map(([name, amount], i) => {
  const cut = i > 0 ? P.PORTAL_TABELOG[i - 1]![1] - amount : null;
  return [
    name,
    amount ? n(amount) : '0',
    cut === null ? '—' : n(cut),
    cut === null
      ? '—'
      : cut >= runStd
        ? '<span class="yes">足ります</span>'
        : '<span class="no">足りません</span>',
  ];
}).reverse();

// ディナー1人220円。運用スタンダードが出る人数（切り上げ）
const people = Math.floor(runStd / P.PORTAL_FEE_DINNER) + 1;

export default function CostCutPage() {
  return (
    <Base file={file} title={title} desc={desc}>
      <Section eyebrow="掲載費の見直し" heading="いま払っている掲載費から見直します" h1 navKey={file}
        lede="新しい予算をつくる前に、<strong>いま出ている費用を見ます。</strong>ホームページの運用費は、多くの場合ここから出せます。" />

      <Section heading="飲食店の場合">
        <Table headers={['食べログのプラン', '#月額（税込）', '#1段下げた差額', '運用スタンダードに足りるか']}
          rows={rows}
          caption="食べログが公開している料金（月額は税抜表記のため1.1倍して税込に換算）"
          foot={`このほかに、ネット予約の送客手数料がランチ${P.PORTAL_FEE_LUNCH}円・ディナー${P.PORTAL_FEE_DINNER}円（お一人あたり・税込）かかります。`} />
        <Figure svg={D.moneyFlow(27_500, runStd)} />
        <Note heading="いちばん効くのは「1段下げる」ではなく「無料プランに戻す」です" kind="good">
          <p>食べログのネット予約は、<strong>導入費・固定費が0円で、無料プランでも使えて、
            手数料の単価は有料プランと同じ</strong>です（食べログが公式に明記しています）。
            つまり<strong>予約の受付を失わずに、掲載料だけをゼロにできます。</strong></p>
          <p>優先的に上位に表示される扱いは失いますが、
            これは公正取引委員会が「より高額な手数料を支払えば他の飲食店よりも上位に掲載される」と
            報告している仕組みから降りる、という話です。</p>
        </Note>
        <Note heading="ライトプランと無料掲載のお店には、この話は使えません" kind="warn">
          <p>{`ライト（税込11,000円）をやめても11,000円で、運用スタンダード${n(runStd)}円には足りません。もともと無料掲載のお店は削減のしようがありません。`}
            <strong>お店のプランを確認せずに「1段下げれば出ます」と言うのは不誠実なので、
            最初に必ずお伺いします。</strong></p>
        </Note>
      </Section>

      <Section tone="tint" eyebrow="もっと痛いところ" heading="常連さんの予約にも、毎回手数料がかかっています">
        <p>{`送客手数料のディナー${P.PORTAL_FEE_DINNER}円は、`}<strong>新しいお客様にも、
          常連のお客様にも同じようにかかります。</strong>
          {`いつも来てくださる方がネット予約するたびに${P.PORTAL_FEE_DINNER}円です。`}</p>
        <p>{`運用スタンダード${n(runStd)}円は、`}
          <strong>{`ディナーのご予約を月${people}人分だけ自分のサイトに移せば出る金額`}</strong>
          です。毎晩4名×30日＝月120人のお店なら、送客手数料だけで月26,400円払っていることになります。</p>
      </Section>

      <Section eyebrow="美容室の場合" heading="請求書を見せてください">
        <Note heading="ホットペッパービューティーの掲載料は公開されていません" kind="warn">
          <p>正規の代理店自身が「リクルート社を含め、どこのホームページにも記載されていない」と
            書いています。エリア・業種・契約期間・プランで変わります。</p>
          <p>なので<strong>推測で金額を申し上げません。直近の請求書を見せていただくのが
            いちばん確実です。</strong></p>
        </Note>
        <p>確実に言えるのは2つです。</p>
        <ul className="plain">
          <li><strong>ホットペッパービューティーには無料プランがありません。</strong>
            掲載を続けるかぎり、固定費を払い続けることになります。</li>
          <li><strong>美容室の市場は前年比5.9%縮んでいて、利用が減った理由の1位は
            「美容代を節約する必要が出てきた」</strong>です（リクルート自身の調査）。
            市場が縮むなかで掲載費は下がりません。</li>
        </ul>
      </Section>

      <Section tone="tint" eyebrow="広告" heading="止めるのではなく、単価を下げます">
        <p>広告については<strong>「やめましょう」と申し上げません。</strong>
          止めた実測の例では、自然検索の流入は一時的に増えたものの続かず、
          <strong>予算は3.45倍に増えて売上は1.07倍にしかなりませんでした。</strong></p>
        <p>正解は止めることではなく、入札の単価を下げることです。
          別の事例では、この方法でクリック単価を約30%下げながら、
          検索結果の上部にほぼ常に表示され続けています。
          あわせて、商圏の外への配信を止める、成約ゼロの検索語を除外する、といった整理をします。</p>
      </Section>

      <Section eyebrow="進め方" heading="いきなりやめません。5段階で進めます">
        <ol className="steps">
          <li><b>3つの数字をお聞きします</b>
            <div className="d">掲載料はいくらか、手数料はいくら払っているか、
              そのサイト経由で月に何人の新しいお客様が来ているか。</div></li>
          <li><b>新しいお客様1人あたりの獲得コストを、一緒に計算します</b>
            <div className="d">多くの店主の方が、この数字をご覧になるのは初めてです。
              <strong>ここだけでも意味があります。</strong></div></li>
          <li><b>そのお客様の粗利と比べます</b>
            <div className="d">1人5,000円かけて獲得したお客様の粗利が3,000円なら、そのプランは合っていません。</div></li>
          <li><b>3〜6か月の併走計画を作ります</b>
            <div className="d"><strong>いきなり掲載をやめません。</strong>
              Googleマップと自分のサイトの導線が育つまで、両方を並行して使います。</div></li>
          <li><b>契約の更新月に合わせてプランを下げます</b>
            <div className="d">食べログは6か月または12か月ごとの自動更新、
              ホットペッパーグルメは契約の途中でプランを下げられない場合があります。
              <strong>「いますぐ安くなります」とは申し上げません。</strong></div></li>
        </ol>
        <Note heading="やめるべきでないお店には、やめないでくださいと申し上げます" kind="bad">
          <p>次のいずれかに当てはまる場合、掲載をやめるのは危険です。</p>
          <ul className="plain">
            <li>既存のお客様の連絡先が整理されておらず、再来店の導線がない</li>
            <li>再来店率が業界平均（3割前後）を下回っている</li>
            <li>開業して間もなく、まだ知られていない</li>
            <li>ご予約の件数が多い（プランを下げると手数料の単価が上がるサービスがあります。
              あるサービスでは有料プランのディナー50円が、無料プランでは実質215円になります）</li>
          </ul>
          <p><strong>この場合は「まだやめないでください」と申し上げます。</strong>
            そのほうが結果的に長くお付き合いできると考えています。</p>
        </Note>
      </Section>

      <Section heading="まず数字を一緒に見ましょう"><Cta primary="請求書を見てもらう" /></Section>
    </Base>
  );
}
