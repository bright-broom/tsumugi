import * as C from '../data/config';
import Base from '../layouts/Base';
import Section from '../components/Section';
import Table from '../components/Table';
import Note from '../components/Note';
import Cta from '../components/Cta';

export const config = { unstable_runtimeJS: false };

const file = 'source.html';
const title = `ソースコードの納品｜${C.BRAND_T}`;
const desc =
  'ホームページのソースコード一式をお渡しします。GitHubに閲覧権限でご招待し、' +
  'アカウントの作り方からお手伝いします。ドメインは最初からお客様の名義です。';

export default function SourcePage() {
  return (
    <Base file={file} title={title} desc={desc}>
      <Section eyebrow="ソースコードの納品" heading="作ったものは、全部お渡しします" h1
        lede="ホームページの中身のプログラム（ソースコード）を、お客様にお渡しします。<strong>使わなくても構いません。</strong>当方と何かあったときに、他の会社がそのまま引き継げるという意味です。" />

      <Section heading="具体的に何をお渡しするか">
        <Table headers={['お渡しするもの', '内容']} rows={[
          ['ソースコード一式', 'HTML・CSS・画像・設定ファイルのすべて'],
          ['GitHubの閲覧権限', 'GitHubというプログラムの保管場所に、お客様のアカウントをご招待します'],
          ['引き継ぎの手順書', '構成・更新のしかた・公開のしかたを日本語で書いたものを同梱します'],
          ['ドメイン', '<strong>最初からお客様の名義で取得します。</strong>当方の名義にはしません'],
        ]} />
        <Note heading="GitHubのアカウントは、作り方からお手伝いします" kind="good">
          <p>GitHubを使ったことがなくて当然です。アカウントの作成から、
            中の見かたまで、納品の作業の一部としてご一緒します。追加料金はいただきません。</p>
          <p>そのあと使わなくても問題ありません。<strong>「いつでも取り出せる状態にある」</strong>
            ことが目的です。</p>
        </Note>
      </Section>

      <Section tone="tint" eyebrow="なぜお渡しするのか" heading="預けたままにしておくと、こうなります">
        <p>ホームページを他社に預けたままにしておくと、こういうことが起こります。</p>
        <Table headers={['起きたこと', '内容']} rows={[
          ['Googleが無料サイトを止めた',
            'Googleは<strong>2024年3月に、自社が提供していた無料のホームページ機能を停止</strong>しました。' +
            '同年6月10日には転送も終了し、それまでのURLは「ページが見つかりません」になりました。' +
            'これは予想ではなく、実際に起きたことです。'],
          ['解約したら消える契約になっている',
            '月額制のサービスでは、解約するとホームページが非公開になる、' +
            '削除か買い取りかを選ばされる、移管に手数料がかかる、といった条件が実際にあります。' +
            '契約書に書かれているので違法ではありませんが、<strong>知らずに契約している方が多いです。</strong>'],
          ['ドメインが制作会社の名義になっている',
            'この場合、解約するとドメインごと使えなくなります。名刺やチラシに印刷したURLが死にます。'],
        ]} />
        <Note heading="だから、最初からお客様のものにしておきます">
          <p>当方がいなくなっても、事業は続きます。
            <strong>そのときに困らない形で納品するのが、まともな仕事だと考えています。</strong></p>
        </Note>
      </Section>

      <Section eyebrow="技術的な設計" heading="どう渡すか">
        <Table headers={['項目', '当方のやり方', '理由']} rows={[
          ['権限', '<strong>閲覧（読み取り）権限でご招待します</strong>',
            '書き込み権限だと、操作を誤ってプログラムが壊れることがあります。' +
            '見ること・コピーすることはできます。お客様の管理下に移すこともできます'],
          ['保護設定', '主要な部分への直接の書き換えを禁止しておきます', '事故を防ぐためです。納品時に設定します'],
          ['パスワード類', 'プログラムの中には入れません（別管理にします）',
            'お客様をご招待するので、履歴に残ると取り消せなくなります'],
          ['手順書', '日本語で、構成・更新・公開の手順を書きます',
            'プログラムだけ渡されても引き継げません。<strong>ここが実質的な価値です</strong>'],
        ]} />
        <Note heading="技術的な話が不要な方へ">
          <p>ここは、あとで別の会社に見せたときに「ちゃんとしている」と言ってもらうための部分です。
            お客様が理解する必要はありません。
            <strong>「預けっぱなしになっていない」ということだけ覚えておいてください。</strong></p>
        </Note>
      </Section>

      <Section heading="ご相談は無料です"><Cta /></Section>
    </Base>
  );
}
