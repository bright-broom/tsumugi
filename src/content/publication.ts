/** 自社サイトの公開判断。専門家確認・顧客への納品検収とは別の記録（ADR 0056）。 */
export interface OwnerPublication {
  domain: string;
  ownerNameSha256: string;
  authorizedOn: string;
  evidence: string;
  documentHashes: Readonly<Record<'terms' | 'legal', string>>;
  deferredChecks: readonly string[];
}

/** 顧客テンプレートへ転用するときは null に戻す。 */
export const OWNER_PUBLICATION: OwnerPublication | null = {
  domain: 'tsumugi-six.vercel.app',
  ownerNameSha256: 'a28ec82ad9f7f783da153bbdee247fc5ae86c7ccb913573f4bd1eac51b60fa80',
  authorizedOn: '2026-09-18',
  evidence: 'docs/architecture/0075-pricing-reset.md',
  documentHashes: {
    terms: 'fc7e1aced92c386f057d1d55a6db8df6e7accba9d0c86d98f38cd7014dda1151',
    legal: '0cdf0b0d82546a5b99d58e11a762955a9b7eec047877cce723f5808ecf46eee2',
  },
  deferredChecks: [
    'phone',
    'hours',
    'address',
    'price',
    'primary-contact',
    'area',
    'photos',
    'staff',
    'cases',
    'voices',
    'guides',
    'mobile-parity',
    'no-score-chasing',
    'tap-target',
    'structured-data',
    'business-profile',
    'notifications',
    'reviews',
  ],
};
