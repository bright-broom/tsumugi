import * as C from '../data/config';
import Base from '../layouts/Base';
import Section from '../components/Section';
import Cta from '../components/Cta';

export const config = { unstable_runtimeJS: false };

const file = '404.html';
const title = `ページが見つかりません｜${C.BRAND_T}`;
const desc =
  'お探しのページは移動したか、なくなっています。' +
  'トップページか、お電話からお探しの内容にお進みください。';

export default function NotFoundPage() {
  return (
    <Base file={file} title={title} desc={desc}>
      <Section heading="ページが見つかりません" h1
        lede="お探しのページは移動したか、なくなっています。<br>お急ぎでしたら、お電話が確実です。">
        <Cta primary="トップに戻る" where="index.html" />
      </Section>
    </Base>
  );
}
