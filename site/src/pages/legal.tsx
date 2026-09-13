import * as C from '../data/config';
import * as P from '../data/prices';
import Base from '../layouts/Base';
import Section from '../components/Section';
import Table from '../components/Table';

export const config = { unstable_runtimeJS: false };

const file = 'legal.html';
const title = `特定商取引法に基づく表記｜${C.BRAND_T}`;
const desc =
  '販売事業者、所在地、販売価格、お支払いの方法と時期、役務の提供時期、' +
  '返品・キャンセルの取り扱いを記載しています。金額はすべて税別です。';

const basic = P.build('basic');
const pro = P.build('pro');
const yen = (n: number) => n.toLocaleString('en-US');

const rows: [string, string][] = [
  ['販売事業者', C.LEGAL_NAME],
  ['運営責任者', C.MEMBERS[0]!.name],
  ['所在地', `〒${C.POSTAL_CODE} ${C.ADDRESS_REGION}${C.ADDRESS_CITY}${C.ADDRESS_STREET}`],
  ['電話番号', `${C.TEL}（${C.TEL_HOURS}）`],
  ['メールアドレス', C.EMAIL],
  ['販売価格',
    `ホームページ制作 ${yen(basic.price)}円〜${yen(pro.price)}円（税別）／` +
    `運用 月${yen(P.run('run_light').price)}円〜${yen(P.run('run_growth').price)}円（税別）。` +
    `<a href='price.html'>料金の詳細</a>`],
  ['商品代金以外の必要料金',
    '消費税、振込手数料、撮影で伺う際の交通費（実費）、' +
    'ドメイン更新料およびサーバー費用（運用のご契約がない期間）。'],
  ['お支払い方法', '銀行振込（一括／分割）'],
  ['お支払いの時期',
    '一括の場合は着手時に50%、納品時に50%。' +
    `分割の場合は着手時に初回分、以降は毎月${P.INSTALLMENT_COUNT}回。` +
    '運用費は毎月末日締め、翌月末までのお支払い。'],
  ['役務の提供時期',
    `ご契約から約${basic.weeks}〜${pro.weeks}週間` +
    '（構成とお客様のご確認の速さによります）。'],
  ['返品・キャンセル',
    '役務の提供のため、返品はお受けできません。' +
    '<strong>着手前のキャンセルは無償です。</strong>' +
    '着手後の中止は、その時点までの作業分のみ精算します（違約金はありません）。' +
    `<a href='terms.html'>詳しい条件</a>`],
  ['解約', `運用は${P.RUN_TERM}のご契約。次の期間の前にご連絡いただければ違約金はありません。`],
  ['動作環境',
    '各OSの最新版および1つ前のバージョンのブラウザ' +
    '（Chrome・Safari・Edge・Firefox）。'],
];

export default function LegalPage() {
  return (
    <Base file={file} title={title} desc={desc}>
      <Section
        heading="特定商取引法に基づく表記"
        h1
        lede="お申し込みの前にご確認ください。金額はすべて<strong>税別</strong>で表示しています。"
      >
        <Table headers={['', '']} rows={rows} />
      </Section>
    </Base>
  );
}
