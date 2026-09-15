/**
 * 受付結果の HTML（JavaScript なし）。成功・入力エラー・受付障害・送信過多・形式不正の 5 種類。
 * どの結果にも電話とメールの代替導線を載せる。文言はカタログ（i18n/locales/ja/inquiry.ts・contact.ts）から受け取り、
 * 利用者の入力はすべてエスケープして、表示用の整形を通さずに出す。
 */
import type { Messages } from '@/i18n/catalog';
import { format } from '@/i18n/format';
import { esc } from '@/lib/raw';
import type { BusinessCalendar } from './calendar';
import type { FieldError, FieldName, SubmittedValues } from './schema';

export interface InquiryPresentation {
  language: string;
  brand: string;
  copy: Messages['inquiry'];
  form: Messages['contact'];
  contact: { tel: string; telLink: string; telHours: string; email: string; responsePromise: string };
  links: { site: string; contact: string; stylesheet: string | null };
  industries: readonly string[];
  industryPlaceholder: string;
  honeypotField: string;
}

export function formatLocalDateTime(p: InquiryPresentation, calendar: BusinessCalendar, at: Date) {
  const { year, month, day, hour, minute } = calendar.localParts(at);
  return format(p.copy.dateTime, { year, month, day, hour, minute: String(minute).padStart(2, '0') });
}

function document(p: InquiryPresentation, title: string, heading: string, content: string) {
  const stylesheet = p.links.stylesheet
    ? `<link rel="stylesheet" href="${esc(p.links.stylesheet)}">`
    : '';
  return [
    '<!doctype html>',
    `<html lang="${esc(p.language)}"><head><meta charset="utf-8">`,
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="robots" content="noindex, nofollow">',
    `<title>${esc(title)}</title>${stylesheet}</head>`,
    `<body><main id="main"><section class="page-intro"><div class="wrap">`,
    `<h1>${esc(heading)}</h1>${content}`,
    '</div></section></main></body></html>',
  ].join('');
}

const paragraph = (text: string, className?: string) =>
  `<p${className ? ` class="${className}"` : ''}>${esc(text)}</p>`;

function alternatives(p: InquiryPresentation) {
  const { copy, contact } = p;
  return [
    `<section aria-labelledby="alternatives"><h2 id="alternatives">${esc(copy.alternativesHeading)}</h2><dl>`,
    `<dt>${esc(copy.phoneLabel)}</dt><dd><a class="tel" href="tel:${esc(contact.telLink)}">${esc(contact.tel)}</a>`,
    `<br>${esc(format(copy.phoneHours, { hours: contact.telHours }))}</dd>`,
    `<dt>${esc(copy.emailLabel)}</dt><dd><a href="mailto:${esc(contact.email)}">${esc(contact.email)}</a></dd>`,
    '</dl></section>',
  ].join('');
}

const link = (href: string, text: string, className = 'btn btn-2') =>
  `<p><a class="${className}" href="${esc(href)}">${esc(text)}</a></p>`;

export function renderAccepted(
  p: InquiryPresentation,
  view: { receiptId: string; received: string; deadline: string | null; duplicate: boolean },
) {
  const { copy } = p;
  const deadline = view.deadline
    ? format(copy.deadlineValue, { deadline: view.deadline })
    : format(copy.deadlineFallback, { responsePromise: p.contact.responsePromise });
  const content = [
    paragraph(format(copy.acceptedLede, { responsePromise: p.contact.responsePromise }), 'lede'),
    view.duplicate ? paragraph(copy.duplicateNote) : '',
    '<dl class="receipt">',
    `<dt>${esc(copy.receiptLabel)}</dt><dd><strong>${esc(view.receiptId)}</strong></dd>`,
    `<dt>${esc(copy.receivedLabel)}</dt><dd>${esc(view.received)}</dd>`,
    `<dt>${esc(copy.deadlineLabel)}</dt><dd>${esc(deadline)}</dd>`,
    '</dl>',
    paragraph(copy.acceptedKeep),
    `<h2>${esc(copy.noReplyHeading)}</h2>`,
    paragraph(copy.noReplyBody),
    alternatives(p),
    link(p.links.site, copy.backToSite),
  ].join('');
  return document(p, format(copy.titleAccepted, { brand: p.brand }), copy.headingAccepted, content);
}

const FIELD_IDS: Record<FieldName, string> = {
  name: 'f-name',
  business: 'f-biz',
  industry: 'f-ind',
  tel: 'f-tel',
  email: 'f-mail',
  message: 'f-msg',
};

function fieldLabel(p: InquiryPresentation, field: FieldName) {
  const f = p.form;
  return { name: f.label, business: f.label2, industry: f.label3, tel: f.label4, email: f.label5, message: f.label6 }[field];
}

function errorText(p: InquiryPresentation, field: FieldName, error: FieldError) {
  const { copy } = p;
  const label = fieldLabel(p, field);
  switch (error.code) {
    case 'required':
      return format(copy.errorRequired, { field: label });
    case 'too-long':
      return format(copy.errorTooLong, { field: label, max: error.max });
    case 'tel':
      return copy.errorTel;
    case 'email':
      return copy.errorEmail;
    case 'industry':
      return copy.errorIndustry;
  }
}

export function renderInvalid(
  p: InquiryPresentation,
  view: {
    action: string;
    values: SubmittedValues;
    errors: Partial<Record<FieldName, FieldError>>;
  },
) {
  const { copy, form } = p;
  const messages = Object.fromEntries(
    (Object.entries(view.errors) as [FieldName, FieldError][]).map(([field, error]) => [
      field,
      errorText(p, field, error),
    ]),
  ) as Partial<Record<FieldName, string>>;
  const required = new Set<FieldName>(['name', 'tel', 'message']);

  const field = (name: FieldName, control: (attributes: string) => string, hint?: string) => {
    const id = FIELD_IDS[name];
    const error = messages[name];
    const attributes = [
      `id="${id}"`,
      `name="${esc(name)}"`,
      required.has(name) ? 'required' : '',
      error ? `aria-invalid="true" aria-describedby="${id}-error"` : '',
    ]
      .filter(Boolean)
      .join(' ');
    return [
      '<div class="field">',
      `<label for="${id}">${esc(fieldLabel(p, name))}`,
      required.has(name) ? `<span class="req">${esc(form.req)}</span>` : '',
      '</label>',
      control(attributes),
      error ? `<p class="hint" id="${id}-error"><strong>${esc(error)}</strong></p>` : '',
      hint ? `<p class="hint">${esc(hint)}</p>` : '',
      '</div>',
    ].join('');
  };
  const input = (name: FieldName, type: string, autocomplete: string) =>
    field(name, (a) => `<input type="${type}" ${a} autocomplete="${autocomplete}" value="${esc(view.values[name])}">`);
  const options = [p.industryPlaceholder, ...p.industries]
    .map((option, index) => {
      const selected = index > 0 && option === view.values.industry ? ' selected' : '';
      return `<option${index === 0 ? ' value=""' : ''}${selected}>${esc(option)}</option>`;
    })
    .join('');

  const summary = (Object.keys(FIELD_IDS) as FieldName[])
    .filter((name) => messages[name])
    .map((name) => `<li><a href="#${FIELD_IDS[name]}">${esc(messages[name]!)}</a></li>`)
    .join('');

  const content = [
    paragraph(copy.invalidLede, 'lede'),
    `<ul class="error-summary">${summary}</ul>`,
    `<form action="${esc(view.action)}" method="post">`,
    input('name', 'text', 'name'),
    input('business', 'text', 'organization'),
    field('industry', (a) => `<select ${a}>${options}</select>`),
    field('tel', (a) => `<input type="tel" ${a} autocomplete="tel" inputmode="tel" value="${esc(view.values.tel)}">`, form.hint),
    field('email', (a) => `<input type="email" ${a} autocomplete="email" inputmode="email" value="${esc(view.values.email)}">`),
    field('message', (a) => `<textarea ${a}>${esc(view.values.message)}</textarea>`, form.hint2),
    `<div hidden><label for="f-hp">${esc(form.honeypotLabel)}</label>`,
    `<input type="text" id="f-hp" name="${esc(p.honeypotField)}" tabindex="-1" autocomplete="off"></div>`,
    `<button class="btn btn-1" type="submit">${esc(copy.submitAgain)}</button>`,
    '</form>',
    paragraph(form.dim, 'dim'),
    alternatives(p),
  ].join('');
  return document(p, format(copy.titleInvalid, { brand: p.brand }), copy.headingInvalid, content);
}

export function renderUnavailable(p: InquiryPresentation, view: { values: SubmittedValues }) {
  const { copy } = p;
  const content = [
    paragraph(copy.unavailableLede, 'lede'),
    paragraph(copy.unavailableNext),
    alternatives(p),
    view.values.message
      ? `<div class="field"><label for="f-copy">${esc(copy.unavailableCopyLabel)}</label><textarea id="f-copy" readonly>${esc(view.values.message)}</textarea></div>`
      : '',
    link(p.links.contact, copy.backToContact),
  ].join('');
  return document(p, format(copy.titleUnavailable, { brand: p.brand }), copy.headingUnavailable, content);
}

export function renderLimited(p: InquiryPresentation, view: { retryAfterSeconds: number }) {
  const { copy } = p;
  const minutes = Math.max(1, Math.ceil(view.retryAfterSeconds / 60));
  const content = [
    paragraph(format(copy.limitedLede, { minutes }), 'lede'),
    alternatives(p),
    link(p.links.contact, copy.backToContact),
  ].join('');
  return document(p, format(copy.titleLimited, { brand: p.brand }), copy.headingLimited, content);
}

export function renderRejected(p: InquiryPresentation) {
  const { copy } = p;
  const content = [paragraph(copy.rejectedLede, 'lede'), alternatives(p), link(p.links.contact, copy.backToContact)].join('');
  return document(p, format(copy.titleRejected, { brand: p.brand }), copy.headingRejected, content);
}
