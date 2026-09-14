import { ROUTES } from '@/routing/registry';
import { href } from '@/routing/registry';
import { format } from '@/i18n/format';
import * as C from '@/content/config';
import * as P from '@/content/prices';
import Base from '@/layouts/Base';
import Section from '@/components/Section';
import Stats from '@/components/Stats';
import Flow from '@/components/Flow';
import Table from '@/components/Table';
import Note from '@/components/Note';
import Acc from '@/components/Acc';
import Cta from '@/components/Cta';
import type { PageProps } from '@/content/page-props';

export default function FlowPage({ copy, route }: PageProps<'flow'>) {
  const file = ROUTES[route].file;
  const std = P.build('standard');
  const ways = C.LINE_URL ? copy.ways : copy.ways2;
  const title = format(copy.title, { stdWeeks: std.weeks, cBRANDT: C.BRAND_T });
  const desc = format(copy.desc, { stdWeeks: std.weeks }) + copy.desc2;

  return (
    <Base file={file} title={title} desc={desc}>
      <Section
        eyebrow={copy.eyebrow}
        heading={copy.heading}
        h1
        lede={format(copy.lede, { stdPages: std.pages, stdWeeks: std.weeks })}
      >
        <Stats
          items={[
            {
              icon: 'calendar-days',
              value: std.weeks,
              unit: copy.itemsUnit,
              label: copy.itemsLabel,
            },
            { icon: 'users', value: 2, unit: copy.itemsUnit2, label: copy.itemsLabel2 },
            { icon: 'list-checks', value: 20, unit: copy.itemsUnit3, label: copy.itemsLabel3 },
            {
              icon: 'repeat-2',
              value: P.run('run_basic').minutes,
              unit: copy.itemsUnit4,
              label: copy.itemsLabel4,
            },
          ]}
        />
      </Section>

      <Section tone="tint" navKey={file} heading={copy.heading2}>
        <Flow
          steps={[
            {
              title: copy.stepsTitle,
              desc: copy.stepsDesc,
              who: copy.stepsWho,
              when: copy.stepsWhen,
            },
            {
              title: copy.stepsTitle2,
              desc: copy.stepsDesc2,
              who: copy.stepsWho,
              when: copy.stepsWhen2,
            },
            {
              title: copy.stepsTitle3,
              desc: copy.stepsDesc3,
              who: copy.stepsWho2,
              when: copy.stepsWhen3,
              highlight: true,
            },
            {
              title: copy.stepsTitle4,
              desc: copy.stepsDesc4,
              who: copy.stepsWho,
              when: copy.stepsWhen4,
            },
            {
              title: copy.stepsTitle5,
              desc: copy.stepsDesc5,
              who: copy.stepsWho3,
              when: copy.stepsWhen5,
            },
            {
              title: copy.stepsTitle6,
              desc: copy.stepsDesc6,
              who: copy.stepsWho2,
              when: copy.stepsWhen6,
            },
            {
              title: copy.stepsTitle7,
              desc: copy.stepsDesc7,
              who: copy.stepsWho3,
              when: copy.stepsWhen5,
            },
            {
              title: copy.stepsTitle8,
              desc: copy.stepsDesc8,
              who: copy.stepsWho2,
              when: copy.stepsWhen3,
            },
            {
              title: copy.stepsTitle9,
              desc: copy.stepsDesc9,
              who: copy.stepsWho2,
              when: copy.stepsWhen3,
              highlight: true,
            },
            {
              title: copy.stepsTitle10,
              desc: format(copy.stepsDesc10, { ways: ways }),
              who: copy.stepsWho2,
              when: copy.stepsWhen7,
            },
          ]}
        />
        <p className="fine-note">
          {copy.fineNote}
          <strong>{copy.strong}</strong>
          {copy.fineNote2}
        </p>
        <Note heading={copy.heading3} kind="warn">
          <p>
            {copy.p}
            <strong>{copy.strong2}</strong>
            {copy.p2}
          </p>
        </Note>
      </Section>

      <Section eyebrow={copy.eyebrow2} heading={copy.heading4} lede={copy.lede2}>
        <Table
          headers={[copy.headers, copy.headers2]}
          rows={[
            [copy.rows, copy.rows2],
            [copy.rows3, copy.rows4],
            [copy.rows5, copy.rows6],
          ]}
          foot={copy.foot}
        />
        <div className="btns">
          <a className="btn btn-2" href={href('subsidy')}>
            {copy.btn}
          </a>
        </div>
      </Section>

      <Section eyebrow={copy.eyebrow3} heading={copy.heading5}>
        <Acc summary={copy.summary}>
          <p>
            {copy.p3}
            <strong>{copy.strong3}</strong>
            {copy.p4}
          </p>
        </Acc>
        <Acc summary={copy.summary2}>
          <p>{copy.p5}</p>
        </Acc>
        <Acc summary={copy.summary3}>
          <p>{format(copy.p6, { ways: ways, cRESPONSEPROMISE: C.RESPONSE_PROMISE })}</p>
        </Acc>
        <Acc summary={copy.summary4}>
          <p>
            {copy.p7}
            <strong>{copy.strong4}</strong>
            {copy.p8}
          </p>
        </Acc>
      </Section>

      <Section
        tone="dark"
        heading={copy.heading6}
        lede={format(copy.lede3, { cRESPONSEPROMISE: C.RESPONSE_PROMISE })}
      >
        <Cta primary={copy.primary} />
      </Section>
    </Base>
  );
}
