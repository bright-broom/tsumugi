import Figure from '@/components/Figure';
import { useMessages } from '@/components/ContentProvider';
import { Fragment, type ReactNode } from 'react';
import { format } from '@/i18n/format';
import {
  cap,
  DiagramIcon,
  DiagramNode,
  BOX_F,
  BOX_S,
  DIM,
  NW,
  NARROW_MIN_TEXT,
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
    return (
      <>
        <rect x="0" y={y} width={NW} height="10" rx="5" {...BOX_F} {...BOX_S} />
        <circle cx={fx} cy={y + 5} r="5.5" fill={col} />
        <line x1={fx} y1={y + 5} x2={fx} y2={y - 22} stroke={col} strokeWidth="2.2" />
        <DiagramIcon name="key" x={atEnd ? NW - 28 : 14} y={y - 26} size={22} accent />
      </>
    );
  };
  const panel = (own: boolean) => (
    <>
      {cap(
        0,
        18,
        own ? copy.ownershipClockNarrowLabel6 : copy.ownershipClockNarrowLabel1,
        NARROW_MIN_TEXT,
      )}
      <DiagramNode
        y={34}
        icon={own ? 'key' : 'repeat-2'}
        accent={own}
        title={
          own
            ? format(copy.ownershipClockNarrowLabel7, { ourPrice: c(ourPrice) })
            : format(copy.ownershipClockNarrowLabel2, { subMonthly: c(subMonthly), months })
        }
        sub={
          own
            ? copy.ownershipClockNarrowLabel8
            : format(copy.ownershipClockNarrowLabel3, { subTotal: c(subTotal) })
        }
      />
      <text
        x={own ? 0 : NW}
        y={140}
        textAnchor={own ? 'start' : 'end'}
        fontSize={NARROW_MIN_TEXT}
        fontWeight="700"
        fill="var(--fig-ok)"
      >
        {own ? copy.ownershipClockNarrowLabel9 : copy.ownershipClockNarrowLabel4}
      </text>
      {track(170, !own)}
      <text
        x={0}
        y={210}
        fontSize={NARROW_MIN_TEXT}
        fontWeight="700"
        fill={own ? 'var(--fig-ok)' : 'currentColor'}
      >
        {own ? copy.ownershipClockNarrowLabel10 : copy.ownershipClockNarrowLabel5}
      </text>
    </>
  );
  return [
    <>
      {panel(false)}
      <g transform="translate(0 254)">{panel(true)}</g>
    </>,
    `0 0 ${NW} 480`,
  ];
}

const flag = (x: number, y: number, ok = true) => {
  const col = ok ? 'var(--fig-ok)' : 'var(--fig-bad)';
  return (
    <Fragment key={`flag-${x}-${y}`}>
      <line x1={x} y1={y} x2={x} y2={y - 26} stroke={col} strokeWidth="2.4" />
      <DiagramIcon name="key" x={x + 5} y={y - 28} size={20} accent />
      <circle cx={x} cy={y} r="4.5" fill={col} />
    </Fragment>
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
  for (const [index, [m, lab]] of (
    [
      [0, copy.afterTwoYears],
      [12, copy.afterTwoYears2],
      [months, format(copy.ownershipClock, { months: months })],
    ] as [number, string][]
  ).entries()) {
    s.push(
      <line
        key={`axis-${index}`}
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
      <text
        key={`axis-label-${index}`}
        x={mx(m)}
        y="272"
        textAnchor="middle"
        fontSize="12.5"
        {...DIM}
      >
        {lab}
      </text>,
    );
  }
  s.push(
    <DiagramIcon key="monthly-icon" name="repeat-2" x={0} y={22} size={24} />,
    <DiagramIcon key="owned-icon" name="globe" x={0} y={140} size={24} accent />,
    <text key="clock-1" x="0" y="58" fontSize="13.5" fontWeight="700">
      {copy.ownershipClockNarrowLabel1}
    </text>,
    <text key="clock-2" x="0" y="77" fontSize="12" {...DIM}>
      {copy.ownershipClock2}
    </text>,
    <rect
      key="clock-3"
      x={x0}
      y="42"
      width={x1 - x0}
      height="44"
      rx="12"
      className="diagram-surface"
    />,
    <text key="clock-4" x={(x0 + x1) / 2} y="70" textAnchor="middle" fontSize="13.5">
      {format(copy.ownershipClock3, {
        subMonthly: c(subMonthly),
        months: months,
        subTotal: c(subTotal),
      })}
    </text>,
    flag(x1, 42, true),
    <text
      key="clock-5"
      x={x1 - 6}
      y="24"
      textAnchor="end"
      fontSize="12.5"
      fontWeight="700"
      fill="var(--fig-ok)"
    >
      {copy.ownershipClockNarrowLabel4}
    </text>,
    <DiagramIcon key="clock-6" name="circle-x" x={mx(12) - 10} y={96} size={20} />,
    <text
      key="clock-7"
      x={mx(12) + 18}
      y="112"
      fontSize="12.5"
      fontWeight="700"
      fill="var(--fig-bad)"
    >
      {copy.ownershipClock4}
    </text>,
    <text key="clock-8" x="0" y="176" fontSize="13.5" fontWeight="700">
      {copy.ownershipClockNarrowLabel6}
    </text>,
    <text key="clock-9" x="0" y="195" fontSize="12" {...DIM}>
      {copy.ownershipClock5}
    </text>,
    flag(x0, 160, true),
    <text key="clock-10" x={x0 + 28} y="142" fontSize="12.5" fontWeight="700" fill="var(--fig-ok)">
      {copy.ownershipClockNarrowLabel9}
    </text>,
    <rect
      key="clock-11"
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
    <text key="clock-12" x={(x0 + x1) / 2} y="188" textAnchor="middle" fontSize="13.5">
      {format(copy.ownershipClock6, { ourPrice: c(ourPrice) })}
    </text>,
    <DiagramIcon key="clock-13" name="check" x={mx(12) - 10} y={212} size={22} accent />,
    <text
      key="clock-14"
      x={mx(12) + 18}
      y="230"
      fontSize="12.5"
      fontWeight="700"
      fill="var(--fig-ok)"
    >
      {copy.ownershipClock7}
    </text>,
  );
  return (
    <Figure
      icons={['repeat-2', 'globe', 'key', 'circle-x', 'check']}
      wide={s}
      caption={format(copy.ownershipClock8, { months: months })}
      label={format(copy.ownershipClock9, { subMonthly: c(subMonthly), months: months })}
      viewBox="0 0 722 288"
      narrow={ownershipClockNarrow(copy, subMonthly, subTotal, ourPrice, months)}
    />
  );
}
