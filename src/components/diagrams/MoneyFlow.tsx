import Figure from '@/components/Figure';
import { useMessages } from '@/components/ContentProvider';
import { format } from '@/i18n/format';
import { rnd } from '@/lib/round';
import {
  cap,
  BOX_F,
  BOX_S,
  DIM,
  ArrowLine,
  NW,
  NARROW_MIN_TEXT,
  c,
  type Narrow,
  type DiagramCopy,
} from '@/components/diagrams/primitives';

function moneyFlowNarrow(copy: DiagramCopy, portal: number, run: number): Narrow {
  const rest = portal - run;
  const w1 = rnd((NW * run) / portal);
  const s = (
    <>
      {cap(0, 12, copy.moneyFlowNarrowLabel1, NARROW_MIN_TEXT)}
      <rect x="0" y="22" width={NW} height="48" rx="8" {...BOX_F} {...BOX_S} />
      <text
        x={NW / 2}
        y="52"
        textAnchor="middle"
        fontSize="14"
        fontWeight="700"
        fill="currentColor"
      >
        {format(copy.moneyFlowNarrowLabel2, { portal: c(portal) })}
      </text>
      <ArrowLine
        x1={NW / 2}
        y1="78"
        x2={NW / 2}
        y2="108"
        stroke="var(--fig-accent)"
        strokeWidth="1.6"
        marker="accent"
      />
      <text x={NW / 2} y="130" textAnchor="middle" fontSize={NARROW_MIN_TEXT} {...DIM}>
        {copy.moneyFlowNarrowLabel3}
      </text>
      {cap(0, 158, copy.moneyFlowNarrowLabel4, NARROW_MIN_TEXT)}
      <rect x="0" y="168" width={w1 - 4} height="48" rx="8" {...BOX_F} {...BOX_S} />
      <text
        x={w1 / 2 - 2}
        y="190"
        textAnchor="middle"
        fontSize={NARROW_MIN_TEXT}
        fontWeight="700"
        fill="currentColor"
      >
        {copy.moneyFlowNarrowLabel5}
      </text>
      <text
        x={w1 / 2 - 2}
        y="206"
        textAnchor="middle"
        fontSize={NARROW_MIN_TEXT}
        fontWeight="700"
        fill="currentColor"
      >
        {format(copy.moneyFlowNarrowLabel6, { run: c(run) })}
      </text>
      <rect
        x={w1}
        y="168"
        width={NW - w1}
        height="48"
        rx="8"
        fill="var(--fig-ok)"
        fillOpacity=".11"
        stroke="var(--fig-ok)"
        strokeWidth="1.6"
      />
      <text
        x={w1 + (NW - w1) / 2}
        y="190"
        textAnchor="middle"
        fontSize={NARROW_MIN_TEXT}
        fontWeight="700"
        fill="var(--fig-ok)"
      >
        {copy.moneyFlowNarrowLabel7}
      </text>
      <text
        x={w1 + (NW - w1) / 2}
        y="206"
        textAnchor="middle"
        fontSize={NARROW_MIN_TEXT}
        fontWeight="700"
        fill="var(--fig-ok)"
      >
        {format(copy.moneyFlowNarrowLabel8, { rest: c(rest) })}
      </text>
    </>
  );
  return [s, `0 0 ${NW} 226`];
}

export function MoneyFlow({ portal, run }: { portal: number; run: number }) {
  const copy = useMessages('diagrams');
  const rest = portal - run;
  const x = 78,
    w = 602;
  const w1 = rnd((w * run) / portal);
  const s = (
    <>
      {cap(0, 58, copy.moneyFlowNarrowLabel1)}
      <rect x={x} y="26" width={w} height="50" rx="8" {...BOX_F} {...BOX_S} />
      <text
        x={x + w / 2}
        y="57"
        textAnchor="middle"
        fontSize="15"
        fontWeight="700"
        fill="currentColor"
      >
        {format(copy.moneyFlowLabel1, { portal: c(portal) })}
      </text>
      <ArrowLine
        x1={x + w / 2}
        y1="84"
        x2={x + w / 2}
        y2="112"
        stroke="var(--fig-accent)"
        strokeWidth="1.6"
        marker="accent"
      />
      <text x={x + w / 2 + 12} y="106" fontSize="12" {...DIM}>
        {copy.moneyFlowLabel2}
      </text>
      {cap(0, 156, copy.moneyFlowNarrowLabel4)}
      <rect x={x} y="124" width={w1 - 5} height="50" rx="8" {...BOX_F} {...BOX_S} />
      <text
        x={x + w1 / 2 - 2}
        y="155"
        textAnchor="middle"
        fontSize="15"
        fontWeight="700"
        fill="currentColor"
      >
        {format(copy.moneyFlowLabel3, { run: c(run) })}
      </text>
      <rect
        x={x + w1}
        y="124"
        width={w - w1}
        height="50"
        rx="8"
        fill="var(--fig-ok)"
        fillOpacity=".11"
        stroke="var(--fig-ok)"
        strokeWidth="1.6"
      />
      <text
        x={x + w1 + (w - w1) / 2}
        y="155"
        textAnchor="middle"
        fontSize="15"
        fontWeight="700"
        fill="var(--fig-ok)"
      >
        {format(copy.moneyFlowLabel4, { rest: c(rest) })}
      </text>
    </>
  );
  return (
    <Figure
      arrows={['accent']}
      wide={s}
      caption={format(copy.moneyFlow, { portal: c(portal), run: c(run), rest: c(rest) })}
      label={format(copy.moneyFlow2, { portal: c(portal), run: c(run), rest: c(rest) })}
      viewBox="0 0 700 192"
      narrow={moneyFlowNarrow(copy, portal, run)}
    />
  );
}
