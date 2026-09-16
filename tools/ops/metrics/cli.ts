/** npm run ops:metrics -- <command>。使い方は tools/ops/README.md。 */
import { mkdirSync, renameSync } from 'node:fs';
import { basename, join } from 'node:path';
import { type Args, readText, runCli, sha256 } from '../shared/cli';
import { OpsError, parseId, readJson, resolveDataDir, writeJson } from '../shared/store';
import { now, parseDate, parseMonth, shiftMonth } from '../shared/time';
import {
  compareMeasurements,
  createImport,
  formatMeasurement,
  loadCustomerMetrics,
  metricsDir,
  sourcesFileSchema,
  summarizeMonth,
} from './model';

const USAGE = `
npm run ops:metrics -- check   --customer <顧客ID>
npm run ops:metrics -- import  --customer <顧客ID> --source <データ源ID> --file <CSV> --from YYYY-MM-DD --to YYYY-MM-DD
npm run ops:metrics -- summary --customer <顧客ID> --month YYYY-MM [--json]
npm run ops:metrics -- imports --customer <顧客ID>
npm run ops:metrics -- remove-import --customer <顧客ID> --sha <先頭 8 文字以上>
共通: [--data <データの置き場所>]
データ源は <データの置き場所>/metrics/<顧客ID>/sources.json に手で登録する（顧客の同意の記録を含む）。
`;

const context = (args: Args) => {
  const dataDir = resolveDataDir(args.optional('data'));
  const customerId = parseId(args.required('customer'), '--customer');
  return { dataDir, customerId, ...loadCustomerMetrics(dataDir, customerId) };
};

runCli(USAGE, {
  check(args) {
    const { dataDir, customerId } = context(args);
    const path = join(metricsDir(dataDir, customerId), 'sources.json');
    const file = readJson(path, sourcesFileSchema);
    for (const s of file.sources)
      console.log(
        `${s.id}\t${s.kind}\t${s.metrics.join(',')}\t${s.coverage.from}〜${s.coverage.to ?? ''}\t同意 ${s.consent.recordedOn}`,
      );
  },
  import(args) {
    const { dataDir, customerId, sources, imports } = context(args);
    const file = args.required('file');
    const text = readText(file);
    const hash = sha256(text);
    const record = createImport({
      sources,
      existing: imports,
      sourceId: parseId(args.required('source'), '--source'),
      fileName: basename(file),
      text,
      sha256: hash,
      period: {
        from: parseDate(args.required('from'), '--from'),
        to: parseDate(args.required('to'), '--to'),
      },
      importedAt: now(),
    });
    const out = join(metricsDir(dataDir, customerId), 'imports', `${hash.slice(0, 16)}.json`);
    writeJson(out, record);
    console.log(
      `${out} に取り込みました（日次 ${record.daily.length} 行・記録 ${record.events.length} 件）`,
    );
  },
  summary(args) {
    const { customerId, sources, imports } = context(args);
    const month = parseMonth(args.required('month'), '--month');
    const current = summarizeMonth(customerId, month, sources, imports);
    if (args.flag('json')) {
      console.log(JSON.stringify(current, null, 2));
      return;
    }
    const previous = summarizeMonth(customerId, shiftMonth(month, -1), sources, imports);
    current.forEach((s, i) => {
      const p = previous[i]!;
      console.log(
        `${s.label}\t${formatMeasurement(s.measurement, s.unit)}\t${compareMeasurements(s.measurement, p.measurement, s.unit)}\t出所: ${s.source?.label ?? 'なし'}`,
      );
    });
  },
  imports(args) {
    const { imports } = context(args);
    for (const i of imports)
      console.log(
        `${i.sha256.slice(0, 16)}\t${i.sourceId}\t${i.period.from}〜${i.period.to}\t${i.fileName}\t${i.importedAt}`,
      );
  },
  'remove-import'(args) {
    const { dataDir, customerId, imports } = context(args);
    const prefix = args.required('sha');
    if (!/^[0-9a-f]{8,64}$/.test(prefix)) throw new OpsError('--sha は 16 進数 8 文字以上');
    const matches = imports.filter((i) => i.sha256.startsWith(prefix));
    if (matches.length !== 1) throw new OpsError(`該当する取り込みが ${matches.length} 件です`);
    const target = matches[0]!;
    const dir = metricsDir(dataDir, customerId);
    mkdirSync(join(dir, 'imports-removed'), { recursive: true });
    const name = `${target.sha256.slice(0, 16)}.json`;
    // 消さずに退避する。取り消した記録も後から確かめられるようにする。
    renameSync(join(dir, 'imports', name), join(dir, 'imports-removed', name));
    console.log(`${target.fileName} の取り込みを取り消しました（imports-removed/ に退避）`);
  },
});
