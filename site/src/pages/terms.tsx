import * as C from '../data/config';
import * as P from '../data/prices';
import Base from '../layouts/Base';
import Section from '../components/Section';
import Table from '../components/Table';
import Note from '../components/Note';
import Cta from '../components/Cta';

export const config = { unstable_runtimeJS: false };

const file = 'terms.html';
const title = `ご契約とお約束｜解約・所有権・変更の範囲｜${C.BRAND_T}`;
const desc =
  '「何回でも無料」「やめても残ります」の根拠を1枚にまとめました。' +
  'ドメインの名義、ソースコードの扱い、解約したときにどうなるか、できないこと。' +
  '契約書に書く内容と同じものです。';
const n = (v: number) => v.toLocaleString('en-US');

export default function TermsPage() {
  return (
    <Base file={file} title={title} desc={desc}>
      <Section eyebrow="ご契約とお約束" heading="書いたことは、契約書にも書きます" h1
        lede="サイトのあちこちで「何回でも無料」「やめても残ります」と書いています。<strong>その根拠を、1枚にまとめました。</strong>契約書に書く内容と同じものです。">
        {C.PLACEHOLDER && (
          <Note heading="この文面は、契約書の下書きです" kind="warn">
            <p>公開前に弁護士の確認を受けたうえで確定します。
              <strong>実際のご契約は、確認後の書面で取り交わします。</strong>
              ここに書いてあることと契約書が食い違う場合は、契約書が優先します。</p>
          </Note>
        )}
      </Section>

      <Section tone="tint" navKey={file} heading="所有権の扱い">
        <Table
          headers={['項目', 'お約束する内容']}
          rows={[
            ['ドメインの名義', '<strong>初日からお客様（またはお客様の法人）の名義で取得します。</strong>当方の名義では取得しません。'],
            ['ソースコード', '納品時に一式をお渡しします。お客様は<strong>自由に利用・改変・複製でき、他社へ移すことも制限しません。</strong>'],
            ['写真と原稿', '撮影した写真の元データをお渡しします。<strong>用途の制限は付けません</strong>（チラシ・SNS・ポータルサイトへの掲載も可）。'],
            ['置き場所', '特定のサーバーでしか動かない作り方はしません。他社のサーバーへ移せる形で納品します。'],
            ['共通部分の権利', '他のお客様にも使う共通の部品（テンプレート）の権利は当方に残りますが、<strong>お客様がサイトを使い続けること・他社へ移すことを妨げません。</strong>'],
            ['ページを増やすとき', '上の段のプランに移る場合は<strong>差額のみ</strong>いただきます。すでにお支払いいただいた金額は充当し、払い直しにはしません。'],
          ]}
          caption="「所有権」と書いているのは、この5つのことです。"
        />
      </Section>

      <Section navKey={file} heading="解約したときにどうなるか">
        <Table
          headers={['項目', 'お約束する内容']}
          rows={[
            ['解約の申し出', `運用は${P.RUN_TERM}のご契約です。次の期間が始まる前にご連絡いただければ、<strong>違約金なしで終了します。</strong>`],
            ['解約したあと', '<strong>サイトは消しません。</strong>サーバーとドメインの契約を<strong>手数料なしで</strong>お客様に引き継ぎます。'],
            ['買い取り', '<strong>ありません。</strong>すでにお渡ししているものを買い戻していただく理由がありません。'],
            ['移管手数料', '<strong>いただきません。</strong>'],
            ['制作費の残り', `分割中に運用を解約された場合、制作費の残り（${P.INSTALLMENT_COUNT}回のうち未払い分）はお支払いいただきます。<strong>一括でのご精算も可能です。</strong>`],
            ['制作の途中で中止', 'その時点までの作業分のみ精算します。違約金はありません。できているものはお渡しします。'],
          ]}
          caption="解約は、こちらから引き止めません。理由もお聞きしません。"
        />
      </Section>

      <Section tone="tint" heading="変更と対応の範囲">
        <Table
          headers={['項目', 'お約束する内容']}
          rows={[
            ['何回でも無料の範囲', '文章・写真・料金・営業時間・お知らせ・スタッフ・施工事例の変更。<a href="unlimited.html">全部を公開しています</a>。'],
            ['別途いただくもの', `ページそのものを増やす場合（${n(P.OPTIONS[0].price)}円〜）、デザインの全面的な作り直し、新しい機能の追加。<strong>着手前に必ずお見積りを出します。</strong>`],
            ['対応の時間', `${C.RESPONSE_PROMISE}にご返信します。内容によっては当日中に反映します。`],
            ['納品の条件', '表示速度2.5秒以内ほか20項目を満たすこと。<strong>1つでも満たさない場合は納品しません</strong>（<a href="spec.html">項目の一覧</a>）。'],
          ]}
          caption="「何回でも」と書く以上、どこまでかも同じ場所に書きます。"
        />
      </Section>

      <Section heading="できること・できないこと">
        <Table
          headers={['項目', 'お約束する内容']}
          rows={[
            ['集客の保証', '<strong>検索順位・問い合わせ件数・売上を保証しません。</strong>保証していると受け取れる表現も使いません。'],
            ['補助金の採択', '<strong>保証しません。</strong>不採択だった場合の取り扱い（契約の解除・減額・時期の変更のいずれにするか）は、<strong>着手前に書面で決めます。</strong>'],
            ['復旧', '表示されない・改ざんされたなどの障害は、運用のご契約中は無償で対応します。バックアップは毎週取ります。'],
            ['再委託', '撮影・記事など一部を外部にお願いすることがあります。<strong>その場合も窓口と責任は当方です。</strong>'],
            ['お客様にお願いすること', '掲載する情報（料金・資格・実績）が事実であること。他人の文章・写真を無断で使わないこと。'],
            ['お引き受けできない場合', '法令に反する内容、事実と異なる表示、反社会的勢力に関係する場合はお引き受けできません。'],
          ]}
          caption="できないことを先に書くほうが、あとで揉めません。"
        />
      </Section>

      <Section tone="dark" heading="契約書は、契約前にお渡しします"
        lede="上は要約です。<strong>実際のご契約は書面で取り交わします。</strong>ひな形は、ご相談の時点でお渡しします。読んでから決めていただけます。">
        <Cta primary="契約書のひな形をもらう" />
      </Section>
    </Base>
  );
}
