import { Children, createContext, useContext, useId, type ReactNode } from 'react';
import { ICONS, type IconName } from '@/lib/icons';
import { useMessages } from '@/components/ContentProvider';

type MarkerTone = 'neutral' | 'accent';
type Markers = Partial<Record<MarkerTone, string>>;
const MarkerContext = createContext<Markers | null>(null);

const GlyphContext = createContext<Partial<Record<IconName, string>> | null>(null);

export function useDiagramGlyph(name: IconName): string {
  const glyphs = useContext(GlyphContext);
  const id = glyphs?.[name];
  if (!id) throw new Error(`Figure does not define the ${name} icon`);
  return id;
}

/** A canvas owns its markers, even when the same diagram appears twice on a page. */
export function useDiagramMarker(tone: MarkerTone): string {
  const markers = useContext(MarkerContext);
  if (!markers) throw new Error('Diagram arrows require a Figure canvas');
  const id = markers[tone];
  if (!id) throw new Error(`Figure does not define the ${tone} arrow`);
  return id;
}

function Canvas({
  children,
  viewBox,
  label,
  variant,
  arrows,
}: {
  children: ReactNode;
  viewBox: string;
  label: string;
  variant: 'fw' | 'fn';
  arrows: readonly MarkerTone[];
}) {
  const instance = useId();
  const markers: Markers = {
    neutral: arrows.includes('neutral') ? `dg-a${instance}` : undefined,
    accent: arrows.includes('accent') ? `dg-p${instance}` : undefined,
  };
  return (
    <MarkerContext.Provider value={markers}>
      <svg className={variant} role="img" aria-label={label} viewBox={viewBox}>
        {arrows.length > 0 && (
          <defs>
            {(['neutral', 'accent'] as const).map((tone) =>
              markers[tone] ? (
                <marker
                  key={tone}
                  id={markers[tone]}
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path
                    d="M0 0 L10 5 L0 10 z"
                    fill={tone === 'accent' ? 'var(--fig-accent)' : 'currentColor'}
                  />
                </marker>
              ) : null,
            )}
          </defs>
        )}
        {Children.toArray(children)}
      </svg>
    </MarkerContext.Provider>
  );
}

/** Native React/SVG output; desktop and narrow layouts share one accessible description. */
export default function Figure({
  wide,
  caption,
  label,
  viewBox,
  narrow,
  arrows = [],
  icons = [],
}: {
  wide: ReactNode;
  caption: string;
  label: string;
  viewBox: string;
  narrow?: readonly [children: ReactNode, viewBox: string];
  arrows?: readonly MarkerTone[];
  icons?: readonly IconName[];
}) {
  const copy = useMessages('diagrams');
  const instance = useId();
  const glyphs = Object.fromEntries(icons.map((name, i) => [name, `di${instance}${i}`]));
  return (
    <GlyphContext.Provider value={glyphs}>
      <figure className={narrow ? 'fig has-narrow' : 'fig'}>
        {icons.length > 0 && (
          <svg
            className="diagram-symbols"
            width="0"
            height="0"
            aria-hidden="true"
            focusable="false"
          >
            <defs>
              {icons.map((name) => {
                const Glyph = ICONS[name];
                return (
                  <symbol key={name} id={glyphs[name]} viewBox="0 0 24 24">
                    <Glyph
                      xmlns={undefined}
                      size={24}
                      strokeWidth={1.65}
                      aria-hidden="true"
                      focusable="false"
                    />
                  </symbol>
                );
              })}
            </defs>
          </svg>
        )}
        <Canvas variant="fw" viewBox={viewBox} label={label} arrows={arrows}>
          {wide}
        </Canvas>
        {narrow ? (
          <Canvas variant="fn" viewBox={narrow[1]} label={label} arrows={arrows}>
            {narrow[0]}
          </Canvas>
        ) : (
          <p className="fig-hint" aria-hidden="true">
            {copy.hint}
          </p>
        )}
        <figcaption>{caption}</figcaption>
      </figure>
    </GlyphContext.Provider>
  );
}
