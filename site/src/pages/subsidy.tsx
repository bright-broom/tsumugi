import * as C from '../data/config';
import * as P from '../data/prices';
import * as D from '../lib/diagrams';
import Base from '../layouts/Base';
import Section from '../components/Section';
import Table from '../components/Table';
import Note from '../components/Note';
import Acc from '../components/Acc';
import Figure from '../components/Figure';
import Cta from '../components/Cta';

export const config = { unstable_runtimeJS: false };

const file = 'subsidy.html';
const S = P.SUBSIDY;
const sd = P.subsidyCalc();
const title = `補助金で実質いくらになるか｜${C.BRAND_T}`;
const desc =
  `小規模事業者持続化補助金（${S.round}）を使うと、` +
  `${P.yen(sd.total)}の販路開拓パッケージが実質${P.yen(sd.net)}になります。` +
  `採択率は${S.adoption_rate}。通らなかった場合の扱いも先に決めます。`;

export default function SubsidyPage() {
  return (
    <Base file={file} title={title} desc={desc}>
      <Section eyebrow="補助金" heading={`${P.yen(sd.total)}が、実質${P.yen(sd.net)}になります`} h1 navKey={file}
        lede={`${S.name}（${S.round}）は、補助率が${S.rate_text}、上限が${P.yen(S.cap)}です。ホームページに使える分は<strong>補助金額で${P.yen(S.web_cap)}まで</strong>と決まっています。`} />

      <Section heading="内訳">
        <Table headers={['科目', '内容', '#金額']}
          rows={S.package.map(([k, d, a]) => [k, d, a.toLocaleString('en-US')])}
          caption="金額は税別"
          foot={`合計 ${P.yen(sd.total)}。ホームページ単独では申請できないため、チラシ・看板・撮影とまとめた「販路開拓」の形にしています。`} />
        <Figure svg={D.subsidyBar(sd.total, sd.web, sd.pr, sd.grant, sd.net)} />
        <Note heading="なぜチラシや看板を一緒に組むのか">
          <p>この補助金は<strong>ホームページ関連費だけでは申請できません。</strong>
            必ずほかの経費と一緒に申請する必要があります。
            ですので、ホームページと同じ写真・同じ文章を使って、
            チラシ・ショップカード・看板・メニュー表までまとめて作ります。
            <strong>撮影も原稿も一度で済むので、別々に頼むより安くなります。</strong></p>
        </Note>
      </Section>

      <Section tone="tint" heading="先にお伝えしておくこと">
        <Note heading="採択率は約半分です" kind="bad">
          <p>直前の回（第19回）の採択率は<strong>{S.adoption_rate}</strong>
            {`（${S.adoption_detail}）。「必ず通ります」「実質無料です」とは申し上げません。`}</p>
          <p><strong>通らなかった場合の取り扱いを、契約書に先に書きます。</strong>
            ベーシックプランに縮小するか、白紙に戻すか。
            どちらかをご契約の前に決めておきます。口約束にはしません。</p>
        </Note>
        <Note heading="補助金はあとから入ってきます" kind="warn">
          <p>補助金は精算払いです。<strong>お客様がいったん全額を立て替えて、
            報告したあとに入金されます。</strong>
            この点を最初にお伝えしておかないと、資金の段取りで困ることになります。</p>
        </Note>
        <Note heading="申請書はお客様ご自身に書いていただきます">
          <p>2026年1月に行政書士法が改正され、<strong>名目を問わず報酬を得て申請書類を作成することが
            明確に違反</strong>となりました。制作費に申請の代行を含めることもできません。</p>
          <p>ですので、計画づくりは<strong>商工会・商工会議所</strong>にお願いします。
            無料で支援していただけますし、申請に必要な「事業支援計画書」の発行窓口でもあります。
            当方がお出しするのは<strong>お見積書と、効果の根拠になる資料</strong>です。
            お客様がそれを自分の言葉で申請書に書く、という進め方になります。</p>
        </Note>
      </Section>

      <Section eyebrow="手順" heading="交付決定の前に着手しないことが、いちばん大事です">
        <Figure svg={D.subsidyTimeline(S.form4_deadline, S.deadline)} />
        <Acc summary="各段階でやること">
          <ul className="plain">
            <li><b>ご相談・お見積り</b>　補助金を使うかを含めて進め方を決めます</li>
            <li><b>商工会へご一緒します</b>　様式4の発行を依頼。年末は混むので11月上旬までが安全</li>
            <li><b>申請はお客様ご自身で</b>　当方は見積書と根拠資料をお渡しします</li>
            <li><b>交付決定を待つ</b>　契約書の日付も決定日より後にします</li>
            <li><b>着手・納品</b>　決定後に契約して着手します</li>
            <li><b>報告して入金</b>　書類づくりもご一緒します（代行はできません）</li>
          </ul>
        </Acc>
        <Note heading="お見積りが50万円を超える場合は、他社のお見積りも必要です">
          <p>1件50万円（税込）を超える発注には、2者以上のお見積りが必要という決まりがあります。
            <strong>これは最初にお伝えします。</strong>あとから言うと段取りが崩れるからです。</p>
        </Note>
      </Section>

      <Section tone="tint" heading="市町村の補助金も見ます">
        <p>市町村ごとの補助金もあります。ただし<strong>「ホームページ補助金」という名前ではなく、
          「販路開拓」「産業振興」「DX推進」といった枠のなかの1メニュー</strong>になっていることが多いです。</p>
        <p>しかも予算に達すると早期に終了します（ある県では9月30日締切の制度が8月28日に終了しました）。
          当方で毎週チェックして、使えそうなものがあればお知らせします。</p>
      </Section>

      <Section heading="ご相談は無料です"><Cta primary="補助金を使えるか聞く" /></Section>
    </Base>
  );
}
