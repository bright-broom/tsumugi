import * as C from '@/content/config';
import Base from '@/layouts/Base';
import Section from '@/components/Section';
import Note from '@/components/Note';
import Cta from '@/components/Cta';

export const config = { unstable_runtimeJS: false };

const file = 'about.html';
const title = `私たちについて｜${C.BRAND_T}`;
const desc =
  `小規模事業者に絞って2人でやっています。全国対応。ご連絡から${C.RESPONSE_PROMISE}にご返信します。`;

export default function AboutPage() {
  return (
    <Base file={file} title={title} desc={desc}>
      <Section
        eyebrow="私たちについて"
        heading="2人でやっています"
        h1
        navKey={file}
        lede={`2人でやっています。<strong>地域は限定せず、小規模事業者に絞っています。</strong><br>${C.SERVICE_NOTE}`}
      />

      <Section>
        <div className="cards" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))' }}>
          {C.MEMBERS.map((m) => (
            <div className="card" key={m.name}>
              <div className="ttl">{m.name}</div>
              <div className="meta">{m.role}</div>
              <div className="desc">{m.bio}</div>
            </div>
          ))}
        </div>
        <Note heading="顔写真を載せます">
          <p>士業を選ぶときに最も重視される項目が「相談しやすさ・人柄・相性」だったという
            調査があります。これは制作会社を選ぶときにも同じだと思うので、
            <strong>顔と、何ができて何ができないかを出します。</strong></p>
        </Note>
      </Section>

      <Section tone="tint" eyebrow="お約束" heading={`${C.RESPONSE_PROMISE}にご返信します`}>
        <p>ご連絡をいただいてから<strong>{C.RESPONSE_PROMISE}</strong>にご返信します。</p>
        {C.RESPONSE_ACTUAL
          ? <p><strong>{`直近の実績：${C.RESPONSE_ACTUAL}`}</strong></p>
          : <p className="dim">実績値は計測を始めたら掲載します。測っていない数字は書きません。</p>}
        <Note heading="なぜ返答の速さを約束するのか">
          <p>米国で2,241社にテストの問い合わせを送った研究では、
            <strong>23%がそもそも返答せず、平均で42時間かかっていました。</strong>
            1時間以内に接触した企業は約7倍、見込み客になりやすいという結果が出ています。</p>
          <p>税理士を変えた理由の1位も「レスポンスの遅さ・相談しにくさ」（30%）でした。
            <strong>ホームページを作っても反響がない原因が、返答していないことだった</strong>
            というのは実際に起こります。まず自分たちが守ります。</p>
        </Note>
      </Section>

      <Section heading="仕事の進め方">
        <ul className="plain">
          <li><strong>できないことは、できないと申し上げます。</strong>
            「必ず集客できます」「必ず補助金が通ります」とは言いません。</li>
          <li><strong>やめるべきでないことは、やめないでくださいと申し上げます。</strong>
            ポータルサイトの掲載も、広告も、状況によっては続けたほうがいいです。</li>
          <li><strong>根拠のない施策は売りません。</strong>
            <a href="spec.html">売らないと決めているもの</a>を公開しています。</li>
          <li><strong>お客様が所有権を持てる形で作ります。</strong>
            ドメインの名義も、ソースコードも、写真の元データも、お客様のものにします。
            当方がいなくなっても事業は続くからです。
            <a href="owned.html">借地と所有のちがい</a>／<a href="source.html">納品の中身</a>。</li>
          <li><strong>数字は測って出します。</strong>
            表示速度も、作業時間も、返答の速さも、測ってから書きます。</li>
        </ul>
      </Section>

      <Section heading="ご相談は無料です"><Cta /></Section>
    </Base>
  );
}
