import Figure from '@/components/Figure';
import { useMessages } from '@/components/ContentProvider';
import type { ReactNode } from 'react';
import { format } from '@/i18n/format';
import {
  cap,
  BOX_F,
  BOX_S,
  DIM,
  ArrowLine,
  NW,
  NARROW_MIN_TEXT,
  type Narrow,
  type DiagramCopy,
} from '@/components/diagrams/primitives';

const short = (d: string) => {
  const m = /(\d+)\s*月\s*(\d+)\s*日/.exec(d);
  return m ? `${m[1]}/${m[2]}` : d;
};

function subsidyTimelineNarrow(copy: DiagramCopy, form4: string, deadline: string): Narrow {
  const steps: [string, string, boolean][] = [
    [copy.steps, format(copy.steps2, { shortForm4: short(form4) }), false],
    [copy.steps3, format(copy.steps4, { shortDeadline: short(deadline) }), false],
    [copy.steps5, copy.steps6, false],
    [copy.steps7, copy.steps8, true],
    [copy.steps9, copy.steps10, true],
  ];
  const h = 52,
    gap = 22,
    // 着手の境目の注記を前の箱に重ねないための余白
    breakGap = 24;
  const s = [cap(0, 14, copy.subsidyTimelineNarrowLabel1, NARROW_MIN_TEXT)];
  let y = 26;
  const ys: number[] = [];
  for (const [i, [t, sub, acc]] of steps.entries()) {
    ys.push(y);
    s.push(
      acc ? (
        <rect
          key={`step-box-${i}`}
          x="0"
          y={y}
          width={NW}
          height={h}
          rx="8"
          fill="var(--fig-accent)"
          fillOpacity=".08"
          stroke="var(--fig-accent)"
          strokeWidth="2"
        />
      ) : (
        <rect
          key={`step-box-${i}`}
          x="0"
          y={y}
          width={NW}
          height={h}
          rx="8"
          {...BOX_F}
          {...BOX_S}
        />
      ),
    );
    s.push(
      <text
        key={`step-title-${i}`}
        x="16"
        y={y + 22}
        fontSize="14"
        fontWeight="700"
        fill="currentColor"
      >
        {t}
      </text>,
    );
    s.push(
      <text key={`step-detail-${i}`} x="16" y={y + 40} fontSize={NARROW_MIN_TEXT} {...DIM}>
        {sub}
      </text>,
    );
    y += h + gap + (i === 2 ? breakGap : 0);
  }
  const gy = ys[3]! - gap / 2;
  s.push(
    <line
      key="timeline-note-1"
      x1="0"
      y1={gy}
      x2={NW}
      y2={gy}
      stroke="var(--fig-bad)"
      strokeWidth="2"
      strokeDasharray="6 5"
    />,
  );
  s.push(
    <text
      key="timeline-note-2"
      x="0"
      y={gy - 6}
      fontSize={NARROW_MIN_TEXT}
      fontWeight="700"
      fill="var(--fig-bad)"
    >
      {copy.subsidyTimelineNarrow}
    </text>,
  );
  for (let i = 0; i < steps.length - 1; i++) {
    if (i === 2) continue;
    s.push(
      <ArrowLine
        key={`step-arrow-${i}`}
        x1="20"
        y1={ys[i]! + h + 3}
        x2="20"
        y2={ys[i + 1]! - 4}
        stroke="currentColor"
        strokeWidth="1.6"
        marker="neutral"
      />,
    );
  }
  s.push(
    <text
      key="timeline-note-3"
      x={NW}
      y={y + 6}
      textAnchor="end"
      fontSize={NARROW_MIN_TEXT}
      fontWeight="700"
      fill="var(--fig-ok)"
    >
      {copy.subsidyTimelineNarrow2}
    </text>,
  );
  return [s, `0 0 ${NW} ${y + 16}`];
}

export function SubsidyTimeline({ form4, deadline }: { form4: string; deadline: string }) {
  const copy = useMessages('diagrams');
  const y = 96,
    bh = 44;
  const steps: [number, number, string, string][] = [
    [0, 150, copy.steps, format(copy.steps2, { shortForm4: short(form4) })],
    [164, 140, copy.steps3, format(copy.steps4, { shortDeadline: short(deadline) })],
    [318, 134, copy.steps5, copy.steps6],
    [482, 140, copy.steps7, copy.steps8],
    [638, 132, copy.steps9, copy.steps10],
  ];
  const s: ReactNode[] = [];
  steps.forEach(([x, w, t, sub], i) => {
    s.push(
      i >= 3 ? (
        <rect
          key={`step-box-${i}`}
          x={x}
          y={y}
          width={w}
          height={bh}
          rx="8"
          fill="var(--fig-accent)"
          fillOpacity=".08"
          stroke="var(--fig-accent)"
          strokeWidth="2"
        />
      ) : (
        <rect
          key={`step-box-${i}`}
          x={x}
          y={y}
          width={w}
          height={bh}
          rx="8"
          {...BOX_F}
          {...BOX_S}
        />
      ),
    );
    s.push(
      <text
        key={`step-title-${i}`}
        x={x + w / 2}
        y={y + 20}
        textAnchor="middle"
        fontSize="14"
        fontWeight="700"
        fill="currentColor"
      >
        {t}
      </text>,
    );
    s.push(
      <text
        key={`step-detail-${i}`}
        x={x + w / 2}
        y={y + 36}
        textAnchor="middle"
        fontSize="12"
        {...DIM}
      >
        {sub}
      </text>,
    );
    if (i < steps.length - 1) {
      s.push(
        <ArrowLine
          key={`step-arrow-${i}`}
          x1={x + w + 3}
          y1={y + bh / 2}
          x2={steps[i + 1]![0] - 4}
          y2={y + bh / 2}
          stroke="currentColor"
          strokeWidth="1.4"
          marker="neutral"
        />,
      );
    }
  });
  const gx = 474;
  s.push(
    <line
      key="timeline-note-4"
      x1={gx}
      y1="46"
      x2={gx}
      y2="196"
      stroke="var(--fig-bad)"
      strokeWidth="2"
      strokeDasharray="6 5"
    />,
  );
  s.push(
    <text
      key="timeline-note-5"
      x={gx - 10}
      y="40"
      textAnchor="end"
      fontSize="12.5"
      fontWeight="700"
      fill="var(--fig-bad)"
    >
      {copy.subsidyTimeline}
    </text>,
  );
  s.push(
    <text
      key="timeline-note-6"
      x={gx - 10}
      y="58"
      textAnchor="end"
      fontSize="12.5"
      fontWeight="700"
      fill="var(--fig-bad)"
    >
      {copy.subsidyTimeline2}
    </text>,
  );
  s.push(
    <text
      key="timeline-note-7"
      x={gx + 10}
      y="186"
      fontSize="12.5"
      fontWeight="700"
      fill="var(--fig-ok)"
    >
      {copy.subsidyTimeline3}
    </text>,
  );
  return (
    <Figure
      arrows={['neutral']}
      wide={s}
      caption={format(copy.subsidyTimeline4, { form4: form4, deadline: deadline })}
      label={format(copy.subsidyTimeline5, { form4: form4, deadline: deadline })}
      viewBox="0 0 776 206"
      narrow={subsidyTimelineNarrow(copy, form4, deadline)}
    />
  );
}
