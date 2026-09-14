/**
 * design.tokens.json (DTCG Format Module 2025.10) -> tokens.css
 *
 *   npm run tokens               生成する
 *   npm run tokens -- --check    生成物と定義が一致するか検査する（CI向け。verify の「20 トークンの同期」も同じ関数を使う）
 *
 * 扱う $type は color / dimension / duration / fontFamily / fontWeight / number と参照のみ。
 * 仕様全体への対応は保証しない。未知の型・欠落参照・循環参照はエラーにする。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ROOT } from '../paths';
const STYLES = join(ROOT, 'src', 'styles');
export const TOKENS_SRC = join(STYLES, 'design.tokens.json');
export const TOKENS_OUT = join(STYLES, 'tokens.css');
/** Tailwind v4 namespaces: the JSON is the only source of token values. */
export function tokenCssName(path: string[]): string {
  const name = path.join('-');
  const namespaces = [
    ['font-family-', 'font-'],
    ['font-size-', 'text-'],
    ['font-leading-', 'leading-'],
    ['font-weight-', 'font-weight-'],
    ['size-', 'spacing-'],
    ['theme-', 'color-'],
    ['motion-', 'duration-'],
  ];
  for (const [from, to] of namespaces) {
    if (name.startsWith(from!)) return `--${to}${name.slice(from!.length)}`;
  }
  return `--${name}`;
}
const TYPES = new Set(['color', 'dimension', 'duration', 'fontFamily', 'fontWeight', 'number']);

type Json = Record<string, unknown>;
interface Token {
  path: string[];
  type: string;
  value: unknown;
  doc: string | undefined;
  resolved?: unknown;
}

/** 生成物の先頭に書く「どこから・どうやって作ったか」 */
export interface Header {
  source: string;
  command: string;
}
const HEADER: Header = { source: 'src/styles/design.tokens.json', command: 'npm run tokens' };

const isToken = (v: unknown): v is Json & { $value: unknown } =>
  !!v && typeof v === 'object' && '$value' in v;

/** グループの $type を子に継がせながら平坦化する */
function flatten(
  node: Json,
  path: string[] = [],
  inherited: string | null = null,
  out: Token[] = [],
): Token[] {
  const type = (node.$type as string | undefined) ?? inherited;
  for (const [key, val] of Object.entries(node)) {
    if (key.startsWith('$')) continue;
    const next = [...path, key];
    if (isToken(val)) {
      const t = (val.$type as string | undefined) ?? type;
      if (!t) throw new Error(`型が決まらない: ${next.join('.')}`);
      if (!TYPES.has(t)) throw new Error(`未対応の $type "${t}": ${next.join('.')}`);
      out.push({
        path: next,
        type: t,
        value: val.$value,
        doc: val.$description as string | undefined,
      });
    } else if (val && typeof val === 'object') {
      flatten(val as Json, next, ((val as Json).$type as string | undefined) ?? type, out);
    }
  }
  return out;
}

const REF = /^\{([^}]+)\}$/;

function resolveRefs(tokens: Token[]): Token[] {
  const byPath = new Map(tokens.map((t) => [t.path.join('.'), t]));
  const done = new Map<string, unknown>();
  const walk = (key: string, seen: Set<string>): unknown => {
    if (done.has(key)) return done.get(key);
    if (seen.has(key)) throw new Error(`循環参照: ${[...seen, key].join(' -> ')}`);
    const tok = byPath.get(key);
    if (!tok) throw new Error(`参照先がない: {${key}}`);
    const m = typeof tok.value === 'string' ? tok.value.match(REF) : null;
    const v = m ? walk(m[1]!, new Set([...seen, key])) : tok.value;
    done.set(key, v);
    return v;
  };
  for (const t of tokens) t.resolved = walk(t.path.join('.'), new Set());
  return tokens;
}

function toCss(t: Token): string {
  const v = t.resolved;
  if (t.type === 'fontFamily') {
    const list = Array.isArray(v) ? v : [v];
    return list.map((f) => (/^[A-Za-z][\w-]*$/.test(String(f)) ? f : `"${f}"`)).join(', ');
  }
  return String(v);
}

export function renderTokensCss(header: Header = HEADER): { css: string; count: number } {
  const tokens = resolveRefs(flatten(JSON.parse(readFileSync(TOKENS_SRC, 'utf8')) as Json));
  const lines = [
    '/* 生成物。手で編集しない。',
    ` * 出所: ${header.source}`,
    ` * 生成: ${header.command}`,
    ` * トークン数: ${tokens.length}`,
    ' */',
    '@theme static {',
  ];
  let group: string | null = null;
  for (const t of tokens) {
    const g = t.path[0]!;
    if (g !== group) {
      lines.push(`${group ? '\n' : ''}  /* ${g} */`);
      group = g;
    }
    lines.push(`  ${tokenCssName(t.path)}: ${toCss(t)};${t.doc ? `  /* ${t.doc} */` : ''}`);
  }
  lines.push('}', '');
  return { css: lines.join('\n'), count: tokens.length };
}

export function checkTokens(): { ok: boolean; message: string } {
  const { css, count } = renderTokensCss();
  let cur = '';
  try {
    cur = readFileSync(TOKENS_OUT, 'utf8');
  } catch {
    /* 未生成 */
  }
  return cur === css
    ? { ok: true, message: `OK tokens.css は定義と一致（${count} トークン）` }
    : {
        ok: false,
        message:
          'NG tokens.css が design.tokens.json と一致しません。npm run tokens を実行してください。',
      };
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) {
    const r = checkTokens();
    if (!r.ok) {
      console.error(r.message);
      process.exit(1);
    }
    console.log(r.message);
  } else {
    const { css, count } = renderTokensCss();
    writeFileSync(TOKENS_OUT, css);
    console.log(`生成: src/styles/tokens.css（${count} トークン）`);
  }
}
