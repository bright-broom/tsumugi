import Figure from '@/components/Figure';
import { useMessages } from '@/components/ContentProvider';
import { format } from '@/i18n/format';
import {
  cap,
  MetricBand,
  DiagramIcon,
  ArrowLine,
  DIM,
  NW,
  c,
  type DiagramCopy,
} from '@/components/diagrams/primitives';

function Flow({
  copy,
  portal,
  run,
  w,
}: {
  copy: DiagramCopy;
  portal: number;
  run: number;
  w: number;
}) {
  return (
    <>
      {cap(0, 18, copy.moneyFlowNarrowLabel1, 14)}
      <MetricBand
        y={34}
        w={w}
        parts={[
          {
            value: portal,
            title: copy.monthlyListing,
            amount: format(copy.moneyFlowNarrowLabel6, { run: c(portal) }),
            icon: 'receipt',
          },
        ]}
      />
      <ArrowLine
        x1={w / 2}
        y1={160}
        x2={w / 2}
        y2={186}
        stroke="var(--fig-accent)"
        strokeWidth="1.5"
        marker="accent"
      />
      <text x={w / 2} y={214} textAnchor="middle" {...DIM}>
        {copy.moneyFlowNarrowLabel3}
      </text>
      <DiagramIcon name="repeat-2" x={0} y={243} size={20} />
      {cap(30, 258, copy.moneyFlowNarrowLabel4, 14)}
      <MetricBand
        y={276}
        w={w}
        parts={[
          {
            value: run,
            title: copy.moneyFlowNarrowLabel5,
            amount: format(copy.moneyFlowNarrowLabel6, { run: c(run) }),
            icon: 'shield',
          },
          {
            value: portal - run,
            title: copy.moneyFlowNarrowLabel7,
            amount: format(copy.moneyFlowNarrowLabel8, { rest: c(portal - run) }),
            icon: 'trending-down',
            accent: true,
          },
        ]}
      />
    </>
  );
}
export function MoneyFlow({ portal, run }: { portal: number; run: number }) {
  const copy = useMessages('diagrams');
  const props = { copy, portal, run };
  const amounts = { portal: c(portal), run: c(run), rest: c(portal - run) };
  return (
    <Figure
      icons={['receipt', 'repeat-2', 'shield', 'trending-down']}
      arrows={['accent']}
      wide={<Flow {...props} w={700} />}
      narrow={[<Flow key="narrow" {...props} w={NW} />, `0 0 ${NW} 398`]}
      caption={format(copy.moneyFlow, amounts)}
      label={format(copy.moneyFlow2, amounts)}
      viewBox="0 0 700 398"
    />
  );
}
