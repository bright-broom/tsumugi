import * as C from '@/content/config';
import { INDUSTRIES } from '@/content/nav';
import Base from '@/layouts/Base';
import Section from '@/components/Section';
import Note from '@/components/Note';
import Icon from '@/components/Icon';

export const config = { unstable_runtimeJS: false };

const file = 'contact.html';
const title = `相談する｜${C.BRAND_T}`;
const desc =
  `ご相談は無料です。${C.RESPONSE_PROMISE}にご返信します。お電話は${C.TEL}（${C.TEL_HOURS}）。`;

/** 送信先が未設定なら、送信ボタンは押せないままにする（押せて何も起きないより誠実） */
const disabled = !C.FORM_ENDPOINT;

export default function ContactPage() {
  return (
    <Base file={file} title={title} desc={desc}>
      <Section eyebrow="相談する" heading="ご相談は無料です" h1 navKey={file}
        lede={`ご相談は無料です。${C.RESPONSE_PROMISE}にご返信します。`}>
        <p>次の3つを聞かせていただければ、<strong>その場でだいたいの金額をお答えします。</strong></p>
        <ol className="steps">
          <li><b>いまホームページはありますか</b>
            <div className="d">ない／食べログやInstagramだけ／古いものがある、のどれでも構いません。</div></li>
          <li><b>いま掲載費や広告費をいくら払っていますか</b>
            <div className="d">おおよそで構いません。請求書があれば、それを見ながらのほうが早いです。</div></li>
          <li><b>いちばん困っていることは何ですか</b>
            <div className="d">新規が来ない／手数料が重い／更新できない／人が採れない、など。</div></li>
        </ol>
      </Section>

      <Section tone="tint" heading="連絡先">
        <h3>お電話</h3>
        <p><a className="tel" href={`tel:${C.TEL_LINK}`}><Icon name="phone" /><span className="t"
          ><span className="lbl">タップで発信</span><span className="num">{C.TEL}</span></span></a></p>
        <p>{`${C.TEL_HOURS}　／　この時間に出られないときは折り返します。`}</p>
        {C.LINE_URL && <p><a className="btn btn-2" href={C.LINE_URL}>LINEで相談する</a></p>}
        <h3>メール</h3>
        <p><a href={`mailto:${C.EMAIL}`}>{C.EMAIL}</a></p>
      </Section>

      <Section heading="フォームから">
        {disabled && (
          <Note heading="この見本ではフォームの送信先が未設定です" kind="warn">
            <p>src/content/config.ts の FORM_ENDPOINT に送信先を設定すると有効になります。
              設定と同時に、通知をメールとLINE（またはSMS）の2系統に分けます。</p>
          </Note>
        )}
        <form action={C.FORM_ENDPOINT || undefined} method={C.FORM_ENDPOINT ? 'post' : undefined}>
          <div className="field">
            <label htmlFor="f-name">お名前<span className="req">必須</span></label>
            <input type="text" id="f-name" name="name" required autoComplete="name" />
          </div>
          <div className="field">
            <label htmlFor="f-biz">お店・会社の名前</label>
            <input type="text" id="f-biz" name="business" autoComplete="organization" />
          </div>
          <div className="field">
            <label htmlFor="f-ind">業種</label>
            <select id="f-ind" name="industry"><option>選んでください</option>{
              INDUSTRIES.map(([u, n]) => <option key={u}>{n}</option>)
            }<option>その他</option></select>
          </div>
          <div className="field">
            <label htmlFor="f-tel">お電話番号<span className="req">必須</span></label>
            <input type="tel" id="f-tel" name="tel" required autoComplete="tel" inputMode="tel" />
            <p className="hint">お急ぎの場合は、こちらからお電話でご連絡します。</p>
          </div>
          <div className="field">
            <label htmlFor="f-mail">メールアドレス</label>
            <input type="email" id="f-mail" name="email" autoComplete="email" inputMode="email" />
          </div>
          <div className="field">
            <label htmlFor="f-msg">ご相談の内容<span className="req">必須</span></label>
            <textarea id="f-msg" name="message" required></textarea>
            <p className="hint">上の3つ（ホームページの有無／いまの掲載費・広告費／困っていること）に触れていただけると、
              1回のやりとりで概算までお答えできます。</p>
          </div>
          {disabled
            ? <button className="btn btn-1" type="submit" disabled>送信（未設定）</button>
            : <button className="btn btn-1" type="submit">送信する</button>}
        </form>
        <p className="dim">いただいた情報は、ご相談への回答とお見積りのためだけに使います。
          第三者に提供することはありません。</p>
      </Section>
    </Base>
  );
}
