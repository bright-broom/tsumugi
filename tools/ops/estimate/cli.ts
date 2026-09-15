/** npm run ops:estimate -- <command>。使い方は tools/ops/README.md。 */
import { join } from 'node:path';
import { renderHtml, renderMarkdown, signedYen, yen } from '../shared/document';
import { type Args, readText, runCli } from '../shared/cli';
import {
  OpsError,
  parseId,
  readJson,
  readJsonIfExists,
  resolveDataDir,
  resolveOutputFile,
  writeJson,
  writeText,
} from '../shared/store';
import { now, parseDate, today } from '../shared/time';
import { estimateDocument } from './document';
import {
  type EstimateInput,
  appendVersion,
  calculateEstimate,
  catalogFingerprint,
  diffVersions,
  estimateFileSchema,
  estimateInputSchema,
  findVersion,
  siteCatalog,
} from './model';

const USAGE = `
npm run ops:estimate -- quote  --input <見積条件.json>
npm run ops:estimate -- save   --input <見積条件.json> [--note <メモ>]
npm run ops:estimate -- diff   --id <見積番号> --from <版> --to <版>
npm run ops:estimate -- render --id <見積番号> [--version <版>] --format md|html [--out <ファイル>]
共通: [--data <データの置き場所>] [--today YYYY-MM-DD]
`;

const loadInput = (args: Args): EstimateInput => {
  const file = args.required('input');
  const parsed = estimateInputSchema.safeParse(JSON.parse(readText(file)));
  if (!parsed.success)
    throw new OpsError(
      `${file}: ${parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ')}`,
    );
  return parsed.data;
};
const todayOf = (args: Args) => parseDate(args.optional('today') ?? today(), '--today');
const fileOf = (args: Args, id: string) =>
  join(resolveDataDir(args.optional('data')), 'estimates', `${parseId(id, '--id')}.json`);

runCli(USAGE, {
  quote(args) {
    const input = loadInput(args);
    const result = calculateEstimate(input);
    console.log(JSON.stringify({ estimateId: input.estimateId, ...result }, null, 2));
  },
  save(args) {
    const input = loadInput(args);
    const file = fileOf(args, input.estimateId);
    const next = appendVersion(readJsonIfExists(file, estimateFileSchema), input, {
      savedAt: now(),
      today: todayOf(args),
      note: args.optional('note'),
    });
    writeJson(file, next);
    const saved = next.versions.at(-1)!;
    console.log(
      `${file} に第${saved.version}版を保存しました（${saved.result.months}か月の総額 税込 ${yen(saved.result.periodTotal)}${saved.result.provisional ? '・未確定を含む' : ''}）`,
    );
  },
  diff(args) {
    const file = readJson(fileOf(args, args.required('id')), estimateFileSchema);
    const diff = diffVersions(
      findVersion(file, args.integer('from')),
      findVersion(file, args.integer('to')),
    );
    for (const l of diff.lines)
      console.log(`${l.change}\t${l.label}\t${yen(l.before)} → ${yen(l.after)}`);
    for (const t of diff.totals)
      console.log(`${t.label}\t${yen(t.before)} → ${yen(t.after)}\t${signedYen(t.delta)}`);
    for (const f of diff.fields) console.log(`${f.label}\t${f.before} → ${f.after}`);
  },
  render(args) {
    const id = args.required('id');
    const format = args.required('format');
    if (format !== 'md' && format !== 'html') throw new OpsError('--format は md か html');
    const path = fileOf(args, id);
    const file = readJson(path, estimateFileSchema);
    const version = findVersion(
      file,
      args.optional('version') ? args.integer('version') : undefined,
    );
    if (version.catalogFingerprint !== catalogFingerprint(siteCatalog()))
      console.error(
        '注意: 保存した後に src/content/prices.ts の料金が変わっています。書面は保存時の金額のままです。必要なら新しい版を保存してください',
      );
    const previous = file.versions.filter((v) => v.version < version.version).at(-1);
    const doc = estimateDocument(version, { today: todayOf(args), previous });
    const out = resolveOutputFile(
      args.optional('out') ?? path.replace(/\.json$/, `-v${version.version}.${format}`),
    );
    writeText(out, format === 'md' ? renderMarkdown(doc) : renderHtml(doc));
    console.log(`${out} を書き出しました`);
  },
});
