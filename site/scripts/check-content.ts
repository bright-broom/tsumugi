import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { inspectSource } from '../verify/source-policy';

const root = join(import.meta.dirname, '..');
const files = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(join(directory, entry.name))
      : /\.tsx?$/.test(entry.name)
        ? [join(directory, entry.name)]
        : [],
  );
const problems = files(join(root, 'src')).flatMap((file) =>
  inspectSource(relative(root, file), readFileSync(file, 'utf8')),
);
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('check-content: text comes from catalogs; URLs come from the route registry');
