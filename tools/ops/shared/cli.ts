/** 社内ツールの CLI の共通部分。`--name value` と `--flag` だけを受け付ける。 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { OpsError } from './store';

export class Args {
  private readonly values = new Map<string, string[]>();
  readonly command: string | undefined;

  constructor(argv: readonly string[]) {
    const [command, ...rest] = argv;
    this.command = command?.startsWith('--') ? undefined : command;
    const tokens = this.command === undefined ? argv : rest;
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]!;
      if (!token.startsWith('--')) throw new OpsError(`引数を読めません: ${token}`);
      const name = token.slice(2);
      const next = tokens[i + 1];
      const value = next === undefined || next.startsWith('--') ? 'true' : next;
      if (value !== 'true' || next === 'true') i++;
      this.values.set(name, [...(this.values.get(name) ?? []), value]);
    }
  }

  optional(name: string): string | undefined {
    return this.values.get(name)?.at(-1);
  }

  required(name: string): string {
    const value = this.optional(name);
    if (value === undefined || value === 'true') throw new OpsError(`--${name} を指定してください`);
    return value;
  }

  list(name: string): string[] {
    return this.values.get(name) ?? [];
  }

  flag(name: string): boolean {
    return this.values.has(name);
  }

  integer(name: string, fallback?: number): number {
    const raw = this.optional(name);
    if (raw === undefined) {
      if (fallback === undefined) throw new OpsError(`--${name} を指定してください`);
      return fallback;
    }
    if (!/^-?\d+$/.test(raw)) throw new OpsError(`--${name}: 整数で指定してください`);
    return Number(raw);
  }
}

export const readText = (file: string) => {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    throw new OpsError(`ファイルを読めません: ${file}`);
  }
};

export const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

type Command = (args: Args) => void;

export function runCli(usage: string, commands: Record<string, Command>): void {
  const args = new Args(process.argv.slice(2));
  const command = args.command ? commands[args.command] : undefined;
  if (!command) {
    console.error(usage.trim());
    process.exitCode = args.command === undefined || args.command === 'help' ? 0 : 1;
    return;
  }
  try {
    command(args);
  } catch (error) {
    if (!(error instanceof OpsError)) throw error;
    console.error(`エラー: ${error.message}`);
    process.exitCode = 1;
  }
}
