/**
 * 公開条件の検査（#13・#39、ADR 0024）。
 *
 * - プレビュー（既定）：確認用の配備。仮の値が残っていても通し、本番の不足を WARN 1 件にまとめて示す。
 *   ただし PLACEHOLDER=false（公開の準備ができたと宣言した状態）で仮の値が残っていれば FAIL にする。
 * - 本番：仮の値・未接続の受付・承認記録や人の確認記録の不足を、1 条件ずつ FAIL にする。
 *
 * 判定（evaluatePublication）は設定のスナップショットだけを受け取る純粋関数。
 * 実際の設定からスナップショットを作るのは publicationSnapshot。
 */
import { createHash } from 'node:crypto';
import * as C from '@/content/config';
import { getMessages } from '@/i18n/catalog';
import type { Result } from './results';

export type VerifyMode = 'preview' | 'production';

/**
 * 検査モードを決める。`--mode` が無ければ Vercel の VERCEL_ENV から決める（production なら本番）。
 * 本番の配備でプレビューの検査を指定したら、黙って通さずにエラーにする。
 * flag は `--mode` が無ければ undefined、値が無ければ null。
 */
export function resolveMode(
  flag: string | null | undefined,
  env: Readonly<Record<string, string | undefined>>,
): { mode: VerifyMode } | { error: string } {
  const vercelProduction = env.VERCEL_ENV === 'production';
  if (flag === undefined) return { mode: vercelProduction ? 'production' : 'preview' };
  if (flag === 'production') return { mode: 'production' };
  if (flag === 'preview' && !vercelProduction) return { mode: 'preview' };
  if (flag === 'preview')
    return { error: 'VERCEL_ENV=production の配備では --mode preview を指定できません（本番の公開条件を検査します）' };
  return { error: `--mode には preview か production を指定してください（指定：${flag ?? '値なし'}）` };
}

type FieldKind = 'domain' | 'tel' | 'email' | 'postal' | 'text';
interface PublicationField {
  key: string;
  kind: FieldKind;
  value: string;
}
interface ApprovalState {
  id: C.LegalDocumentId;
  record: C.LegalApproval;
  /** いまの文面の SHA-256 */
  currentSha256: string;
}
export interface PublicationSnapshot {
  placeholder: boolean;
  fields: PublicationField[];
  formEndpoint: string;
  approvals: ApprovalState[];
  /** 人の確認・外部接続の確認が必要なのに、記録が無い仕様の項目 */
  humanChecksPending: string[];
}

/** 例示・テスト用に予約されたドメイン（RFC 2606 / 6761、JPRS の example.jp など） */
const RESERVED_DOMAIN =
  /(^|\.)(example|test|invalid|localhost|local)$|(^|\.)example\.(com|net|org|jp|co\.jp)$/i;
/** 仮の値の書き方：全体を括弧でくくった「（名前）」、〇〇、XXX、準備中 */
const MARKER = /^[（(［[【].*[）)］\]】]$|[〇○◯]{2}|[XＸ]{3}|準備中/u;
const DOMAIN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** 値が公開に使えないなら理由を返す。使えるなら null */
export function placeholderProblem(kind: FieldKind, raw: string): string | null {
  const value = raw.trim();
  if (!value) return '未設定';
  if (MARKER.test(value)) return `仮の値「${value}」`;
  switch (kind) {
    case 'domain':
      if (!DOMAIN.test(value)) return `ドメインの形式ではありません「${value}」`;
      return RESERVED_DOMAIN.test(value) ? `例示用のドメイン「${value}」` : null;
    case 'email': {
      const domain = value.match(/^[^\s@]+@([^\s@]+)$/)?.[1];
      if (!domain || !DOMAIN.test(domain)) return `メールアドレスの形式ではありません「${value}」`;
      return RESERVED_DOMAIN.test(domain) ? `例示用のドメイン「${value}」` : null;
    }
    case 'tel': {
      if (value.split(/[-\s]/).some((group) => /^0+$/.test(group))) return `仮の値「${value}」`;
      const digits = value.replace(/\D/g, '');
      return /^0\d{9,10}$/.test(digits) ? null : `電話番号の桁数・形式ではありません「${value}」`;
    }
    case 'postal':
      if (!/^\d{3}-\d{4}$/.test(value)) return `郵便番号の形式（123-4567）ではありません「${value}」`;
      return /^0{3}-0{4}$/.test(value) ? `仮の値「${value}」` : null;
    case 'text':
      return null;
  }
}

/** 問い合わせの送信先。https の URL か、同じサイトの絶対パス（/ で始まる）だけを受け付ける */
export function endpointProblem(raw: string): string | null {
  const value = raw.trim();
  if (!value) return '未設定（問い合わせを受け付けられません）';
  if (value.startsWith('/') && !value.startsWith('//')) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return `URL の形式ではありません「${value}」`;
  }
  if (url.protocol !== 'https:') return `https ではありません「${value}」`;
  return RESERVED_DOMAIN.test(url.hostname) ? `例示用のドメイン「${url.hostname}」` : null;
}

type Family = 'flag' | 'value' | 'connection' | 'approval' | 'broken-approval' | 'acceptance';
interface Condition {
  target: string;
  family: Family;
  problem: string | null;
}

function approvalCondition(state: ApprovalState, today: string): Condition {
  const target = `LEGAL_APPROVALS.${state.id}`;
  const r = state.record;
  const fields = ['version', 'approvedOn', 'reviewerRole', 'catalogSha256'] as const;
  const missing = fields.filter((key) => !r[key]?.trim());
  const current = `現在の文面の SHA-256：${state.currentSha256}`;
  if (missing.length === fields.length)
    return { target, family: 'approval', problem: `承認記録がありません（版・承認日・確認者の役割・文面の SHA-256）。${current}` };
  if (missing.length)
    return { target, family: 'approval', problem: `承認記録が足りません：${missing.join('・')}。${current}` };
  // 4 つが揃うとページは「確認済み」として表示されるので、ここから先の不備はプレビューでも止める。
  if (!DATE.test(r.approvedOn!) || Number.isNaN(Date.parse(r.approvedOn!)) || r.approvedOn! > today)
    return { target, family: 'broken-approval', problem: `承認日が不正です「${r.approvedOn}」` };
  if (r.catalogSha256 !== state.currentSha256)
    return {
      target,
      family: 'broken-approval',
      problem: `承認のあとで文面が変わりました（承認時 ${r.catalogSha256!.slice(0, 12)}… → 現在 ${state.currentSha256.slice(0, 12)}…）。確認を受け直して記録を更新してください`,
    };
  return { target, family: 'approval', problem: null };
}

/** 公開条件の判定。today は日本時間の YYYY-MM-DD */
export function evaluatePublication(
  snapshot: PublicationSnapshot,
  mode: VerifyMode,
  today: string,
): Result[] {
  const conditions: Condition[] = [
    {
      target: 'PLACEHOLDER',
      family: 'flag',
      problem: snapshot.placeholder ? 'true のまま（全ページに「準備中」の帯が出ます）' : null,
    },
    ...snapshot.fields.map((f) => ({
      target: f.key,
      family: 'value' as const,
      problem: placeholderProblem(f.kind, f.value),
    })),
    { target: 'FORM_ENDPOINT', family: 'connection', problem: endpointProblem(snapshot.formEndpoint) },
    ...snapshot.approvals.map((a) => approvalCondition(a, today)),
    {
      target: 'ACCEPTANCE_RECORDS',
      family: 'acceptance',
      problem: snapshot.humanChecksPending.length
        ? `人の確認・外部接続の確認の記録がありません：${snapshot.humanChecksPending.join('・')}`
        : null,
    },
  ];

  if (mode === 'production')
    return conditions.map((c) => ({
      level: c.problem ? 'FAIL' : 'PASS',
      check: '公開条件（本番）',
      page: c.target,
      detail: c.problem ?? '',
    }));

  const unmet = conditions.filter((c) => c.problem);
  const out: Result[] = unmet
    .filter((c) => c.family === 'broken-approval' || (!snapshot.placeholder && c.family === 'value'))
    .map((c) => ({
      level: 'FAIL',
      check: c.family === 'broken-approval' ? '契約文面の承認' : '公開前チェック',
      page: c.target,
      detail: c.problem!,
    }));
  const rest = unmet.filter(
    (c) => c.family !== 'broken-approval' && (snapshot.placeholder || c.family !== 'value'),
  );
  if (rest.length)
    out.push({
      level: 'WARN',
      check: '公開前チェック',
      page: 'config.ts',
      detail: `プレビューとして検査。本番の公開条件を満たしていない ${rest.length} 件：${rest.map((c) => c.target).join('・')}（詳細は --mode production）`,
    });
  else if (!out.length)
    out.push({ level: 'PASS', check: '公開前チェック', page: 'config.ts', detail: '本番の公開条件をすべて満たしています' });
  return out;
}

/** 承認の対象にする文面（i18n カタログ）の SHA-256 */
export function catalogSha256(id: C.LegalDocumentId): string {
  return createHash('sha256').update(JSON.stringify(getMessages()[id])).digest('hex');
}

/** 実際の設定から判定の入力を作る */
export function publicationSnapshot(humanChecksPending: string[]): PublicationSnapshot {
  const text = (key: string, value: string): PublicationField => ({ key, kind: 'text', value });
  return {
    placeholder: C.PLACEHOLDER,
    fields: [
      { key: 'DOMAIN', kind: 'domain', value: C.DOMAIN },
      { key: 'TEL', kind: 'tel', value: C.TEL },
      { key: 'EMAIL', kind: 'email', value: C.EMAIL },
      { key: 'POSTAL_CODE', kind: 'postal', value: C.POSTAL_CODE },
      text('ADDRESS_REGION', C.ADDRESS_REGION),
      text('ADDRESS_CITY', C.ADDRESS_CITY),
      text('ADDRESS_STREET', C.ADDRESS_STREET),
      text('LEGAL_NAME', C.LEGAL_NAME),
      ...C.MEMBERS.flatMap((m, i) => [text(`MEMBERS[${i}].name`, m.name), text(`MEMBERS[${i}].bio`, m.bio)]),
    ],
    formEndpoint: C.FORM_ENDPOINT,
    approvals: (Object.keys(C.LEGAL_APPROVALS) as C.LegalDocumentId[]).map((id) => ({
      id,
      record: C.LEGAL_APPROVALS[id],
      currentSha256: catalogSha256(id),
    })),
    humanChecksPending,
  };
}
