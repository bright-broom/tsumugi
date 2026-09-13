#!/usr/bin/env node
/**
 * design.tokens.json (DTCG Format Module 2025.10) -> tokens.css
 *
 *   node native/build-tokens.mjs           生成する
 *   node native/build-tokens.mjs --check   生成物と定義が一致するか検査する（CI向け）
 *
 * 扱う $type は color / dimension / duration / fontFamily / fontWeight / number と参照のみ。
 * 仕様全体への対応は保証しない。未知の型・欠落参照・循環参照はエラーにする。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "design.tokens.json");
const OUT = join(HERE, "tokens.css");
const PREFIX = "--nah-";
const TYPES = new Set(["color", "dimension", "duration", "fontFamily", "fontWeight", "number"]);

const isToken = (v) => v && typeof v === "object" && "$value" in v;

/** グループの $type を子に継がせながら平坦化する */
function flatten(node, path = [], inherited = null, out = []) {
  const type = node.$type ?? inherited;
  for (const [key, val] of Object.entries(node)) {
    if (key.startsWith("$")) continue;
    const next = [...path, key];
    if (isToken(val)) {
      const t = val.$type ?? type;
      if (!t) throw new Error(`型が決まらない: ${next.join(".")}`);
      if (!TYPES.has(t)) throw new Error(`未対応の $type "${t}": ${next.join(".")}`);
      out.push({ path: next, type: t, value: val.$value, doc: val.$description });
    } else if (val && typeof val === "object") {
      flatten(val, next, val.$type ?? type, out);
    }
  }
  return out;
}

const REF = /^\{([^}]+)\}$/;

function resolve(tokens) {
  const byPath = new Map(tokens.map((t) => [t.path.join("."), t]));
  const done = new Map();
  const walk = (key, seen) => {
    if (done.has(key)) return done.get(key);
    if (seen.has(key)) throw new Error(`循環参照: ${[...seen, key].join(" -> ")}`);
    const tok = byPath.get(key);
    if (!tok) throw new Error(`参照先がない: {${key}}`);
    const m = typeof tok.value === "string" && tok.value.match(REF);
    const v = m ? walk(m[1], new Set([...seen, key])) : tok.value;
    done.set(key, v);
    return v;
  };
  for (const t of tokens) t.resolved = walk(t.path.join("."), new Set());
  return tokens;
}

function toCss(t) {
  const v = t.resolved;
  if (t.type === "fontFamily") {
    const list = Array.isArray(v) ? v : [v];
    return list.map((f) => (/^[A-Za-z][\w-]*$/.test(f) ? f : `"${f}"`)).join(", ");
  }
  return String(v);
}

const src = JSON.parse(readFileSync(SRC, "utf8"));
const tokens = resolve(flatten(src));

const lines = [
  "/* 生成物。手で編集しない。",
  " * 出所: native/design.tokens.json",
  " * 生成: node native/build-tokens.mjs",
  ` * トークン数: ${tokens.length}`,
  " */",
  ":root {",
];
let group = null;
for (const t of tokens) {
  const g = t.path[0];
  if (g !== group) {
    lines.push(`${group ? "\n" : ""}  /* ${g} */`);
    group = g;
  }
  const name = PREFIX + t.path.join("-");
  lines.push(`  ${name}: ${toCss(t)};${t.doc ? `  /* ${t.doc} */` : ""}`);
}
lines.push("}", "");
const css = lines.join("\n");

if (process.argv.includes("--check")) {
  let cur = "";
  try { cur = readFileSync(OUT, "utf8"); } catch { /* 未生成 */ }
  if (cur !== css) {
    console.error("NG tokens.css が design.tokens.json と一致しません。node native/build-tokens.mjs を実行してください。");
    process.exit(1);
  }
  console.log(`OK tokens.css は定義と一致（${tokens.length} トークン）`);
} else {
  writeFileSync(OUT, css);
  console.log(`生成: native/tokens.css（${tokens.length} トークン）`);
}
