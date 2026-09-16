import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StaffMember } from '@/lib/storefront/staff';
import type { Testimonial } from '@/lib/storefront/testimonials';
import type { StoreProfile } from '@/lib/storefront/store';
import { pageProps } from '@/application/static-props';
import Page from '@/application/Page';

const data = vi.hoisted(() => ({
  staff: [] as StaffMember[],
  voices: [] as Testimonial[],
  store: undefined as StoreProfile | undefined,
}));
vi.mock('@/content/staff', () => ({ STAFF: data.staff }));
vi.mock('@/content/testimonials', () => ({ TESTIMONIALS: data.voices }));
vi.mock('@/content/store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/content/store')>();
  data.store = structuredClone(actual.STORE);
  return { ...actual, STORE: data.store, STORE_AS_OF: '2026-09-16' };
});

beforeEach(() => {
  data.staff.length = 0;
  data.voices.length = 0;
  delete data.store!.locations[0].visit;
});

const render = () => renderToStaticMarkup(<Page {...pageProps('about')} />);

describe('about page storefront integration', () => {
  it('keeps empty customer-template sections out of the Tsumugi page', () => {
    const html = render();
    expect(html).not.toContain('店舗情報・アクセス');
    expect(html).not.toContain('<h2>お客様の声</h2>');
    expect(html).not.toContain('id="staff-');
    expect(html).not.toContain('id="voice-');
    expect(html).toContain('member-cards');
  });
  it('connects configured storefront components without exposing consent records', () => {
    const consent = { grantedOn: '2026-09-01', recordRef: 'private-fixture-reference' } as const;
    data.store!.locations[0].visit = {
      access: '駅から徒歩 5 分',
      parking: { available: false },
      mapUrl: 'https://maps.google.com/?q=tokyo',
    };
    data.staff.push({
      id: 'owner',
      name: '店主の紹介',
      role: '代表',
      bio: 'お店の紹介文',
      order: 1,
      status: 'public',
      reviewedOn: '2026-09-01',
      consent: { profile: consent, photo: null },
    });
    data.voices.push({
      id: 'approved',
      body: '丁寧に対応してもらいました。',
      displayName: 'A 様',
      source: { kind: 'survey', collectedOn: '2026-09-01' },
      permission: { ...consent, showName: true, showPhoto: false },
      solicitation: { requested: true, incentive: null },
      status: 'published',
    });
    const html = render();
    expect(html).toContain('店舗情報・アクセス');
    expect(html).toContain('駅から徒歩 5 分');
    expect(html).toContain('id="staff-owner"');
    expect(html).toContain('id="voice-approved"');
    expect(html).toContain('data-disclosure="requested"');
    expect(html).not.toContain('private-fixture-reference');
    expect(html).not.toMatch(/<script(?![^>]*application\/ld\+json)/);
  });
});
