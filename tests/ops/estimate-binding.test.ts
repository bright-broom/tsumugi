import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from '../../tools/paths';
import {
  appendVersion,
  estimateFileSchema,
  estimateInputSchema,
} from '../../tools/ops/estimate/model';
import { addProject, createCustomer, customerPath } from '../../tools/ops/crm/model';
import { writeJson } from '../../tools/ops/shared/store';

const input = estimateInputSchema.parse(
  JSON.parse(readFileSync(join(ROOT, 'tools/ops/fixtures/estimate-basic.json'), 'utf8')),
);
const options = { savedAt: '2026-09-18T00:00:00Z', today: '2026-09-18' };
const saved = () => appendVersion(null, structuredClone(input), options);

describe('見積と顧客・案件の照合', () => {
  it('帰属のない旧見積は読めるが新規保存できない', () => {
    const legacy = { ...input, customerId: undefined, projectId: undefined };
    const file = saved();
    file.versions[0]!.input = legacy;
    expect(estimateFileSchema.safeParse(file).success).toBe(true);
    expect(() => appendVersion(null, legacy, options)).toThrow('customerId と projectId');
    expect(() => appendVersion(file, { ...input, months: 12 }, options)).toThrow('帰属は推定せず');
  });
  it.each(['customerId', 'projectId'] as const)('改版で%sを付け替えられない', (key) => {
    expect(() => appendVersion(saved(), { ...input, [key]: 'other' }, options)).toThrow(
      '一致しません',
    );
  });
  it('同じ帰属の改版は保存できる', () => {
    expect(appendVersion(saved(), { ...input, months: 12 }, options).versions).toHaveLength(2);
  });
  it.each(['missing', 'version', 'customer', 'project', 'legacy', 'id', 'valid'])(
    '実CLIの紐付け: %s',
    (scenario) => {
      const dir = mkdtempSync(join(tmpdir(), 'tsumugi-estimate-binding-'));
      try {
        const customer = addProject(
          createCustomer(
            { customerId: 'sample-shop', name: 'Sample', owner: 'Test' },
            { at: options.savedAt, by: 'Test' },
          ),
          { id: 'site-2026', title: 'Sample' },
          { at: options.savedAt, by: 'Test' },
        );
        const path = customerPath(dir, 'sample-shop');
        writeJson(path, customer);
        const before = readFileSync(path, 'utf8');
        const file = saved();
        if (scenario === 'customer') file.versions[0]!.input.customerId = 'other';
        if (scenario === 'project') file.versions[0]!.input.projectId = 'other';
        if (scenario === 'legacy') delete file.versions[0]!.input.customerId;
        if (scenario === 'id') file.versions[0]!.input.estimateId = 'other';
        if (scenario !== 'missing')
          writeJson(join(dir, 'estimates', `${input.estimateId}.json`), file);
        const result = spawnSync(
          process.execPath,
          [
            '--import',
            'tsx',
            join(ROOT, 'tools/ops/crm/cli.ts'),
            'estimate',
            '--customer',
            'sample-shop',
            '--project',
            'site-2026',
            '--estimate',
            input.estimateId,
            '--version',
            scenario === 'version' ? '99' : '1',
            '--by',
            'Test',
            '--data',
            dir,
          ],
          { cwd: ROOT, encoding: 'utf8', timeout: 20000 },
        );
        expect(result.status, result.stderr).toBe(scenario === 'valid' ? 0 : 1);
        if (scenario !== 'valid') expect(readFileSync(path, 'utf8')).toBe(before);
        else
          expect(JSON.parse(readFileSync(path, 'utf8')).projects[0].estimates).toEqual([
            { estimateId: input.estimateId, version: 1 },
          ]);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );
});
