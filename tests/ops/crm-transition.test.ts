import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from '../../tools/paths';
import { appendVersion, estimateInputSchema } from '../../tools/ops/estimate/model';
import {
  addProject,
  advanceProject,
  createCustomer,
  customerPath,
  recordContract,
} from '../../tools/ops/crm/model';
import { writeJson } from '../../tools/ops/shared/store';
const m = { at: '2026-09-18T00:00:00Z', by: 'Test' };
const fixture = () =>
  estimateInputSchema.parse(
    JSON.parse(readFileSync(join(ROOT, 'tools/ops/fixtures/estimate-basic.json'), 'utf8')),
  );
const cli = (dir: string, ...args: string[]) =>
  spawnSync(
    process.execPath,
    [
      '--import',
      'tsx',
      join(ROOT, 'tools/ops/crm/cli.ts'),
      ...args,
      '--data',
      dir,
      '--customer',
      'sample-shop',
      '--project',
      'site-2026',
      '--by',
      'Test',
    ],
    { cwd: ROOT, encoding: 'utf8', timeout: 20000 },
  );
const customer = (to: string) => {
  let file = addProject(
    createCustomer({ customerId: 'sample-shop', name: 'Sample', owner: 'Test' }, m),
    { id: 'site-2026', title: 'Sample' },
    m,
  );
  file.projects[0]!.estimates = [{ estimateId: 'est-sample-001', version: 1 }];
  if (to !== 'estimate_sent') {
    file = advanceProject(file, 'site-2026', 'estimate_sent', m);
    file = recordContract(
      file,
      'site-2026',
      { version: 1, status: 'signed', ref: 'sample', signedOn: '2026-09-18' },
      m,
    );
    if (to === 'in_production') file = advanceProject(file, 'site-2026', 'contracted', m);
  }
  return file;
};
describe.each(['estimate_sent', 'contracted', 'in_production'])(
  '案件を%sへ進める前の照合',
  (to) => {
    it.each(['missing', 'version', 'customer', 'project', 'legacy', 'id', 'no-ref', 'valid'])(
      '%s',
      (scenario) => {
        const dir = mkdtempSync(join(tmpdir(), 'tsumugi-transition-'));
        try {
          const file = customer(to),
            path = customerPath(dir, 'sample-shop');
          if (scenario === 'no-ref') file.projects[0]!.estimates = [];
          if (scenario === 'version') file.projects[0]!.estimates[0]!.version = 99;
          writeJson(path, file);
          const before = readFileSync(path, 'utf8');
          const estimate = appendVersion(null, fixture(), { savedAt: m.at, today: '2026-09-18' });
          if (scenario === 'customer') estimate.versions[0]!.input.customerId = 'other';
          if (scenario === 'project') estimate.versions[0]!.input.projectId = 'other';
          if (scenario === 'legacy') delete estimate.versions[0]!.input.customerId;
          if (scenario === 'id') estimate.estimateId = 'other';
          if (scenario !== 'missing')
            writeJson(join(dir, 'estimates', 'est-sample-001.json'), estimate);
          if (scenario === 'missing') {
            const show = cli(dir, 'show');
            expect(show.status, show.stderr).toBe(0);
            expect(show.stdout).toContain('JSON を読めません');
            expect(readFileSync(path, 'utf8')).toBe(before);
          }
          const result = cli(dir, 'advance', '--to', to);
          expect(result.status, result.stderr).toBe(scenario === 'valid' ? 0 : 1);
          if (scenario === 'valid')
            expect(JSON.parse(readFileSync(path, 'utf8')).projects[0].state).toBe(to);
          else expect(readFileSync(path, 'utf8')).toBe(before);
        } finally {
          rmSync(dir, { recursive: true, force: true });
        }
      },
    );
  },
);
it('見積が失われても相談への差し戻しは妨げない', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tsumugi-transition-return-'));
  try {
    writeJson(customerPath(dir, 'sample-shop'), customer('contracted'));
    const result = cli(dir, 'advance', '--to', 'consulting');
    expect(result.status, result.stderr).toBe(0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
