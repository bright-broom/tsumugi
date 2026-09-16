import type { ReactNode, SVGProps } from 'react';
import { useDiagramMarker } from '@/components/Figure';
import type { Messages } from '@/i18n/catalog';

export type DiagramCopy = Messages['diagrams'];
export type Narrow = readonly [children: ReactNode, viewBox: string];

// Geometry stays in SVG; semantic colors are supplied by the global Tailwind theme.
export const BOX_F = { fill: 'currentColor', fillOpacity: '.045' } as const;
export const BOX_S = { stroke: 'currentColor', strokeWidth: '1.4', strokeOpacity: '.55' } as const;
export const DIM = { fill: 'currentColor', opacity: '.72' } as const;
export const NW = 340;
/** 狭い図（幅 NW）は 390px 幅でほぼ等倍に描かれる。補助文字をこれより小さくしない（本文の下限 --text-fine と同じ。ADR 0028） */
export const NARROW_MIN_TEXT = 14;
export const c = (n: number) => n.toLocaleString('en-US');

export function ArrowLine({
  marker,
  ...props
}: Omit<SVGProps<SVGLineElement>, 'markerEnd'> & {
  marker: 'neutral' | 'accent';
}) {
  const id = useDiagramMarker(marker);
  return <line {...props} markerEnd={`url(#${id})`} />;
}

export const cap = (x: number, y: number, title: string, size = 12) => (
  <text key={`caption-${x}-${y}`} x={x} y={y} fontSize={size} fontWeight="700" {...DIM}>
    {title}
  </text>
);

function Box({
  x,
  y,
  w,
  h,
  title,
  sub,
  accent,
  subOffset,
  subSize,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  sub: string;
  accent: boolean;
  subOffset: number;
  subSize: number;
}) {
  const cx = x + w / 2;
  return (
    <>
      {accent ? (
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx="8"
          fill="var(--fig-accent)"
          fillOpacity=".08"
          stroke="var(--fig-accent)"
          strokeWidth="2"
        />
      ) : (
        <rect x={x} y={y} width={w} height={h} rx="8" {...BOX_F} {...BOX_S} />
      )}
      {sub ? (
        <>
          <text
            x={cx}
            y={y + h / 2 - 3}
            textAnchor="middle"
            fontSize="15"
            fontWeight="700"
            fill="currentColor"
          >
            {title}
          </text>
          <text x={cx} y={y + h / 2 + subOffset} textAnchor="middle" fontSize={subSize} {...DIM}>
            {sub}
          </text>
        </>
      ) : (
        <text
          x={cx}
          y={y + h / 2 + 5}
          textAnchor="middle"
          fontSize="15"
          fontWeight="700"
          fill="currentColor"
        >
          {title}
        </text>
      )}
    </>
  );
}

export function box(
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  sub = '',
  accent = false,
) {
  return <Box x={x} y={y} w={w} h={h} title={title} sub={sub} accent={accent} subOffset={18} subSize={12} />;
}

export function vbox(y: number, h: number, title: string, sub = '', accent = false) {
  return <Box x={0} y={y} w={NW} h={h} title={title} sub={sub} accent={accent} subOffset={17} subSize={NARROW_MIN_TEXT} />;
}

export function arrow(x1: number, y: number, x2: number, label: string, accent = false, dy = 11) {
  return (
    <>
      <ArrowLine
        x1={x1}
        y1={y}
        x2={x2}
        y2={y}
        stroke={accent ? 'var(--fig-accent)' : 'currentColor'}
        strokeWidth="1.6"
        marker={accent ? 'accent' : 'neutral'}
      />
      <text x={(x1 + x2) / 2} y={y - dy} textAnchor="middle" fontSize="12" {...DIM}>
        {label}
      </text>
    </>
  );
}

export function vdown(y1: number, y2: number, label: string, accent = false, x = 44, ly?: number) {
  return (
    <>
      <ArrowLine
        x1={x}
        y1={y1}
        x2={x}
        y2={y2}
        stroke={accent ? 'var(--fig-accent)' : 'currentColor'}
        strokeWidth="1.6"
        marker={accent ? 'accent' : 'neutral'}
      />
      <text x={x + 14} y={ly ?? (y1 + y2) / 2 + 4} fontSize={NARROW_MIN_TEXT} {...DIM}>
        {label}
      </text>
    </>
  );
}
