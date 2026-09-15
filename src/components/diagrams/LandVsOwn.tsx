import Figure from '@/components/Figure';
import { useMessages } from '@/components/ContentProvider';
import {
  cap,
  BOX_F,
  BOX_S,
  DIM,
  ArrowLine,
  NW,
  type Narrow,
  type DiagramCopy,
} from '@/components/diagrams/primitives';

interface LandOpts {
  yCap?: number;
  yBld?: number;
  hBld?: number;
  yGnd?: number;
  hGnd?: number;
  yA1?: number;
  yA2?: number;
  yRes?: number;
  hRes?: number;
  inset?: number;
}
function landPanel(
  copy: DiagramCopy,
  x0: number,
  w: number,
  capText: string,
  groundSub: string,
  resTitle: string,
  resSub: string,
  ok: boolean,
  o: LandOpts = {},
) {
  const {
    yCap = 14,
    yBld = 28,
    hBld = 64,
    yGnd = 100,
    hGnd = 42,
    yA1 = 150,
    yA2 = 186,
    yRes = 196,
    hRes = 68,
    inset = 30,
  } = o;
  const col = ok ? 'var(--fig-ok)' : 'var(--fig-bad)';
  const cx = x0 + w / 2;
  const bx = x0 + inset,
    bw = w - inset * 2;
  return (
    <>
      {cap(x0, yCap, capText)}
      <rect x={bx} y={yBld} width={bw} height={hBld} rx="8" {...BOX_F} {...BOX_S} />
      <text
        x={cx}
        y={yBld + 26}
        textAnchor="middle"
        fontSize="14"
        fontWeight="700"
        fill="currentColor"
      >
        {copy.landPanel}
      </text>
      <text x={cx} y={yBld + 46} textAnchor="middle" fontSize="12.5" {...DIM}>
        {copy.landPanel2}
      </text>
      <rect x={x0} y={yGnd} width={w} height={hGnd} rx="6" {...BOX_F} {...BOX_S} />
      <text
        x={cx}
        y={yGnd + 20}
        textAnchor="middle"
        fontSize="13"
        fontWeight="700"
        fill="currentColor"
      >
        {copy.landPanel3}
      </text>
      <text x={cx} y={yGnd + 36} textAnchor="middle" fontSize="12.5" {...DIM}>
        {groundSub}
      </text>
      <ArrowLine
        x1={cx}
        y1={yA1}
        x2={cx}
        y2={yA2}
        stroke="currentColor"
        strokeWidth="1.6"
        marker="neutral"
      />
      <text x={cx + 13} y={(yA1 + yA2) / 2 + 4} fontSize="12" {...DIM}>
        {copy.landPanel4}
      </text>
      <rect
        x={x0}
        y={yRes}
        width={w}
        height={hRes}
        rx="8"
        fill={col}
        fillOpacity=".10"
        stroke={col}
        strokeWidth="1.8"
        strokeDasharray={ok ? undefined : '6 4'}
      />
      <text x={cx} y={yRes + 28} textAnchor="middle" fontSize="14.5" fontWeight="700" fill={col}>
        {resTitle}
      </text>
      <text x={cx} y={yRes + 50} textAnchor="middle" fontSize="12.5" fill={col}>
        {resSub}
      </text>
    </>
  );
}

function landVsOwnNarrow(copy: DiagramCopy): Narrow {
  const a: LandOpts = {
    yCap: 12,
    yBld: 24,
    hBld: 60,
    yGnd: 92,
    hGnd: 40,
    yA1: 140,
    yA2: 176,
    yRes: 184,
    hRes: 66,
    inset: 24,
  };
  const d = 282;
  const b: LandOpts = {
    ...a,
    yCap: a.yCap! + d,
    yBld: a.yBld! + d,
    yGnd: a.yGnd! + d,
    yA1: a.yA1! + d,
    yA2: a.yA2! + d,
    yRes: a.yRes! + d,
  };
  const s = (
    <>
      {landPanel(
        copy,
        0,
        NW,
        copy.landVsOwnNarrowLabel1,
        copy.landVsOwnNarrowLabel2,
        copy.landVsOwnNarrowLabel3,
        copy.landVsOwnNarrowLabel4,
        false,
        a,
      )}
      {landPanel(
        copy,
        0,
        NW,
        copy.landVsOwnNarrowLabel5,
        copy.landVsOwnNarrowLabel6,
        copy.landVsOwnNarrowLabel7,
        copy.landVsOwnNarrowLabel8,
        true,
        b,
      )}
    </>
  );
  return [s, `0 0 ${NW} 542`];
}

export function LandVsOwn() {
  const copy = useMessages('diagrams');
  const w = 340;
  const s = (
    <>
      {landPanel(
        copy,
        0,
        w,
        copy.landVsOwnNarrowLabel1,
        copy.landVsOwnLabel1,
        copy.landVsOwnLabel2,
        copy.landVsOwnLabel3,
        false,
      )}
      {landPanel(
        copy,
        382,
        w,
        copy.landVsOwnNarrowLabel5,
        copy.landVsOwnLabel4,
        copy.landVsOwnLabel5,
        copy.landVsOwnLabel6,
        true,
      )}
    </>
  );
  return (
    <Figure
      arrows={['neutral']}
      wide={s}
      caption={copy.landVsOwn}
      label={copy.landVsOwn2 + copy.landVsOwn3 + copy.landVsOwn4 + copy.landVsOwn5}
      viewBox="0 0 722 276"
      narrow={landVsOwnNarrow(copy)}
    />
  );
}
