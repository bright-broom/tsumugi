import * as C from '@/content/config';
import * as P from '@/content/prices';
import Base from '@/layouts/Base';
import Section from '@/components/Section';
import Table from '@/components/Table';
import Note from '@/components/Note';
import Cta from '@/components/Cta';

export const config = { unstable_runtimeJS: false };

const file = 'unlimited.html';
const title = `変更は何回でも｜${C.BRAND_T}`;
const desc =
  '文章の修正、写真の差し替え、料金の変更、お知らせの投稿。' +
  '回数の上限はありません。含まれるもの・別途になるものを全部公開しています。';

export default function UnlimitedPage() {
  return (
    <Base file={file} title={title} desc={desc}>
      <Section eyebrow="変更は何回でも" heading="どこまで含まれるかを、先に全部書きます" h1 navKey={file}
        lede="「無制限」と書いてある以上、<strong>どこまでが含まれてどこからが別料金なのかを、全部書いておきます。</strong>曖昧にしておくと、必ずあとで揉めるからです。" />

      <Section>
        <Table headers={['何回でも無料でお受けするもの']}
          rows={P.UNLIMITED_IN.map((x) => [`<strong>${x}</strong>`])} />
        <Table headers={['別途お見積りになるもの', '内容', '#目安']}
          rows={P.UNLIMITED_OUT.map(([n, d, p]) => [`<strong>${n}</strong>`, d, p])} />
        <Note heading="作業時間の目安" kind="warn"><p>{P.UNLIMITED_NOTE}</p></Note>
      </Section>

      <Section tone="tint" heading="他社だといくらかかるか">
        <Table headers={['他社の一般的な料金（相場）', '#金額']}
          rows={P.MARKET_SPOT.map((m) => [m.name, m.price])}
          caption="制作会社が公開している一般的なスポット料金の相場" />
        <p>相場でいうと、文章の修正が1箇所3,000円、画像の差し替えが5,000円です。
          メニューの値段を年に4回変えるお店なら、それだけで年12,000円。
          臨時休業のお知らせを月1回出すだけで年36,000円になります。</p>
        <Note heading="「無料」ではなく「月額に含まれている」とお考えください" kind="good">
          <p>{'タダで何でもやります、という話ではありません。' +
            `運用の月額（${P.yen(P.run('run_light').price)}から）に、通常のご依頼の分が入っています。` +
            'そのかわり、'}<strong>「これは追加料金ですか」と毎回気にしなくてよくなります。</strong>
            そこがいちばんの価値だと考えています。</p>
        </Note>
      </Section>

      <Section heading="運用のしかた">
        <ol className="steps">
          <li><b>ご依頼の窓口はひとつにします</b>
            <div className="d">電話・LINE・メールに散ると、対応漏れが起きます。
              納品時に窓口を決めて、そこに集めていただきます。急ぎのときは電話で構いません。</div></li>
          <li><b>作業した時間を記録して、毎月お知らせします</b>
            <div className="d">「今月は何を何分やったか」を運用レポートに書きます。
              <strong>測っていない「無制限」は信用できないと考えているので、数字を出します。</strong></div></li>
          <li><b>3か月の平均で大きく超えた場合だけ、上位プランをご案内します</b>
            <div className="d">その場でお断りしたり、追加請求したりはしません。
              月4時間 を大きく超えるご利用が続く場合に、次の更新でご相談させてください。</div></li>
        </ol>
      </Section>

      <Section heading="ご相談は無料です"><Cta /></Section>
    </Base>
  );
}
