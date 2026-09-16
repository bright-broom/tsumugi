import Figure from '@/components/Figure';
import { useMessages } from '@/components/ContentProvider';
import { format } from '@/i18n/format';
import {
  cap,
  MetricBand,
  ArrowLine,
  NW,
  c,
  type DiagramCopy,
} from '@/components/diagrams/primitives';

interface Amounts {
  total: number;
  web: number;
  pr: number;
  grant: number;
  net: number;
}
function Bands({
  copy,
  total,
  web,
  pr,
  grant,
  net,
  w,
}: Amounts & { copy: DiagramCopy; w: number }) {
  return (
    <>
      {cap(0, 18, format(copy.subsidyBarNarrowLabel1, { total: c(total) }), 14)}
      <MetricBand
        y={36}
        w={w}
        parts={[
          {
            value: web,
            title: copy.subsidyBarNarrowLabel2,
            amount: format(copy.subsidyBarLabel1, { web: c(web) }),
            icon: 'code-xml',
          },
          {
            value: pr,
            title: w < 400 ? copy.subsidyBarNarrowLabel4 : copy.subsidyBarLabel2,
            amount: format(copy.subsidyBarLabel3, { pr: c(pr) }),
            icon: 'camera',
          },
        ]}
      />
      <ArrowLine
        x1={w / 2}
        y1={160}
        x2={w / 2}
        y2={190}
        stroke="currentColor"
        strokeWidth="1.5"
        marker="neutral"
      />
      {cap(0, 222, copy.subsidyBarNarrowLabel6, 14)}
      <MetricBand
        y={240}
        w={w}
        parts={[
          {
            value: grant,
            title: copy.subsidyBarNarrowLabel7,
            amount: format(copy.subsidyBarLabel4, { grant: c(grant) }),
            icon: 'hand-coins',
            accent: true,
          },
          {
            value: net,
            title: copy.subsidyBarNarrowLabel9,
            amount: format(copy.subsidyBarLabel5, { net: c(net) }),
            icon: 'banknote',
          },
        ]}
      />
    </>
  );
}
export function SubsidyBar(props: Amounts) {
  const copy = useMessages('diagrams');
  const { total, web, pr, grant, net } = props;
  return (
    <Figure
      icons={['code-xml', 'camera', 'hand-coins', 'banknote']}
      arrows={['neutral']}
      wide={<Bands {...props} copy={copy} w={700} />}
      narrow={[<Bands key="narrow" {...props} copy={copy} w={NW} />, `0 0 ${NW} 362`]}
      caption={format(copy.subsidyBar, { total: c(total), net: c(net) })}
      label={format(copy.subsidyBar2, {
        total: c(total),
        web: c(web),
        pr: c(pr),
        grant: c(grant),
        net: c(net),
      })}
      viewBox="0 0 700 362"
    />
  );
}
