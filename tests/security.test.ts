import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, statSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { jsonLd } from '@/lib/raw';
import { unsafeMarkup } from '../tools/security/markup';
import { SECURITY_HEADERS } from '../tools/security/policy';
import { resolveDataDir, writeJson, writeText } from '../tools/ops/shared/store';
import { toCsv } from '../tools/ops/shared/csv';
import { ROOT } from '../tools/paths';

describe('publishing security', () => {
  it.each([
    '<script src="/attack.js"></script>',
    '<script type="application/ld+json" src="/attack.js"></script>',
    '<script type="application/ld+json">not json</script>',
    '<img src=x onerror="alert(1)">',
    '<a href="java&#x09;script:alert(1)">link</a>',
    '<template><iframe srcdoc="attack"></iframe></template>',
    '<svg><foreignObject><div>injected</div></foreignObject></svg>',
    '<div style="background:url(https://invalid.example/)"></div>',
    '<a href="data:image/svg+xml,attack">link</a>',
  ])('rejects active markup: %s', (markup) =>
    expect(unsafeMarkup(markup).length).toBeGreaterThan(0),
  );

  it('allows inert JSON-LD, local icons and numeric chart styling', () => {
    expect(
      unsafeMarkup(
        '<script type="application/ld+json">{"name":"紬"}</script><svg><use href="#icon"/></svg><i style="--comparison-width:50%"></i>',
      ),
    ).toEqual([]);
  });
  it('does not let JSON-LD values terminate their enclosing script', () => {
    const value = { name: '</script><img src=x onerror=alert(1)>', nested: { '<key>': '<!--' } };
    const output = jsonLd(value).__html;
    expect(output).not.toContain('<');
    expect(JSON.parse(output)).toEqual(value);
    expect(unsafeMarkup(`<script type="application/ld+json">${output}</script>`)).toEqual([]);
  });
  it('denies scripts, framing, base URL replacement and form submission at the hosting boundary', () => {
    const csp = SECURITY_HEADERS['content-security-policy']!;
    for (const directive of [
      "script-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'none'",
      "form-action 'none'",
      "connect-src 'none'",
    ])
      expect(csp.split(';').map((part) => part.trim())).toContain(directive);
    expect(SECURITY_HEADERS['x-content-type-options']).toBe('nosniff');
    expect(SECURITY_HEADERS['x-frame-options']).toBe('DENY');
  });
});

describe('private operational data', () => {
  it('creates owner-only files and rejects direct or symlinked publishing paths', () => {
    const temp = mkdtempSync(join(tmpdir(), 'tsumugi-security-'));
    try {
      const file = join(temp, 'private', 'record.json');
      writeJson(file, { customer: 'fixture' });
      expect(statSync(file).mode & 0o777).toBe(0o600);
      expect(statSync(join(temp, 'private')).mode & 0o777).toBe(0o700);
      writeText(file, 'updated');
      expect(statSync(file).mode & 0o777).toBe(0o600);
      expect(readFileSync(file, 'utf8')).toBe('updated');
      expect(() => resolveDataDir(join(ROOT, '..private'))).toThrow();
      expect(() => writeText(join(ROOT, 'public', 'private.txt'), 'private')).toThrow();
      symlinkSync(join(ROOT, 'public'), join(temp, 'link'));
      expect(() => writeText(join(temp, 'link', 'private.txt'), 'private')).toThrow();
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });
});

describe('CSV export', () => {
  it.each(['=1+1', '\n=1+1', '  =1+1', '\t@SUM(1)', '\r+1+1'])(
    'neutralizes spreadsheet formulas: %s',
    (value) => {
      const csv = toCsv([[value]]);
      expect(csv.startsWith("'") || csv.startsWith(`"'`)).toBe(true);
    },
  );
  it('keeps numeric cells numeric', () =>
    expect(toCsv([[-10, 'ordinary']])).toBe('-10,ordinary\r\n'));
});
