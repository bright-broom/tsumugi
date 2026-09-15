/**
 * お客様の声の型・公開条件・依頼表示（ADR 0059）。
 *
 * - 掲載許可があり、撤回されておらず、許可のあとに内容を直していない声だけを公開する。
 * - 事業者からの依頼・謝礼の有無（solicitation）は省略できない。表示の要否はここから決め、
 *   表示部品は必ずその表示を描画する。部品を通さない描画は missingDisclosures で見つける。
 * - 表示文言の最終確認は担当者（事業者）が行う。ここでは法的な評価をしない。
 */
import {
  assertNoErrors,
  consentActive,
  consentIssues,
  duplicates,
  error,
  isHttpsUrl,
  isIsoDate,
  photoIssues,
  warning,
  type ConsentRecord,
  type IsoDate,
  type Issue,
  type Photo,
} from '@/lib/storefront/core';

export type SourceKind = 'survey' | 'letter' | 'email' | 'interview' | 'reviewSite' | 'social';
export type IncentiveKind = 'gift' | 'discount' | 'cash' | 'service' | 'other';
export type Disclosure = 'requested' | 'incentive' | 'requestedWithIncentive';

export interface TestimonialPermission extends ConsentRecord {
  /** 掲載名（displayName）を出してよいか。不可なら匿名の表記にする */
  showName: boolean;
  showPhoto: boolean;
}

export interface Testimonial {
  /** 英小文字・数字・ハイフン */
  id: string;
  /** 本人に確認した本文 */
  body: string;
  /** 本人が了承した掲載名（例: 「A 様」） */
  displayName: string;
  photo?: Photo;
  /** 出典。どこで・いつ受け取った声か */
  source: { kind: SourceKind; collectedOn: IsoDate; url?: string };
  permission: TestimonialPermission | null;
  /** 事業者から依頼したか・謝礼を渡したか。依頼も謝礼もない場合も明示する */
  solicitation: { requested: boolean; incentive: IncentiveKind | null };
  /** 本文・掲載名を最後に直した日。許可を得た日より後なら、再確認まで公開しない */
  revisedOn?: IsoDate;
  status: 'published' | 'draft';
}

export interface PublishedTestimonial {
  id: string;
  body: string;
  /** null のときは匿名の表記を使う */
  name: string | null;
  photo?: Photo;
  source: Testimonial['source'];
  disclosure: Disclosure | null;
  incentive: IncentiveKind | null;
}

export function disclosureOf(solicitation: Testimonial['solicitation']): Disclosure | null {
  if (solicitation.requested && solicitation.incentive) return 'requestedWithIncentive';
  if (solicitation.incentive) return 'incentive';
  return solicitation.requested ? 'requested' : null;
}

const revisedAfterPermission = (testimonial: Testimonial) =>
  Boolean(
    testimonial.revisedOn &&
    testimonial.permission &&
    testimonial.revisedOn > testimonial.permission.grantedOn,
  );

export function publishableTestimonials(
  testimonials: readonly Testimonial[],
): PublishedTestimonial[] {
  return testimonials.flatMap((testimonial) => {
    const { permission } = testimonial;
    if (
      testimonial.status !== 'published' ||
      !permission ||
      !consentActive(permission) ||
      revisedAfterPermission(testimonial)
    )
      return [];
    return [
      {
        id: testimonial.id,
        body: testimonial.body,
        name: permission.showName ? testimonial.displayName : null,
        ...(testimonial.photo && permission.showPhoto ? { photo: testimonial.photo } : {}),
        source: testimonial.source,
        disclosure: disclosureOf(testimonial.solicitation),
        incentive: testimonial.solicitation.incentive,
      },
    ];
  });
}

export function validateTestimonials(testimonials: readonly Testimonial[]): Issue[] {
  const issues: Issue[] = [];
  for (const id of duplicates(testimonials.map((testimonial) => testimonial.id)))
    issues.push(error('testimonial.duplicate-id', id));
  for (const testimonial of testimonials) {
    const at = testimonial.id;
    const { permission, source } = testimonial;
    if (!/^[a-z0-9-]+$/.test(testimonial.id)) issues.push(error('testimonial.invalid-id', at));
    if (!testimonial.body.trim()) issues.push(error('testimonial.missing-body', `${at}.body`));
    if (!isIsoDate(source.collectedOn))
      issues.push(error('testimonial.invalid-date', `${at}.source.collectedOn`));
    if (source.url !== undefined && !isHttpsUrl(source.url))
      issues.push(error('testimonial.invalid-source-url', `${at}.source.url`));
    if (testimonial.photo) issues.push(...photoIssues(testimonial.photo, `${at}.photo`));
    if (testimonial.revisedOn !== undefined && !isIsoDate(testimonial.revisedOn))
      issues.push(error('testimonial.invalid-date', `${at}.revisedOn`));
    if (permission) {
      issues.push(...consentIssues(permission, `${at}.permission`));
      if (permission.showName && !testimonial.displayName.trim())
        issues.push(error('testimonial.missing-name', `${at}.displayName`));
      if (testimonial.photo && !permission.showPhoto)
        issues.push(warning('testimonial.photo-not-permitted', `${at}.photo`));
    }
    if (testimonial.status !== 'published') continue;
    if (!permission)
      issues.push(error('testimonial.published-without-permission', `${at}.permission`));
    else if (permission.withdrawnOn)
      issues.push(warning('testimonial.permission-withdrawn', `${at}.permission`));
    if (revisedAfterPermission(testimonial))
      issues.push(warning('testimonial.revision-not-approved', `${at}.revisedOn`));
  }
  return issues;
}

export const defineTestimonials = (testimonials: readonly Testimonial[]): readonly Testimonial[] =>
  assertNoErrors(testimonials, validateTestimonials(testimonials), 'testimonials');

/**
 * 描画した HTML で、表示が必要な声のブロックに依頼・謝礼の表示が無いものの id を返す。
 * labels を渡すと、属性だけでなく表示文言が同じブロックにあることも確かめる。
 */
export function missingDisclosures(
  html: string,
  published: readonly PublishedTestimonial[],
  labels?: (testimonial: PublishedTestimonial) => readonly string[],
): string[] {
  return published.flatMap((testimonial) => {
    if (!testimonial.disclosure) return [];
    const marker = `data-testimonial="${testimonial.id}"`;
    const missing: string[] = [];
    for (let at = html.indexOf(marker); at >= 0; at = html.indexOf(marker, at + marker.length)) {
      const start = html.lastIndexOf('<', at);
      const end = html.indexOf('</article>', at);
      const block = html.slice(start, end < 0 ? undefined : end);
      const attributed = block.includes(`data-disclosure="${testimonial.disclosure}"`);
      const labelled = (labels?.(testimonial) ?? []).every((label) => block.includes(label));
      if (!attributed || !labelled) missing.push(testimonial.id);
    }
    return missing;
  });
}
