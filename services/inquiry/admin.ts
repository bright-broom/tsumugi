/**
 * 担当者の画面（ADR 0079、監査 C06）。操作はすべて access.ts の窓口を通し、権限の判定と履歴を残す。
 * JavaScript を使わず、通常のリンクとフォーム送信だけで動く。変更の POST は同じ origin からのものだけを受ける。
 * 文言は src/i18n/locales/ja/inquiryAdmin.ts。
 */
import { getMessages } from '@/i18n/catalog';
import { format } from '@/i18n/format';
import { AccessDeniedError, type createInquiryDesk } from './access';
import type { StaffIdentity } from './auth';
import type { ContractStatus, InquiryRecord, ReplyChannel } from './records';
import { responseState } from './response';

type Desk = ReturnType<typeof createInquiryDesk>;
const t = getMessages().inquiryAdmin;

const esc = (value: unknown) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const JST = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  dateStyle: 'medium',
  timeStyle: 'short',
});
const DASH = '—';
const when = (iso: string | null) => (iso ? JST.format(new Date(iso)) : DASH);
const text = (message: string) => `<p>${esc(message)}</p>`;

function page(title: string, body: string, status = 200) {
  return new Response(
    `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(title)}｜${esc(t.titleSuffix)}</title>
</head>
<body>
<nav aria-label="${esc(t.navLabel)}"><a href="/admin">${esc(t.nav.list)}</a> ｜ <a href="/admin/retention">${esc(t.nav.retention)}</a> ｜ <a href="/admin/audit">${esc(t.nav.audit)}</a></nav>
<main>
<h1>${esc(title)}</h1>
${body}
</main>
</body>
</html>
`,
    {
      status,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'DENY',
        'referrer-policy': 'no-referrer',
        'content-security-policy':
          "default-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      },
    },
  );
}

const redirect = (location: string) =>
  new Response(null, { status: 303, headers: { location, 'cache-control': 'no-store' } });

function table(head: readonly string[], rows: readonly (readonly string[])[]) {
  if (!rows.length) return text(t.empty);
  return `<table><thead><tr>${head.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`)
    .join('')}</tbody></table>`;
}

const options = (labels: Readonly<Record<string, string>>, selected?: string) =>
  Object.entries(labels)
    .map(
      ([value, label]) =>
        `<option value="${esc(value)}"${value === selected ? ' selected' : ''}>${esc(label)}</option>`,
    )
    .join('');

const checkbox = (label: string) =>
  `<label><input type="checkbox" name="confirm" value="yes" required> ${esc(label)}</label>`;
const submit = (label: string) => `<button type="submit">${esc(label)}</button>`;

function detail(record: InquiryRecord, now: Date) {
  const f = record.fields;
  const d = t.detail;
  const base = `/admin/inquiries/${encodeURIComponent(record.id)}`;
  const reply = record.response.firstReplyAt
    ? format(t.firstReplyValue, {
        at: when(record.response.firstReplyAt),
        channel: t.replyChannels[record.response.firstReplyChannel!],
      })
    : DASH;
  const hold = record.legalHold
    ? format(t.holdValue, { reason: record.legalHold.reason, at: when(record.legalHold.placedAt) })
    : t.none;
  const rows: [string, string][] = [
    [t.fields.receivedAt, when(record.receivedAt)],
    [t.fields.deadline, when(record.response.deadline)],
    [t.fields.responseState, t.response[responseState(record, now)]],
    [t.fields.firstReply, esc(reply)],
    [t.fields.name, esc(f.name)],
    [t.fields.business, esc(f.business ?? DASH)],
    [t.fields.industry, esc(f.industry ?? DASH)],
    [t.fields.tel, esc(f.tel)],
    [t.fields.email, esc(f.email ?? DASH)],
    [t.fields.message, `<pre>${esc(f.message)}</pre>`],
    [t.fields.contract, t.contract[record.contract.status]],
    [t.fields.hold, esc(hold)],
  ];
  return `<dl>${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>
<h2>${esc(d.notifications)}</h2>
${table(
  d.notifyHead,
  record.notifications.map((n) => [
    esc(n.channel),
    t.notify[n.status],
    String(n.attempts),
    when(n.deliveredAt),
    esc(n.lastError ?? DASH),
  ]),
)}
<h2>${esc(d.replyHeading)}</h2>
${
  record.response.firstReplyAt
    ? text(d.replyDone)
    : `<form method="post" action="${base}/reply"><label>${esc(d.replyChannel)} <select name="channel">${options(t.replyChannels)}</select></label> ${submit(d.replySubmit)}</form>`
}
<h2>${esc(d.contractHeading)}</h2>
<form method="post" action="${base}/contract"><label>${esc(d.contractField)} <select name="status">${options(t.contract, record.contract.status)}</select></label> ${submit(d.contractSubmit)}</form>
<h2>${esc(d.holdHeading)}</h2>
${
  record.legalHold
    ? `<form method="post" action="${base}/release">${submit(d.release)}</form>`
    : `<form method="post" action="${base}/hold"><label>${esc(d.holdReason)} <input name="reason" required maxlength="60"></label> ${submit(d.holdSubmit)}</form>`
}
<h2>${esc(d.eraseHeading)}</h2>
<form method="post" action="${base}/erase">${checkbox(d.eraseConfirm)} ${submit(d.eraseSubmit)}</form>`;
}

async function formOf(request: Request): Promise<URLSearchParams | null> {
  const type = (request.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
  if (type !== 'application/x-www-form-urlencoded') return null;
  const body = await request.text();
  if (body.length > 4096) return null;
  return new URLSearchParams(body);
}

/** 同じ origin の画面からの送信だけを受ける（Access のクッキーを悪用した他サイトからの送信を止める）。 */
function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const site = request.headers.get('sec-fetch-site');
  return origin === new URL(request.url).origin && (site === null || site === 'same-origin');
}

const e = t.errors;
const invalid = (message: string, status = 400) => page(e.invalidTitle, text(message), status);

export function createAdminRoutes(options: {
  desk: Desk;
  verify: (request: Request) => Promise<StaffIdentity | null>;
  now?: () => Date;
}) {
  const now = options.now ?? (() => new Date());
  const { desk } = options;

  async function change(request: Request, actor: string, id: string, action: string) {
    const form = await formOf(request);
    if (!form) return invalid(e.invalidForm, 415);
    let updated: unknown;
    if (action === 'reply') {
      const channel = form.get('channel') ?? '';
      if (!Object.hasOwn(t.replyChannels, channel)) return invalid(e.chooseChannel);
      updated = await desk.recordFirstReply(actor, id, now(), channel as ReplyChannel);
    } else if (action === 'contract') {
      const status = form.get('status') ?? '';
      if (!Object.hasOwn(t.contract, status)) return invalid(e.chooseStatus);
      updated = await desk.setContractStatus(actor, id, status as ContractStatus, now());
    } else if (action === 'hold') {
      const reason = form.get('reason')?.trim() ?? '';
      if (!reason || reason.length > 60) return invalid(e.reasonInvalid);
      updated = await desk.placeLegalHold(actor, id, reason);
    } else if (action === 'release') {
      updated = await desk.releaseLegalHold(actor, id);
    } else {
      if (form.get('confirm') !== 'yes') return page(e.confirmTitle, text(e.confirmBody), 400);
      const result = await desk.erase(actor, id);
      if (!result.erased)
        return page(
          e.eraseRefusedTitle,
          text(format(e.eraseRefused, { reason: result.reason })),
          409,
        );
      return redirect('/admin');
    }
    if (updated === undefined) return page(e.notFoundTitle, text(e.recordMissing), 404);
    return redirect(`/admin/inquiries/${encodeURIComponent(id)}`);
  }

  async function route(request: Request, actor: string, path: string): Promise<Response> {
    if (request.method === 'GET' && (path === '/admin' || path === '/admin/')) {
      const current = now();
      const records = (await desk.list(actor))
        .filter((r) => r.disposition === 'accepted')
        .reverse();
      return page(
        t.list.title,
        table(
          t.list.head,
          records.map((r) => [
            `<a href="/admin/inquiries/${encodeURIComponent(r.id)}">${esc(r.id)}</a>`,
            when(r.receivedAt),
            esc(r.fields.name),
            t.response[responseState(r, current)],
            t.contract[r.contract.status],
            r.notifications.map((n) => `${esc(n.channel)}:${t.notify[n.status]}`).join(' / '),
          ]),
        ),
      );
    }
    if (path === '/admin/retention') {
      const r = t.retention;
      if (request.method === 'GET') {
        const run = await desk.runRetention(actor, { dryRun: true });
        return page(
          r.previewTitle,
          `${text(format(r.previewSummary, { due: run.due.length, exceptions: run.exceptions.length, kept: run.kept }))}
${table(
  r.head,
  run.due.map((d) => [esc(d.id), esc(d.reason)]),
)}
<form method="post" action="/admin/retention">${checkbox(r.confirm)} ${submit(r.submit)}</form>`,
        );
      }
      if (request.method === 'POST') {
        const form = await formOf(request);
        if (form?.get('confirm') !== 'yes') return page(e.confirmTitle, text(e.confirmBody), 400);
        const run = await desk.runRetention(actor, { dryRun: false });
        return page(
          r.runTitle,
          text(
            format(r.runSummary, {
              deleted: run.deleted.length,
              errors: run.errors.length,
              exceptions: run.exceptions.length,
            }),
          ),
          run.errors.length ? 500 : 200,
        );
      }
    }
    if (request.method === 'GET' && path === '/admin/audit') {
      const events = await desk.auditTrail(actor);
      return page(
        t.audit.title,
        table(
          t.audit.head,
          events
            .slice()
            .reverse()
            .map((ev) => [
              when(ev.at),
              esc(ev.actorId),
              esc(ev.action),
              esc(ev.target ?? DASH),
              esc(ev.outcome),
              esc(ev.detail ?? ''),
            ]),
        ),
      );
    }
    const match = /^\/admin\/inquiries\/([^/]+)(?:\/(reply|contract|hold|release|erase))?$/.exec(
      path,
    );
    if (match) {
      const id = decodeURIComponent(match[1]!);
      const action = match[2];
      if (!action && request.method === 'GET') {
        const record = await desk.view(actor, id);
        if (!record) return page(e.notFoundTitle, text(e.recordGone), 404);
        return page(format(t.detail.title, { id: record.id }), detail(record, now()));
      }
      if (action && request.method === 'POST') return change(request, actor, id, action);
    }
    return page(e.notFoundTitle, text(e.noPage), 404);
  }

  /** /admin 以外は null を返し、ほかの経路に任せる。 */
  return async function handleAdmin(request: Request): Promise<Response | null> {
    const path = new URL(request.url).pathname;
    if (path !== '/admin' && !path.startsWith('/admin/')) return null;
    const identity = await options.verify(request);
    if (!identity) return page(e.loginTitle, text(e.loginBody), 401);
    if (request.method === 'POST' && !sameOrigin(request))
      return page(e.invalidTitle, text(e.sameOrigin), 403);
    if (request.method !== 'GET' && request.method !== 'POST')
      return page(e.invalidTitle, text(e.method), 405);
    try {
      return await route(request, identity.staffId, path);
    } catch (error) {
      if (error instanceof AccessDeniedError) return page(e.deniedTitle, text(e.deniedBody), 403);
      throw error;
    }
  };
}
