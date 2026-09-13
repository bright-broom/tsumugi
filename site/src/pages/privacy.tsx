import * as C from '../data/config';
import Base from '../layouts/Base';
import Section from '../components/Section';
import Table from '../components/Table';
import Note from '../components/Note';

export const config = { unstable_runtimeJS: false };

const file = 'privacy.html';
const title = `個人情報の取り扱い｜${C.BRAND_T}`;
const desc =
  'お預かりするのは、ご相談にお答えするために必要なものだけです。' +
  '第三者には提供しません。このサイトはアクセス解析もCookieも使っていません。';

export default function PrivacyPage() {
  return (
    <Base file={file} title={title} desc={desc}>
      <Section
        eyebrow="個人情報の取り扱い"
        heading="お預かりするものと、その使い道"
        h1
        lede="お預かりするのは、<strong>ご相談にお答えするために必要なものだけ</strong>です。それ以外の目的には使いません。"
      >
        <Note heading="このサイトは、アクセス解析を入れていません" kind="good">
          <p>実行時に動くプログラムを使っていないので、
            <strong>Cookieも使っていませんし、閲覧の記録も取っていません。</strong>
            どのページを見られたかは、当方には分かりません。
            （<a href="spec.html">この点は機械で検証しています</a>）</p>
        </Note>
      </Section>

      <Section tone="tint" navKey={file} heading="いただく情報">
        <Table
          headers={['お預かりするもの', 'いただく場所', '使い道']}
          rows={[
            ['お名前', 'お問い合わせフォーム', 'ご相談へのご返信'],
            ['お店・会社の名前', 'お問い合わせフォーム', 'ご相談へのご返信・お見積り'],
            ['業種', 'お問い合わせフォーム', 'お見積りの前提の確認'],
            ['お電話番号', 'お問い合わせフォーム・お電話', 'ご相談へのご返信'],
            ['メールアドレス', 'お問い合わせフォーム・メール', 'ご相談へのご返信'],
            ['ご相談の内容', 'お問い合わせフォーム', 'ご相談へのご返信・お見積り'],
          ]}
          caption="必須は、お名前・お電話番号・ご相談の内容の3つだけです。メールアドレスは、いただければメールでもご返信します。"
        />
      </Section>

      <Section heading="取り扱いの方針">
        <Table
          headers={['項目', '取り扱い']}
          rows={[
            ['利用目的', 'ご相談へのご返信、お見積りの作成、ご契約に至った場合の業務の遂行。<strong>これ以外には使いません。</strong>'],
            ['第三者への提供', '<strong>しません。</strong>名簿の売買・広告目的での共有は行いません。'],
            ['業務の委託', 'お問い合わせフォームの送信・保管に外部のサービスを使う場合があります。その場合も、利用目的の範囲を超えて扱わせません。'],
            ['保管の期間', 'ご契約に至らなかった場合は<strong>1年で削除します。</strong>ご契約中および契約終了後は、法令で定められた期間（帳簿等は7年）保管します。'],
            ['ご本人からのお求め', `内容の開示・訂正・削除・利用停止をお求めいただけます。お電話（${C.TEL}）かメール（${C.EMAIL}）でご連絡ください。${C.RESPONSE_PROMISE}にご返信します。`],
            ['安全の管理', 'お預かりした情報は、担当する2名以外がアクセスできない場所に保管します。端末には画面の自動ロックと暗号化を設定しています。'],
          ]}
        />
        <Note heading="メールでお送りいただく場合のお願い" kind="warn">
          <p>メールは、途中の経路で第三者に見られる可能性がゼロではありません。
            <strong>口座番号など、他人に知られて困る情報をメールでお送りになるのはお控えください。</strong>
            必要な場合は、お電話でお伺いします。</p>
        </Note>
      </Section>

      <Section tone="tint" heading="お問い合わせ先">
        <Table
          headers={['', '']}
          rows={[
            ['事業者', C.LEGAL_NAME],
            ['所在地', `〒${C.POSTAL_CODE} ${C.ADDRESS_REGION}${C.ADDRESS_CITY}${C.ADDRESS_STREET}`],
            ['お問い合わせ', `${C.TEL}（${C.TEL_HOURS}）／ ${C.EMAIL}`],
            ['改定', '内容を変えたときは、このページに掲載した時点から適用します。'],
          ]}
        />
      </Section>
    </Base>
  );
}
