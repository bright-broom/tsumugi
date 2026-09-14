import { LCP_SECONDS } from '@/content/measurements';
import { ROUTES } from '@/routing/registry';
import { href } from '@/routing/registry';
import { format } from '@/i18n/format';
import { Fragment } from 'react';
import * as C from '@/content/config';
import { SPEC_ITEMS, SPEC_GROUP_LEDE, NOT_SELLING } from '@/content/spec';
import { ic } from '@/lib/ic';
import { raw } from '@/lib/raw';
import Base from '@/layouts/Base';
import Section from '@/components/Section';
import Table from '@/components/Table';
import Note from '@/components/Note';
import Stats from '@/components/Stats';
import Acc from '@/components/Acc';
import Cta from '@/components/Cta';
import type { PageProps } from '@/content/page-props';

export default function SpecPage({ copy, route }: PageProps<'spec'>) {
  const file = ROUTES[route].file;
  const title = format(copy.title, { cBRANDT: C.BRAND_T });
  const desc = copy.desc + copy.desc2;
  const groups: [string, typeof SPEC_ITEMS][] = [];
  for (const it of SPEC_ITEMS) {
    const g = groups.find(([n]) => n === it.group);
    if (g) g[1].push(it);
    else groups.push([it.group, [it]]);
  }
  const lcpNum = LCP_SECONDS.toFixed(2);

  return (
    <Base file={file} title={title} desc={desc}>
      <Section eyebrow={copy.eyebrow} heading={copy.heading} h1 navKey={file} lede={copy.lede}>
        <Stats
          items={[
            { icon: 'list-checks', value: '20', unit: copy.itemsUnit, label: copy.itemsLabel },
            { icon: 'gauge', value: lcpNum, unit: copy.lcpNum, label: copy.itemsLabel2 },
            { icon: 'code-xml', value: '0', unit: copy.itemsUnit2, label: copy.itemsLabel3 },
            { icon: 'ban', value: '5', unit: copy.itemsUnit, label: copy.itemsLabel4 },
          ]}
        />
        <p style={{ marginTop: '20px' }}>
          {copy.p}
          <strong>{copy.strong}</strong>
        </p>
      </Section>

      <Section eyebrow={copy.eyebrow2} heading={copy.heading2}>
        {groups.map(([grp, rows]) => (
          <Fragment key={grp}>
            <h3 className="grp">{grp}</h3>
            <p className="dim" style={{ fontSize: '14px' }}>
              {SPEC_GROUP_LEDE[grp]}
            </p>
            {rows.map((it) => (
              <Acc summary={it.title} key={it.title}>
                <p dangerouslySetInnerHTML={raw(it.detail)} />
              </Acc>
            ))}
          </Fragment>
        ))}
      </Section>

      <Section tone="tint" heading={copy.heading3}>
        {NOT_SELLING.map(([n, r]) => (
          <Acc summary={n} key={n}>
            <p>{r}</p>
          </Acc>
        ))}
        <Note heading={copy.heading4} kind="bad">
          <p>{copy.p2}</p>
        </Note>
      </Section>

      <Section heading={copy.heading5}>
        <p>{copy.p3}</p>
        <Table
          headers={['#', copy.itemsUnit, copy.headers]}
          rows={[
            [
              ic('gauge', 'ic-p'),
              copy.rows,
              C.LCP_MEASURED ? `<strong class="tnum">${C.LCP_MEASURED}</strong>` : copy.rows2,
            ],
            [ic('image', 'ic-p'), copy.rows3, copy.rows4],
            [ic('code-xml', 'ic-p'), copy.rows5, copy.rows6],
            [ic('hand-coins', 'ic-p'), copy.rows7, copy.rows8],
            [ic('map', 'ic-p'), copy.rows9, copy.rows10],
          ]}
        />
        <Note heading={copy.heading6} kind="good">
          <p>
            {copy.p4}
            <strong>{copy.strong2}</strong>
            {copy.p5}
            <a href={href('owned')}>{copy.a}</a>
            {copy.p6}
          </p>
          <p>
            <strong>{copy.strong3}</strong>
            {copy.p7}
          </p>
        </Note>
      </Section>

      <Section heading={copy.heading7}>
        <Cta />
      </Section>
    </Base>
  );
}
