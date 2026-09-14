import type { GetStaticPaths, GetStaticProps } from 'next';
import * as C from '@/content/config';
import * as P from '@/content/prices';
import { IND_DATA } from '@/content/industries';
import { INDUSTRIES, IND_IC } from '@/content/nav';
import { esc, raw } from '@/lib/raw';
import Base from '@/layouts/Base';
import Section from '@/components/Section';
import Note from '@/components/Note';
import Icon from '@/components/Icon';
import Cta from '@/components/Cta';

export const config = { unstable_runtimeJS: false };

interface Props { slug: string }

export const getStaticPaths: GetStaticPaths = () => ({
  // 出力名は restaurant.html などにしたいので、.html を外した分を slug にする
  paths: Object.keys(IND_DATA).map((f) => ({ params: { industry: f.replace(/\.html$/, '') } })),
  fallback: false,
});

export const getStaticProps: GetStaticProps<Props, { industry: string }> = ({ params }) => ({
  props: { slug: params!.industry },
});

export default function IndustryPage({ slug }: Props) {
  const file = `${slug}.html`;
  const d = IND_DATA[file]!;
  const plan = P.build(d.plan);
  const run = P.RUN.find((r) => 'recommended' in r && r.recommended)!;
  const ins = P.INSTALLMENT[d.plan as keyof typeof P.INSTALLMENT];
  const others = INDUSTRIES.filter(([u]) => u !== file);

  const title = `${d.h1}｜${C.BRAND_T}`;
  const desc =
    `${d.name}に必要なページと、作らないものを公開しています。` +
    `${plan.name}（${plan.pages}ページ）${P.yen(plan.price)}から。` +
    '掲載費の見直しから一緒にやります。';

  return (
    <Base file={file} title={title} desc={desc}>
      <Section eyebrow={`${d.name}の方へ`} heading={d.h1} h1
        lede={`${d.name}のホームページに必要なものは、調査でかなりはっきりしています。<strong>必要なものだけを入れて、効かないものは作りません。</strong>`}>
        <p>{`ちなみに${d.name}のホームページ制作費の実際の発注額は、中央値で`}<strong>{d.median}</strong>
          です（846件の実発注データより）。</p>
      </Section>

      {/* 業種の話に入る前に、業種を問わない1番の主張を1枚はさむ */}
      <Section tone="tint">
        <Note heading="どの業種でも、作ったものはお客様のものです" kind="good">
          <p>ドメインは初日からお客様の名義で取ります。ソースコードも、
            撮影した写真の元データもお渡しします。<strong>やめても残ります。</strong></p>
          <p>月額制のホームページは、ここが逆になっていることがあります。
            土地でいえば借地に家を建てている状態で、地代を止めた日に更地になります。
            <a href="owned.html">借地と所有のちがい</a></p>
        </Note>
      </Section>

      <Section heading="必ず入れるもの">
        <ol className="steps">{d.must.map(([t, dd]) => (
          <li key={t}><b dangerouslySetInnerHTML={raw(t)} /><div className="d" dangerouslySetInnerHTML={raw(dd)} /></li>
        ))}</ol>
      </Section>

      <Section heading="やらないこと">
        <Note heading={`${d.name}では作らないもの`} kind="bad">
          <ul className="plain">{d.skip.map(([t, dd]) => (
            <li key={t} dangerouslySetInnerHTML={raw(`<strong>${esc(t)}</strong><br>${dd}`)} />
          ))}</ul>
        </Note>
      </Section>

      <Section eyebrow="財源" heading="新しい予算をつくる前に、いまの費用を見ます">
        <p dangerouslySetInnerHTML={raw(d.cost)} />
        <div className="btns"><a className="btn btn-2" href="cost-cut.html">掲載費の見直しについて</a></div>
      </Section>

      <Section heading="おすすめのプラン">
        <p>{`${d.name}には`}<strong>{`${plan.name}（${plan.pages}ページ）`}</strong>をおすすめしています。</p>
        <div className="ledger">
          <div className="hd">{`${plan.name} ＋ 運用${run.name}`}</div>
          <div className="row"><span>買い切りの場合</span><span className="v tnum">{P.yen(plan.price)}</span></div>
          <div className="row"><span>分割の場合（初回）</span><span className="v tnum">{P.yen(ins.initial)}</span></div>
          <div className="row"><span>{`分割の場合（月額×${P.INSTALLMENT_COUNT}回）`}</span><span className="v tnum">{P.yen(ins.monthly)}</span></div>
          <div className="row"><span>運用（月額）</span><span className="v tnum">{P.yen(run.price)}</span></div>
          <div className="row net"><span>分割なら毎月</span><span className="v tnum">{P.yen(ins.monthly + run.price)}</span></div>
        </div>
        <p className="dim">税別。分割の手数料は0円で、総額は買い切りと同じです。</p>
        <div className="btns">
          <a className="btn btn-2" href="price.html">料金の詳細</a>
          <a className="btn btn-2" href="subsidy.html">補助金を使う場合</a>
        </div>
      </Section>

      <Section heading="ほかの業種">
        <div className="cq"><div className="inds">{others.map(([u, nm, dd]) => (
          <a className="ind" href={u} key={u}>
            <span className="n"><Icon name={IND_IC[u]!} sm />{nm}</span>
            <span className="p">{dd}</span>
          </a>
        ))}</div></div>
      </Section>

      <Section heading="ご相談は無料です"><Cta /></Section>
    </Base>
  );
}
