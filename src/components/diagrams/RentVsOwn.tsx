import Figure from '@/components/Figure';
import { useMessages } from '@/components/ContentProvider';
import { format } from '@/i18n/format';
import {
  cap,
  box,
  arrow,
  vbox,
  vdown,
  NW,
  c,
  type Narrow,
  type DiagramCopy,
} from '@/components/diagrams/primitives';

function rentVsOwnNarrow(copy: DiagramCopy, portal: number, fee: number, run: number): Narrow {
  const s = (
    <>
      {cap(0, 12, copy.rentVsOwnNarrowLabel1)}
      {vbox(24, 54, copy.rentVsOwnNarrowLabel2, '')}
      {vdown(86, 122, format(copy.rentVsOwnNarrowLabel3, { portal: c(portal) }))}
      {vbox(130, 58, copy.rentVsOwnNarrowLabel4, copy.rentVsOwnNarrowLabel5)}
      {vdown(196, 244, format(copy.rentVsOwnNarrowLabel6, { fee: fee }), false, 44, 208)}
      <line
        x1="14"
        y1="228"
        x2={NW - 14}
        y2="228"
        stroke="var(--fig-bad)"
        strokeWidth="1.5"
        strokeDasharray="5 5"
      />
      <path
        d="M36 220 L52 236 M52 220 L36 236"
        stroke="var(--fig-bad)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <text x={NW} y="264" textAnchor="end" fontSize="12.5" fontWeight="700" fill="var(--fig-bad)">
        {copy.rentVsOwnNarrowLabel7}
      </text>
      {vbox(276, 50, copy.rentVsOwnNarrowLabel8)}
      {cap(0, 368, copy.rentVsOwnNarrowLabel9)}
      {vbox(380, 54, copy.rentVsOwnNarrowLabel2, '')}
      {vdown(442, 478, format(copy.rentVsOwnNarrowLabel10, { run: c(run) }), true)}
      {vbox(486, 58, copy.rentVsOwnNarrowLabel11, copy.rentVsOwnNarrowLabel12, true)}
      {vdown(552, 588, copy.rentVsOwnNarrowLabel13, true)}
      {vbox(600, 50, copy.rentVsOwnNarrowLabel8)}
      <text
        x={NW / 2}
        y="674"
        textAnchor="middle"
        fontSize="12.5"
        fontWeight="700"
        fill="var(--fig-ok)"
      >
        {copy.rentVsOwnNarrowLabel14}
      </text>
    </>
  );
  return [s, `0 0 ${NW} 684`];
}

export function RentVsOwn({ portal, fee, run }: { portal: number; fee: number; run: number }) {
  const copy = useMessages('diagrams');
  const s = (
    <>
      {cap(0, 16, copy.rentVsOwnNarrowLabel1)}
      {box(0, 32, 124, 66, copy.rentVsOwnNarrowLabel2, copy.rentVsOwnLabel1)}
      {arrow(130, 65, 248, format(copy.rentVsOwnNarrowLabel3, { portal: c(portal) }))}
      {box(254, 28, 212, 74, copy.rentVsOwnNarrowLabel4, copy.rentVsOwnNarrowLabel5)}
      {arrow(472, 65, 590, format(copy.rentVsOwnNarrowLabel6, { fee: fee }), false, 25)}
      {box(596, 32, 124, 66, copy.rentVsOwnNarrowLabel8)}
      <line
        x1="530"
        y1="48"
        x2="530"
        y2="118"
        stroke="var(--fig-bad)"
        strokeWidth="1.5"
        strokeDasharray="5 5"
      />
      <path
        d="M522 56 L538 72 M538 56 L522 72"
        stroke="var(--fig-bad)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <text
        x="530"
        y="134"
        textAnchor="middle"
        fontSize="12"
        fontWeight="700"
        fill="var(--fig-bad)"
      >
        {copy.rentVsOwnNarrowLabel7}
      </text>
      {cap(0, 188, copy.rentVsOwnNarrowLabel9)}
      {box(0, 204, 124, 66, copy.rentVsOwnNarrowLabel2, copy.rentVsOwnLabel1)}
      {arrow(130, 237, 248, format(copy.rentVsOwnNarrowLabel10, { run: c(run) }), true)}
      {box(254, 200, 212, 74, copy.rentVsOwnNarrowLabel11, copy.rentVsOwnNarrowLabel12, true)}
      {arrow(472, 237, 590, copy.rentVsOwnNarrowLabel13, true)}
      {box(596, 204, 124, 66, copy.rentVsOwnNarrowLabel8)}
      <text x="361" y="302" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--fig-ok)">
        {copy.rentVsOwnLabel2}
      </text>
    </>
  );
  return (
    <Figure
      arrows={['neutral', 'accent']}
      wide={s}
      caption={copy.rentVsOwn + copy.rentVsOwn2}
      label={
        format(copy.rentVsOwn3, { portal: c(portal) }) +
        format(copy.rentVsOwn4, { fee: fee }) +
        format(copy.rentVsOwn5, { run: c(run) }) +
        copy.rentVsOwn6
      }
      viewBox="0 0 722 312"
      narrow={rentVsOwnNarrow(copy, portal, fee, run)}
    />
  );
}
