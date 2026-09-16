import type { ReactNode, SVGProps } from 'react';
import { useDiagramMarker, useDiagramGlyph } from '@/components/Figure';
import type { IconName } from '@/lib/icons';
import type { Messages } from '@/i18n/catalog';

export type DiagramCopy = Messages['diagrams'];
export type Narrow = readonly [children: ReactNode, viewBox: string];

// Geometry stays in SVG; semantic colors are supplied by the global Tailwind theme.
export const BOX_F = { fill: 'currentColor', fillOpacity: '.025' } as const;
export const BOX_S = { stroke: 'currentColor', strokeWidth: '1', strokeOpacity: '.22' } as const;
export const DIM = { className: 'diagram-muted' } as const;
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
  <text
    key={`caption-${x}-${y}`}
    x={x}
    y={y}
    fontSize={size === 14 ? undefined : size}
    fontWeight="700"
    {...DIM}
  >
    {title}
  </text>
);

/** Decorative Lucide glyph; the outer canvas owns the accessible description. */
export function DiagramIcon({
  name,
  x,
  y,
  size = 24,
  accent = false,
}: {
  name: IconName;
  x: number;
  y: number;
  size?: number;
  accent?: boolean;
}) {
  const id = useDiagramGlyph(name);
  return (
    <use
      href={`#${id}`}
      x={x}
      y={y}
      width={size}
      height={size}
      color={accent ? 'var(--fig-accent)' : undefined}
      className="diagram-icon"
      aria-hidden="true"
      focusable="false"
    />
  );
}

export function DiagramNode({
  x = 0,
  y,
  w = NW,
  h = 80,
  title,
  sub = '',
  icon,
  accent = false,
  stacked = false,
}: {
  x?: number;
  y: number;
  w?: number;
  h?: number;
  title: string;
  sub?: string;
  icon: IconName;
  accent?: boolean;
  stacked?: boolean;
}) {
  const tx = stacked ? x + w / 2 : x + 62;
  const ty = stacked ? y + 65 : y + h / 2 + (sub ? -4 : 5);
  return (
    <g className="diagram-node">
      <rect
        x={x + 1}
        y={y + 1}
        width={w - 2}
        height={h - 2}
        rx="12"
        className={accent ? 'diagram-surface is-accent' : 'diagram-surface'}
      />
      <DiagramIcon
        name={icon}
        x={stacked ? x + w / 2 - 14 : x + 20}
        y={stacked ? y + 17 : y + h / 2 - 14}
        size={28}
        accent={accent}
      />
      <text x={tx} y={ty} textAnchor={stacked ? 'middle' : 'start'} fontSize="15" fontWeight="700">
        {title}
      </text>
      {sub && (
        <text x={tx} y={ty + 22} textAnchor={stacked ? 'middle' : 'start'} {...DIM}>
          {sub}
        </text>
      )}
    </g>
  );
}

/** Exact proportional bars, with equally spaced legends so small segments never squeeze text. */
export function MetricBand({
  y,
  w,
  parts,
}: {
  y: number;
  w: number;
  parts: readonly {
    value: number;
    title: string;
    amount: string;
    icon: IconName;
    accent?: boolean;
  }[];
}) {
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  return (
    <g className="diagram-metric-band">
      {parts.map((part, i) => {
        const width = (w * part.value) / total;
        const x =
          (w * parts.slice(0, i).reduce((sum, previous) => sum + previous.value, 0)) / total;
        const cx = (w * (i + 0.5)) / parts.length;
        return (
          <g key={part.icon}>
            <rect
              x={x}
              y={y}
              width={width}
              height="12"
              className={
                part.accent
                  ? 'diagram-band is-accent'
                  : i % 2
                    ? 'diagram-band is-secondary'
                    : 'diagram-band'
              }
            />
            <DiagramIcon name={part.icon} x={cx - 13} y={y + 30} size={26} accent={part.accent} />
            <text x={cx} y={y + 80} textAnchor="middle" {...DIM}>
              {part.title}
            </text>
            <text
              x={cx}
              y={y + 106}
              textAnchor="middle"
              fontSize={w < 400 ? 20 : 23}
              fontWeight="700"
              fill={part.accent ? 'var(--fig-accent)' : 'currentColor'}
            >
              {part.amount}
            </text>
          </g>
        );
      })}
    </g>
  );
}

export function arrow(
  x1: number,
  y: number,
  x2: number,
  label: string | readonly [string, string],
  accent = false,
  dy = 11,
) {
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
        {typeof label === 'string' ? (
          label
        ) : (
          <>
            <tspan x={(x1 + x2) / 2} dy="-18">
              {label[0]}
            </tspan>
            <tspan x={(x1 + x2) / 2} dy="18">
              {label[1]}
            </tspan>
          </>
        )}
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
