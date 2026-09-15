import Figure from '@/components/Figure';
import { useMessages } from '@/components/ContentProvider';
import type { ReactNode } from 'react';
import { format } from '@/i18n/format';
import {
  cap,
  BOX_F,
  BOX_S,
  DIM,
  NW,
  c,
  type DiagramCopy,
  type Narrow,
} from '@/components/diagrams/primitives';

function ownershipClockNarrow(
  copy: DiagramCopy,
  subMonthly: number,
  subTotal: number,
  ourPrice: number,
  months: number,
): Narrow {
  const track = (y: number, atEnd: boolean) => {
    const col = 'var(--fig-ok)';
    const fx = atEnd ? NW - 6 : 6;
    const d = atEnd ? -20 : 20;
    return (
      <>
        <rect x="0" y={y} width={NW} height="10" rx="5" {...BOX_F} {...BOX_S} />
        <circle cx={fx} cy={y + 5} r="5.5" fill={col} />
        <line x1={fx} y1={y + 5} x2={fx} y2={y - 22} stroke={col} strokeWidth="2.2" />
        <path d={`M${fx} ${y - 22} L${fx + d} ${y - 17} L${fx} ${y - 12} z`} fill={col} />
      </>
    );
  };
  const s = (
    <>
      {cap(0, 14, copy.ownershipClockNarrowLabel1)}
      <rect x="0" y="24" width={NW} height="48" rx="8" {...BOX_F} {...BOX_S} />
      <text x="16" y="45" fontSize="13.5" fontWeight="700" fill="currentColor">
        {format(copy.ownershipClockNarrowLabel2, { subMonthly: c(subMonthly), months: months })}
      </text>
      <text x="16" y="63" fontSize="12.5" {...DIM}>
        {format(copy.ownershipClockNarrowLabel3, { subTotal: c(subTotal) })}
      </text>
      <text x={NW} y="84" textAnchor="end" fontSize="12.5" fontWeight="700" fill="var(--fig-ok)">
        {copy.ownershipClockNarrowLabel4}
      </text>
      {track(112, true)}
      <text x="0" y="148" fontSize="12.5" fontWeight="700" fill="var(--fig-bad)">
        {copy.ownershipClockNarrowLabel5}
      </text>
      {cap(0, 196, copy.ownershipClockNarrowLabel6)}
      <rect
        x="0"
        y="206"
        width={NW}
        height="48"
        rx="8"
        fill="var(--fig-accent)"
        fillOpacity=".08"
        stroke="var(--fig-accent)"
        strokeWidth="2"
      />
      <text x="16" y="227" fontSize="13.5" fontWeight="700" fill="currentColor">
        {format(copy.ownershipClockNarrowLabel7, { ourPrice: c(ourPrice) })}
      </text>
      <text x="16" y="245" fontSize="12.5" {...DIM}>
        {copy.ownershipClockNarrowLabel8}
      </text>
      <text x="0" y="266" fontSize="12.5" fontWeight="700" fill="var(--fig-ok)">
        {copy.ownershipClockNarrowLabel9}
      </text>
      {track(294, false)}
      <text x="0" y="330" fontSize="12.5" fontWeight="700" fill="var(--fig-ok)">
        {copy.ownershipClockNarrowLabel10}
      </text>
    </>
  );
  return [s, `0 0 ${NW} 342`];
}

const flag = (x: number, y: number, ok = true) => {
  const col = ok ? 'var(--fig-ok)' : 'var(--fig-bad)';
  return (
    <>
      <line x1={x} y1={y} x2={x} y2={y - 26} stroke={col} strokeWidth="2.4" />
      <path d={`M${x} ${y - 26} L${x + 22} ${y - 20} L${x} ${y - 14} z`} fill={col} />
      <circle cx={x} cy={y} r="4.5" fill={col} />
    </>
  );
};

export function OwnershipClock({
  subMonthly,
  subTotal,
  ourPrice,
  months = 36,
}: {
  subMonthly: number;
  subTotal: number;
  ourPrice: number;
  months?: number;
}) {
  const copy = useMessages('diagrams');
  const x0 = 116,
    x1 = 646;
  const mx = (m: number) => x0 + ((x1 - x0) * m) / months;
  const s: ReactNode[] = [];
  for (const [m, lab] of [
    [0, copy.afterTwoYears],
    [12, copy.afterTwoYears2],
    [months, format(copy.ownershipClock, { months: months })],
  ] as [number, string][]) {
    s.push(
      <line
        x1={mx(m)}
        y1="30"
        x2={mx(m)}
        y2="252"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="3 5"
        opacity=".28"
      />,
    );
    s.push(
      <text x={mx(m)} y="272" textAnchor="middle" fontSize="12.5" {...DIM}>
        {lab}
      </text>,
    );
  }
  s.push(
    <text x="0" y="58" fontSize="13.5" fontWeight="700" fill="currentColor">
      {copy.ownershipClockNarrowLabel1}
    </text>,
    <text x="0" y="77" fontSize="12" {...DIM}>
      {copy.ownershipClock2}
    </text>,
    <rect x={x0} y="42" width={x1 - x0} height="44" rx="8" {...BOX_F} {...BOX_S} />,
    <text x={(x0 + x1) / 2} y="70" textAnchor="middle" fontSize="13.5" fill="currentColor">
      {format(copy.ownershipClock3, {
        subMonthly: c(subMonthly),
        months: months,
        subTotal: c(subTotal),
      })}
    </text>,
    flag(x1, 42, true),
    <text x={x1 - 6} y="24" textAnchor="end" fontSize="12.5" fontWeight="700" fill="var(--fig-ok)">
      {copy.ownershipClockNarrowLabel4}
    </text>,
    <path
      d={`M${mx(12) - 8} 98 L${mx(12) + 8} 114 M${mx(12) + 8} 98 L${mx(12) - 8} 114`}
      stroke="var(--fig-bad)"
      strokeWidth="2.4"
      strokeLinecap="round"
    />,
    <text x={mx(12) + 18} y="112" fontSize="12.5" fontWeight="700" fill="var(--fig-bad)">
      {copy.ownershipClock4}
    </text>,
    <text x="0" y="176" fontSize="13.5" fontWeight="700" fill="currentColor">
      {copy.ownershipClockNarrowLabel6}
    </text>,
    <text x="0" y="195" fontSize="12" {...DIM}>
      {copy.ownershipClock5}
    </text>,
    flag(x0, 160, true),
    <text x={x0 + 28} y="142" fontSize="12.5" fontWeight="700" fill="var(--fig-ok)">
      {copy.ownershipClockNarrowLabel9}
    </text>,
    <rect
      x={x0}
      y="160"
      width={x1 - x0}
      height="44"
      rx="8"
      fill="var(--fig-accent)"
      fillOpacity=".08"
      stroke="var(--fig-accent)"
      strokeWidth="2"
    />,
    <text x={(x0 + x1) / 2} y="188" textAnchor="middle" fontSize="13.5" fill="currentColor">
      {format(copy.ownershipClock6, { ourPrice: c(ourPrice) })}
    </text>,
    <path
      d={`M${mx(12) - 7} 222 l6 7 l12 -14`}
      fill="none"
      stroke="var(--fig-ok)"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />,
    <text x={mx(12) + 18} y="230" fontSize="12.5" fontWeight="700" fill="var(--fig-ok)">
      {copy.ownershipClock7}
    </text>,
  );
  return (
    <Figure
      wide={s}
      caption={format(copy.ownershipClock8, { months: months })}
      label={format(copy.ownershipClock9, { subMonthly: c(subMonthly), months: months })}
      viewBox="0 0 722 288"
      narrow={ownershipClockNarrow(copy, subMonthly, subTotal, ourPrice, months)}
    />
  );
}
