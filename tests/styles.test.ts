import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkInlineStyles, checkStyleSources } from '../tools/scripts/check-styles';
import { buildStyles } from '../tools/scripts/build-styles';

describe('central style boundary', () => {
  it.each([
    '<p style={{ color: "red" }} />',
    '<p style={styles} />',
    '<p style={{ ...styles, "--width": "12%" }} />',
    '<style>{css}</style>',
  ])('rejects presentation outside the global stylesheet: %s', (source) => {
    expect(checkInlineStyles(source)).not.toHaveLength(0);
  });
  it('accepts data-driven variables but rejects a static conditional branch', () => {
    expect(checkInlineStyles('<i style={{ "--width": `${value}%` } as CSSProperties} />')).toEqual(
      [],
    );
    expect(
      checkInlineStyles(
        '<table style={minw ? ({ "--width": `${minw}px` } as CSSProperties) : undefined} />',
      ),
    ).toEqual([]);
    expect(
      checkInlineStyles('<p style={active ? { "--width": "12px" } : { width: 0 }} />'),
    ).toHaveLength(1);
  });
  it('keeps every page and shared component within the boundary', () => {
    expect(checkStyleSources(join(import.meta.dirname, '..'))).toEqual([]);
  });
});

describe('Tailwind production compiler', () => {
  it('compiles public and image styles from the shared theme without a runtime', async () => {
    const scratch = mkdtempSync(join(tmpdir(), 'tsumugi-styles-test-'));
    try {
      for (const input of ['globals', 'og']) {
        const output = join(scratch, `${input}.css`);
        await buildStyles(`src/styles/${input}.css`, output);
        const css = readFileSync(output, 'utf8');
        expect(css).toContain('tailwindcss v4.');
        expect(css).toContain('--color-main: #F7F5F0');
        expect(css).toContain('--color-sub: #243B3B');
        expect(css).toContain('--color-accent: #FFB000');
        expect(css).not.toMatch(/@(?:apply|theme|import|source)\b/);
        if (input === 'globals') {
          expect(css).toContain('.footer-intro');
          expect(css).toContain('var(--comparison-width,0%)');
          expect(css).toContain('prefers-reduced-motion: reduce');
        } else expect(css).toContain('.og-heading-54');
      }
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  }, 15000);
});
