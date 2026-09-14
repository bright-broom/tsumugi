import { ROUTES } from '@/routing/registry';
import { href } from '@/routing/registry';
import { format } from '@/i18n/format';
import * as C from '@/content/config';
import * as P from '@/content/prices';
import * as D from '@/content/diagrams';
import Base from '@/layouts/Base';
import Section from '@/components/Section';
import Table from '@/components/Table';
import Note from '@/components/Note';
import Acc from '@/components/Acc';
import Cards from '@/components/Cards';
import Calc from '@/components/Calc';
import Figure from '@/components/Figure';
import Icon from '@/components/Icon';
import Cta from '@/components/Cta';
import type { PageProps } from '@/content/page-props';

export default function OwnedPage({ copy, route }: PageProps<'owned'>) {
  const file = ROUTES[route].file;
  const title = format(copy.title, { cBRANDT: C.BRAND_T });
  const desc = copy.desc + copy.desc2 + copy.desc3;
  const n = (v: number) => v.toLocaleString('en-US');

  return (
    <Base file={file} title={title} desc={desc}>
      <section className="hero">
        <div className="wrap">
          <p className="kick">
            <Icon name="key" sm />
            {copy.kick}
          </p>
          <h1>
            {copy.h1}
            <br />
            {copy.h12}
          </h1>
          <p className="sub">
            {copy.sub}
            <strong className="ownership-emphasis">{copy.strong}</strong>
            {copy.sub2}
          </p>
          <Cta />
        </div>
      </section>

      <Section
        tone="tint"
        navKey={file}
        eyebrow={copy.eyebrow}
        heading={copy.heading}
        lede={copy.lede}
      >
        <Figure svg={D.landVsOwn()} />
        <Table
          headers={[copy.headers, copy.headers2]}
          rows={[
            [copy.rows, copy.rows2],
            [copy.rows3, copy.rows4],
            [copy.rows5, copy.rows6],
            [copy.rows7, copy.rows8],
            [copy.rows9, copy.rows10],
          ]}
          foot={copy.foot}
        />
      </Section>

      <Section eyebrow={copy.eyebrow2} heading={copy.heading2} lede={copy.lede2}>
        <Table
          headers={['', copy.headers3, copy.headers4]}
          rows={[
            [copy.rows11, copy.rows12, copy.rows13],
            [copy.rows14, copy.rows15, copy.rows16],
            [copy.rows17, copy.rows18, copy.rows19],
          ]}
          foot={copy.foot2}
        />
        <Note heading={copy.heading3} kind="warn">
          <p>
            {copy.p}
            <strong>{copy.strong2}</strong>
            {copy.p2}
          </p>
        </Note>
      </Section>

      <Section tone="dark" eyebrow={copy.eyebrow3} heading={copy.heading4} lede={copy.lede3}>
        <Cards
          cls="g2"
          items={[
            { title: copy.itemsTitle, desc: copy.itemsDesc, link: [copy.itemsLink, href('terms')] },
            {
              title: copy.itemsTitle2,
              desc: copy.itemsDesc2,
              link: [copy.itemsLink2, href('source')],
            },
            {
              title: copy.itemsTitle3,
              desc: copy.itemsDesc3,
              link: [copy.itemsLink3, href('spec')],
            },
            {
              title: copy.itemsTitle4,
              desc: copy.itemsDesc4,
              link: [copy.itemsLink4, href('terms')],
            },
          ]}
        />
        <Table
          headers={['', copy.headers5, format(copy.headers6, { cBRAND: C.BRAND })]}
          rows={[
            [copy.rows20, copy.rows21, copy.rows22],
            [copy.rows23, copy.rows24, copy.rows25],
            [copy.rows26, copy.rows27, copy.rows28],
            [copy.rows29, copy.rows30, copy.rows31],
          ]}
          foot={copy.foot3}
        />
      </Section>

      <Section eyebrow={copy.eyebrow4} heading={copy.heading5} lede={copy.lede4}>
        <Table
          headers={[copy.headers7, copy.headers8, copy.headers9]}
          rows={[
            [copy.rows32, copy.rows33, '—'],
            [copy.rows34, copy.rows35, copy.rows36],
          ]}
          caption={copy.caption}
          foot={copy.foot4}
        />
        <Note heading={copy.heading6} kind="good">
          <p>
            <strong>{copy.strong3}</strong>
            {copy.p3}
          </p>
          <p>{copy.p4}</p>
        </Note>
        <Note heading={copy.heading7}>
          <p>
            {copy.p5}
            <strong>{copy.strong4}</strong>
            {copy.p6}
            <a href={href('spec')}>{copy.a}</a>
            {copy.p7}
          </p>
        </Note>
      </Section>

      <Section tone="tint" eyebrow={copy.eyebrow5} heading={copy.heading8} lede={copy.lede5}>
        <Calc
          title={copy.title2}
          rows={[
            { label: copy.rowsLabel, value: copy.rowsValue, cls: 'small', sub: copy.rowsSub },
            { label: copy.rowsLabel2, value: copy.rowsValue2, cls: 'small', sub: copy.rowsSub2 },
            {
              label: copy.rowsLabel3,
              value: format(copy.rowsValue3, { pRunRunLightPrice: n(P.run('run_light').price) }),
              cls: 'small',
              sub: copy.rowsSub3,
            },
          ]}
        />
        <Note heading={copy.heading9} kind="good">
          <p>
            {copy.p8}
            <strong>{copy.strong5}</strong>
          </p>
          <p>
            {copy.p9}
            <strong>{copy.strong6}</strong>
            {copy.p10}
          </p>
        </Note>
      </Section>

      <Section eyebrow={copy.eyebrow6} heading={copy.heading10} lede={copy.lede6}>
        <Acc summary={copy.summary}>
          <p>
            {copy.p11}
            <strong>{copy.strong7}</strong>
            {copy.p12}
          </p>
        </Acc>
        <Acc summary={copy.summary2}>
          <p>
            {copy.p13}
            <strong>{copy.strong8}</strong>
          </p>
        </Acc>
        <Acc summary={copy.summary3}>
          <p>
            {copy.p14}
            <strong>{copy.strong9}</strong>
            {copy.p15}
          </p>
        </Acc>
        <Acc summary={copy.summary4}>
          <p>
            {copy.p16}
            <strong>{copy.strong10}</strong>
            {copy.p17}
          </p>
        </Acc>
        <Acc summary={copy.summary5}>
          <p>
            {copy.p18}
            <strong>{copy.strong11}</strong>
            {copy.p19}
          </p>
        </Acc>
        <Acc summary={copy.summary6}>
          <p>
            {copy.p20}
            <strong>{copy.strong12}</strong>
            {copy.p21}
            <strong>{copy.strong13}</strong>
          </p>
        </Acc>
        <Note heading={copy.heading11} kind="good">
          <p>{copy.p22}</p>
          <p>
            {copy.p23}
            <strong>{copy.strong14}</strong>
            {copy.p24}
          </p>
        </Note>
      </Section>

      <Section eyebrow={copy.eyebrow7} heading={copy.heading12} lede={copy.lede7}>
        <Table
          headers={[copy.headers10, copy.headers11, copy.headers12]}
          rows={[
            ['1', copy.rows37, copy.rows38],
            ['2', copy.rows39, copy.rows40],
            ['3', copy.rows41, copy.rows42],
            ['4', copy.rows43, copy.rows42],
            ['5', copy.rows44, copy.rows45],
          ]}
          foot={copy.foot5}
        />
        <div className="btns">
          <a className="btn btn-2" href={href('flow')}>
            {copy.btn}
          </a>
        </div>
      </Section>

      <Section tone="dark" heading={copy.heading13} lede={copy.lede8}>
        <Cta primary={copy.primary} />
      </Section>
    </Base>
  );
}
