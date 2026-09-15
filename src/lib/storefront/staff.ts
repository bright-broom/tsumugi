/**
 * スタッフ紹介の型と公開条件（ADR 0058）。
 *
 * 公開してよいのは、status が public で、紹介文の掲載に本人の同意がある人だけ。
 * 写真は写真の同意が別にあるときだけ出す。非公開・退職はデータを消さずに status で止める。
 */
import {
  assertNoErrors,
  consentActive,
  consentIssues,
  duplicates,
  error,
  isIsoDate,
  photoIssues,
  warning,
  type ConsentRecord,
  type IsoDate,
  type Issue,
  type Photo,
} from '@/lib/storefront/core';

export type StaffStatus = 'public' | 'hidden' | 'retired';

export interface StaffMember {
  /** ページ内リンク（#staff-ID）に使う。英小文字・数字・ハイフン */
  id: string;
  name: string;
  role: string;
  bio: string;
  /** 小さい順に並べる */
  order: number;
  status: StaffStatus;
  /** 退職した日。status を retired にするときに記録する */
  retiredOn?: IsoDate;
  /** 掲載内容を本人と最後に確認した日 */
  reviewedOn: IsoDate;
  photo?: Photo;
  consent: { profile: ConsentRecord | null; photo: ConsentRecord | null };
}

export interface PublishedStaff {
  id: string;
  name: string;
  role: string;
  bio: string;
  photo?: Photo;
}

export function publishedStaff(members: readonly StaffMember[]): PublishedStaff[] {
  return members
    .filter((member) => member.status === 'public' && consentActive(member.consent.profile))
    .toSorted((a, b) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map(({ id, name, role, bio, photo, consent }) => ({
      id,
      name,
      role,
      bio,
      ...(photo && consentActive(consent.photo) ? { photo } : {}),
    }));
}

export function validateStaff(members: readonly StaffMember[]): Issue[] {
  const issues: Issue[] = [];
  for (const id of duplicates(members.map((member) => member.id)))
    issues.push(error('staff.duplicate-id', id));
  const listed = members.filter((member) => member.status === 'public');
  for (const order of duplicates(listed.map((member) => member.order)))
    issues.push(warning('staff.duplicate-order', String(order)));
  for (const member of members) {
    const at = member.id;
    if (!/^[a-z0-9-]+$/.test(member.id)) issues.push(error('staff.invalid-id', at));
    if (!member.name.trim() || !member.role.trim())
      issues.push(error('staff.missing-text', at));
    if (!isIsoDate(member.reviewedOn))
      issues.push(error('staff.invalid-date', `${at}.reviewedOn`));
    if (member.consent.profile)
      issues.push(...consentIssues(member.consent.profile, `${at}.consent.profile`));
    if (member.consent.photo)
      issues.push(...consentIssues(member.consent.photo, `${at}.consent.photo`));
    if (member.photo) issues.push(...photoIssues(member.photo, `${at}.photo`));
    if (member.status === 'public') {
      if (!member.consent.profile)
        issues.push(error('staff.public-without-consent', `${at}.consent.profile`));
      else if (member.consent.profile.withdrawnOn)
        issues.push(warning('staff.consent-withdrawn', `${at}.consent.profile`));
      if (member.photo && !consentActive(member.consent.photo))
        issues.push(warning('staff.photo-without-consent', `${at}.photo`));
    }
    if (member.status === 'retired' && member.retiredOn === undefined)
      issues.push(warning('staff.retired-without-date', `${at}.retiredOn`));
    if (member.retiredOn !== undefined) {
      if (!isIsoDate(member.retiredOn))
        issues.push(error('staff.invalid-date', `${at}.retiredOn`));
      else if (member.status === 'public')
        issues.push(error('staff.retired-but-public', `${at}.status`));
    }
  }
  return issues;
}

export const defineStaff = (members: readonly StaffMember[]): readonly StaffMember[] =>
  assertNoErrors(members, validateStaff(members), 'staff');
