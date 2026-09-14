import { ROUTES } from '@/routing/registry';
import { format } from '@/i18n/format';
import * as C from '@/content/config';
import * as P from '@/content/prices';
import Base from '@/layouts/Base';
import Section from '@/components/Section';
import Acc from '@/components/Acc';
import Cta from '@/components/Cta';
import type { PageProps } from '@/content/page-props';

export default function FaqPage({ copy, route }: PageProps<'faq'>) {
  const file = ROUTES[route].file;
  const title = format(copy.title, { cBRANDT: C.BRAND_T });
  const desc = copy.desc + copy.desc2;
  const mStd = P.run('run_basic').price;
  const stdPrice = P.build('standard').price;
  const n = (v: number) => v.toLocaleString('en-US');
  const GROUPS: [string, [string, string][]][] = [
    [
      copy.group,
      [
        [copy.group2, format(copy.group3, { mStd: n(mStd) })],
        [
          copy.group4,
          format(copy.group5, {
            deposit: n(P.paymentSchedule(stdPrice).deposit),
            stdPrice: n(stdPrice),
          }),
        ],
        [copy.group6, format(copy.group7, { pSINGLEPrice: n(P.SINGLE.price) })],
        [
          copy.group8,
          format(copy.group9, {
            pCOMPAREMONTHS: P.COMPARE_MONTHS,
          }),
        ],
        [copy.group10, `<p>${copy.group11}<strong>${copy.group12}</strong>${copy.group13}</p>`],
        [copy.group14, format(copy.group15, { pOPTIONS0Price: n(P.OPTIONS[0].price) })],
        [copy.group16, `<p>${copy.group17}</p>`],
      ],
    ],
    [
      copy.group18,
      [
        [
          copy.group19,
          `<p><strong>${copy.group20}</strong>${copy.group21}<a href='owned.html'>${copy.group22}</a>${copy.group23}</p>`,
        ],
        [
          copy.group24,
          `<p>${copy.group25}<strong>${copy.group26}</strong>${copy.group27}<strong>${copy.group28}</strong>${copy.group29}</p>` +
            `<p>${copy.group30}</p>` +
            `<p>${copy.group31}<strong>${copy.group32}</strong>${copy.group33}<a href='owned.html'>${copy.group34}</a>${copy.group23}</p>`,
        ],
        [copy.group35, format(copy.group36, { pRUNTERM: P.RUN_TERM })],
        [
          copy.group37,
          `<p>${copy.group38}<a href='source.html'>${copy.group39}</a>${copy.group23}</p>`,
        ],
        [copy.group40, `<p>${copy.group41}<strong>${copy.group42}</strong>${copy.group43}</p>`],
        [copy.group44, `<p>${copy.group45}<strong>${copy.group46}</strong>${copy.group47}</p>`],
      ],
    ],
    [
      copy.group48,
      [
        [
          copy.group49,
          `<p>${copy.group50}<a href='spec.html'>${copy.group51}</a>${copy.group52}</p>`,
        ],
        [copy.group53, `<p>${copy.group54}<strong>${copy.group55}</strong>${copy.group56}</p>`],
        [copy.group57, `<p>${copy.group58}<strong>${copy.group59}</strong>${copy.group60}</p>`],
        [copy.group61, `<p>${copy.group62}<strong>${copy.group63}</strong>${copy.group64}</p>`],
        [copy.group65, `<p>${copy.group66}<strong>${copy.group67}</strong>${copy.group68}</p>`],
      ],
    ],
    [
      copy.group69,
      [
        [
          copy.group70,
          `<p><strong>${copy.group71}</strong>${copy.group72}<strong>${copy.group73}</strong>${copy.group74}</p>`,
        ],
        [copy.group75, `<p>${copy.group76}<strong>${copy.group77}</strong>${copy.group78}</p>`],
        [
          copy.group79,
          `<p><strong>${copy.group80}</strong>${copy.group81}<a href='cost-cut.html'>${copy.group82}</a>${copy.group23}</p>`,
        ],
        [copy.group83, `<p><strong>${copy.group84}</strong>${copy.group85}</p>`],
      ],
    ],
    [
      copy.group86,
      [
        [copy.group87, format(copy.group88, { pSUBSIDYAdoptionRate: P.SUBSIDY.adoption_rate })],
        [copy.group89, `<p>${copy.group90}<strong>${copy.group91}</strong>${copy.group92}</p>`],
        [
          copy.group93,
          `<p><strong>${copy.group94}</strong>${copy.group95}<a href='subsidy.html'>${copy.group96}</a>${copy.group23}</p>`,
        ],
      ],
    ],
    [
      copy.group97,
      [
        [copy.group98, format(copy.group99, { cAREA: C.AREA, cSERVICENOTE: C.SERVICE_NOTE })],
        [
          copy.group100,
          `<p>${copy.group101}<a href='about.html'>${copy.group102}</a>${copy.group23}<strong>${copy.group103}</strong></p>`,
        ],
        [
          copy.group104,
          `<p><strong>${copy.group105}</strong>${copy.group106}<a href='works.html'>${copy.group107}</a>${copy.group108}</p>`,
        ],
        [copy.group109, `<p>${copy.group110}<strong>${copy.group111}</strong></p>`],
      ],
    ],
  ];

  return (
    <Base file={file} title={title} desc={desc}>
      <Section eyebrow={copy.eyebrow} heading={copy.heading} h1 navKey={file} lede={copy.lede} />

      {GROUPS.map(([h, qa]) => (
        <Section heading={h} key={h}>
          {qa.map(([q, a]) => (
            <Acc summary={q} html={a} key={q} />
          ))}
        </Section>
      ))}

      <Section
        tone="dark"
        heading={copy.heading2}
        lede={format(copy.lede2, { cRESPONSEPROMISE: C.RESPONSE_PROMISE })}
      >
        <Cta primary={copy.primary} />
      </Section>
    </Base>
  );
}
