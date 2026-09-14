import { ROUTES } from '@/routing/registry';
import { format } from '@/i18n/format';
import * as C from '@/content/config';
import * as P from '@/content/prices';
import Base from '@/layouts/Base';
import Section from '@/components/Section';
import Table from '@/components/Table';
import type { PageProps } from '@/content/page-props';

export default function LegalPage({ copy, route }: PageProps<'legal'>) {
  const file = ROUTES[route].file;
  const title = format(copy.title, { cBRANDT: C.BRAND_T });
  const desc = copy.desc + copy.desc2;
  const basic = P.build('basic');
  const pro = P.build('pro');
  const yen = (n: number) => n.toLocaleString('en-US');
  const rows: [string, string][] = [
    [copy.rows, C.LEGAL_NAME],
    [copy.rows2, C.MEMBERS[0]!.name],
    [
      copy.rows3,
      format(copy.rows4, {
        cPOSTALCODE: C.POSTAL_CODE,
        cADDRESSREGION: C.ADDRESS_REGION,
        cADDRESSCITY: C.ADDRESS_CITY,
        cADDRESSSTREET: C.ADDRESS_STREET,
      }),
    ],
    [copy.rows5, format(copy.rows6, { cTEL: C.TEL, cTELHOURS: C.TEL_HOURS })],
    [copy.rows7, C.EMAIL],
    [
      copy.rows8,
      format(copy.rows9, { yenBasicPrice: yen(basic.price), yenProPrice: yen(pro.price) }) +
        format(copy.rows10, {
          yenPRunRunLightPrice: yen(P.run('run_light').price),
          yenPRunRunGrowthPrice: yen(P.run('run_growth').price),
        }) +
        copy.rows11,
    ],
    [copy.rows12, copy.rows13 + copy.rows14],
    [copy.rows15, copy.rows16],
    [
      copy.rows17,
      copy.rows18 + format(copy.rows19, { pINSTALLMENTCOUNT: P.INSTALLMENT_COUNT }) + copy.rows20,
    ],
    [
      copy.rows21,
      format(copy.rows22, { basicWeeks: basic.weeks, proWeeks: pro.weeks }) + copy.rows23,
    ],
    [copy.rows24, copy.rows25 + copy.rows26 + copy.rows27 + copy.rows28],
    [copy.rows29, format(copy.rows30, { pRUNTERM: P.RUN_TERM })],
    [copy.rows31, copy.rows32 + copy.rows33],
  ];

  return (
    <Base file={file} title={title} desc={desc}>
      <Section heading={copy.heading} h1 lede={copy.lede}>
        <Table headers={['', '']} rows={rows} />
      </Section>
    </Base>
  );
}
