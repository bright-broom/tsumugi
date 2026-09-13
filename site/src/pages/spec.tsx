import { Fragment } from 'react';
import * as C from '../data/config';
import { SPEC_ITEMS, SPEC_GROUP_LEDE, NOT_SELLING } from '../data/spec';
import { ic } from '../lib/ic';
import { raw } from '../lib/raw';
import Base from '../layouts/Base';
import Section from '../components/Section';
import Table from '../components/Table';
import Note from '../components/Note';
import Stats from '../components/Stats';
import Acc from '../components/Acc';
import Cta from '../components/Cta';

export const config = { unstable_runtimeJS: false };

const file = 'spec.html';
const title = `納品する仕様｜${C.BRAND_T}`;
const desc =
  '調査で数字が出ている20項目だけを入れます。表示速度2.5秒以内を納品条件にし、' +
  '自動検証にかけています。売らないものも公開しています。';

// 挿入順を保ったままグループにまとめる
const groups: [string, typeof SPEC_ITEMS][] = [];
for (const it of SPEC_ITEMS) {
  const g = groups.find(([n]) => n === it.group);
  if (g) g[1].push(it); else groups.push([it.group, [it]]);
}
const lcpNum = C.LCP_MEASURED ? C.LCP_MEASURED.split('秒')[0]! : '—';

export default function SpecPage() {
  return (
    <Base file={file} title={title} desc={desc}>
      <Section eyebrow="納品する仕様" heading="作るものを、先に全部書きます" h1 navKey={file}
        lede="作るものを全部公開しています。<strong>数字が出ているものだけを入れます。</strong>">
        <Stats items={[
          { icon: 'list-checks', value: '20', unit: '項目', label: '全業種に共通する仕様' },
          { icon: 'gauge', value: lcpNum, unit: '秒', label: '表示速度の実測（基準2.5秒）' },
          { icon: 'code-xml', value: '0', unit: 'バイト', label: '実行時のJavaScript' },
          { icon: 'ban', value: '5', unit: '項目', label: '売らないと決めたもの' },
        ]} />
        <p style={{ marginTop: '20px' }}>20項目すべてを自動でチェックする仕組みを作り、
          <strong>1つでも落ちたら納品しません。</strong></p>
      </Section>

      <Section eyebrow="機械で検証しています" heading="全業種に共通する20項目">
        {groups.map(([grp, rows]) => (
          <Fragment key={grp}>
            <h3 className="grp">{grp}</h3>
            <p className="dim" style={{ fontSize: '14px' }}>{SPEC_GROUP_LEDE[grp]}</p>
            {rows.map((it) => (
              <Acc summary={it.title} key={it.title}><p dangerouslySetInnerHTML={raw(it.detail)} /></Acc>
            ))}
          </Fragment>
        ))}
      </Section>

      <Section tone="tint" heading="売らないもの">
        {NOT_SELLING.map(([n, r]) => <Acc summary={n} key={n}><p>{r}</p></Acc>)}
        <Note heading="同じ商品棚に並ばないことが、いちばんの違いです" kind="bad">
          <p>これらを売っている制作会社は実際にあります。
            根拠がないものを売らないと決めています。</p>
        </Note>
      </Section>

      <Section heading="このサイト自身の数字">
        <p>当方のこのサイトも、上の20項目で作って、同じ検証をかけています。</p>
        <Table headers={['#', '項目', 'このサイトの実測値']} rows={[
          [ic('gauge', 'ic-p'), '表示速度（最大要素の描画）',
            C.LCP_MEASURED ? `<strong class="tnum">${C.LCP_MEASURED}</strong>` : '（計測後に掲載します）'],
          [ic('image', 'ic-p'), '最初に見える要素', '画像を使わず文字にしています（いちばん速い作り）'],
          [ic('code-xml', 'ic-p'), '実行時のプログラム', 'ありません（0バイト）'],
          [ic('hand-coins', 'ic-p'), '押せる部分の大きさ', '44ピクセル四方以上'],
          [ic('map', 'ic-p'), '構造化データ', '設定済み（このページのソースで確認できます）'],
        ]} />
        <Note heading="自分のサイトで守っていないことは、お客様にもおすすめしません" kind="good">
          <p>このサイト自体が見本です。実行時のプログラムを使っていないので、
            ブラウザの「ページのソースを表示」で<strong>そのまま全部お読みいただけます。</strong>
            納品するサイトも同じ作りです（<a href="owned.html">なぜそうしているか</a>）。</p>
          <p><strong>「速いサイトを作ります」と言う会社のサイトが遅い、という状況は避けたい</strong>ので、
            数字を出しています。</p>
        </Note>
      </Section>

      <Section heading="ご相談は無料です"><Cta /></Section>
    </Base>
  );
}
