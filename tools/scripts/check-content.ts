import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { inspectSource } from '../verify/source-policy';

import { ROOT as root } from '../paths';
const files = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(join(directory, entry.name))
      : /\.tsx?$/.test(entry.name)
        ? [join(directory, entry.name)]
        : [],
  );
// services/ renders user-facing HTML too, so its copy must also come from the catalog.
const problems = ['src', 'services'].flatMap((dir) => files(join(root, dir))).flatMap((file) =>
  inspectSource(relative(root, file), readFileSync(file, 'utf8')),
);
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('check-content: text comes from catalogs; URLs come from the route registry');
