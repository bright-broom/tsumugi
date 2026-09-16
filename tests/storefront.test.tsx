import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ContentProvider } from '@/components/ContentProvider';
import Cta from '@/components/Cta';
import ContactActionLink from '@/components/ContactAction';
import StaffList from '@/components/storefront/StaffList';
import StoreInfo from '@/components/storefront/StoreInfo';
import TestimonialList from '@/components/storefront/TestimonialList';
import { getMessages } from '@/i18n/catalog';
import { formatDisclosure, formatWeeklyHours } from '@/i18n/storefront';
import { STORE } from '@/content/store';
import {
  CONTACT_PRESETS,
  defineContactPlan,
  resolveContactActions,
  validateContactPlan,
} from '@/lib/storefront/contact-actions';
import {
  defineStaff,
  publishedStaff,
  validateStaff,
  type StaffMember,
} from '@/lib/storefront/staff';
import {
  BUSINESS_TYPES_BY_INDUSTRY,
  defineStore,
  localBusinessJsonLd,
  reconcileListing,
  upcomingExceptions,
  validateStore,
  type ListingSnapshot,
  type StoreProfile,
} from '@/lib/storefront/store';
import {
  defineTestimonials,
  missingDisclosures,
  publishableTestimonials,
  validateTestimonials,
  type Testimonial,
} from '@/lib/storefront/testimonials';

const messages = getMessages();
const render = (children: ReactNode) =>
  renderToStaticMarkup(<ContentProvider messages={messages}>{children}</ContentProvider>);
const endpoints = { telLink: '08045601124', contactPath: '/contact.html' };
const consent = { grantedOn: '2026-09-01', recordRef: 'fixture-consent' } as const;
const photo = { src: '/sample.webp', alt: '紹介写真', width: 400, height: 300 };
const member: StaffMember = {
  id: 'owner',
  name: '店主',
  role: '代表',
  bio: '紹介文',
  order: 1,
  status: 'public',
  reviewedOn: '2026-09-01',
  consent: { profile: consent, photo: null },
  photo,
};
const voice: Testimonial = {
  id: 'first',
  body: '丁寧に対応してもらいました。',
  displayName: 'A 様',
  photo,
  source: { kind: 'survey', collectedOn: '2026-09-01' },
  permission: { ...consent, showName: false, showPhoto: false },
  solicitation: { requested: true, incentive: 'gift' },
  status: 'published',
};
const shop: StoreProfile = {
  ...STORE,
  businessType: BUSINESS_TYPES_BY_INDUSTRY.restaurant[0],
  locations: [
    {
      ...STORE.locations[0],
      telephone: '080-4560-1124',
      address: { postalCode: '100-0001', region: '東京都', locality: '千代田区', street: '1-2-3' },
      visit: {
        access: '駅から徒歩 5 分',
        parking: { available: true },
        mapUrl: 'https://maps.google.com/?q=tokyo',
      },
      exceptions: [
        { from: '2026-09-01', closed: true },
        { from: '2026-09-20', closed: true },
        { from: '2026-09-21', closed: false, hours: [{ opens: '10:00', closes: '15:00' }] },
      ],
    },
  ],
};

describe('contact destinations', () => {
  it('falls back from unconfigured booking and LINE without duplicate actions', () => {
    const plan = defineContactPlan({ order: CONTACT_PRESETS.restaurant });
    expect(resolveContactActions(plan.order, plan, endpoints)).toEqual([
      { channel: 'phone', href: 'tel:08045601124' },
      { channel: 'contact', href: '/contact.html' },
    ]);
    expect(
      resolveContactActions(['line', 'contact', 'contact'], { order: ['contact'] }, endpoints),
    ).toEqual([
      { channel: 'contact', href: '/contact.html' },
      { channel: 'phone', href: 'tel:08045601124' },
    ]);
    expect(validateContactPlan(plan)).toContainEqual({
      severity: 'warning',
      code: 'contact.booking-not-configured',
      path: 'bookingUrl',
    });
  });
  it.each([
    'http://line.me/x',
    'https://line.me.evil.example/x',
    'javascript:alert(1)',
    'https://user:password@line.me/x',
  ])('rejects unsafe LINE destination %s', (lineUrl) => {
    expect(() => defineContactPlan({ order: ['line'], lineUrl })).toThrow(
      'contact.invalid-line-url',
    );
  });
  it('rejects duplicate channels and non-HTTPS booking', () => {
    expect(() => defineContactPlan({ order: ['phone', 'phone'] })).toThrow('duplicate-channel');
    expect(() =>
      defineContactPlan({ order: ['booking'], bookingUrl: 'javascript:alert(1)' }),
    ).toThrow('invalid-booking-url');
  });
  it('keeps labels aligned with booking and LINE on both surfaces', () => {
    const plan = defineContactPlan({
      order: ['booking', 'line'],
      bookingUrl: 'https://booking.example/reserve',
      lineUrl: 'https://lin.ee/example',
    });
    const actions = resolveContactActions(plan.order, plan, endpoints);
    const buttons = render(<Cta actions={actions} primary="相談する" />);
    expect(buttons).toContain(`href="${plan.bookingUrl}">${messages.cta.booking}</a>`);
    expect(buttons).toContain(`href="${plan.lineUrl}">${messages.cta.line}</a>`);
    for (const action of actions) {
      const bar = render(<ContactActionLink action={action} surface="bar" />);
      expect(bar).toContain(`href="${action.href}"`);
      expect(bar).toContain(
        action.channel === 'booking' ? messages.cta.bookingShort : messages.shell.a2,
      );
    }
    expect(render(<Cta actions={actions} primary="詳しく見る" where="/price.html" />)).toContain(
      'href="/price.html">詳しく見る</a>',
    );
  });
});

describe('store hours and structured data', () => {
  it('uses the same current exceptions, address and map for visible information and JSON-LD', () => {
    expect(() => defineStore(shop)).not.toThrow();
    const html = render(<StoreInfo store={shop} asOf="2026-09-16" />);
    const data = localBusinessJsonLd(shop, { asOf: '2026-09-16' });
    expect(data['@type']).toBe('Restaurant');
    expect(data.telephone).toBe('080-4560-1124');
    expect(html).toContain('href="tel:08045601124"');
    expect(html).toContain(shop.locations[0].visit!.mapUrl.replaceAll('&', '&amp;'));
    expect(data.hasMap).toBe(shop.locations[0].visit!.mapUrl);
    expect(html).toContain('2026 年 9 月 20 日');
    expect(html).not.toContain('2026 年 9 月 1 日');
    expect(data.specialOpeningHoursSpecification).toEqual([
      {
        '@type': 'OpeningHoursSpecification',
        opens: '00:00',
        closes: '00:00',
        validFrom: '2026-09-20',
        validThrough: '2026-09-20',
      },
      {
        '@type': 'OpeningHoursSpecification',
        opens: '10:00',
        closes: '15:00',
        validFrom: '2026-09-21',
        validThrough: '2026-09-21',
      },
    ]);
    expect(upcomingExceptions(shop.locations[0], '2026-09-22')).toEqual([]);
    expect(formatWeeklyHours(shop.locations[0].hours, messages.storefront.store)).toEqual([
      '毎日 8:00〜22:00',
    ]);
    expect(html).not.toMatch(/<script|<iframe|undefined/);
  });
  it('rejects invalid dates and overlapping exception schedules', () => {
    for (const exceptions of [
      [{ from: '2026-02-30', closed: true }],
      [
        { from: '2026-09-20', closed: true },
        { from: '2026-09-20', closed: true },
      ],
    ] as const) {
      expect(() =>
        defineStore({ ...shop, locations: [{ ...shop.locations[0], exceptions }] }),
      ).toThrow();
    }
    expect(validateStore(shop, { today: '2026-09-16' })).toContainEqual({
      severity: 'warning',
      code: 'exception.stale',
      path: 'locations.main.exceptions[0]',
    });
  });
  it('normalizes listing notation but detects changed hours and telephone', () => {
    const snapshot: ListingSnapshot = {
      source: 'manual fixture',
      capturedOn: '2026-09-16',
      name: shop.name,
      telephone: '+81 80 4560 1124',
      address: { ...shop.locations[0].address, street: '１丁目２番３号' },
      hours: shop.locations[0].hours,
      exceptions: shop.locations[0].exceptions,
      website: shop.url,
      mapUrl: shop.locations[0].visit!.mapUrl,
    };
    expect(reconcileListing(shop, snapshot)).toEqual([]);
    expect(
      reconcileListing(shop, { ...snapshot, telephone: '080-9999-9999', hours: {} }).map(
        (mismatch) => mismatch.field,
      ),
    ).toEqual([
      'telephone',
      'hours.Monday',
      'hours.Tuesday',
      'hours.Wednesday',
      'hours.Thursday',
      'hours.Friday',
      'hours.Saturday',
      'hours.Sunday',
    ]);
  });
});

describe('publication permissions', () => {
  it('omits hidden, retired and withdrawn profiles and photos without consent', () => {
    const members = defineStaff([
      member,
      { ...member, id: 'hidden', status: 'hidden' },
      { ...member, id: 'retired', status: 'retired', retiredOn: '2026-09-15' },
      {
        ...member,
        id: 'withdrawn',
        order: 2,
        consent: { ...member.consent, profile: { ...consent, withdrawnOn: '2026-09-15' } },
      },
    ]);
    const published = publishedStaff(members);
    expect(published).toHaveLength(1);
    expect(published[0]).not.toHaveProperty('photo');
    const html = render(<StaffList members={published} />);
    expect(html).toContain('id="staff-owner"');
    expect(html).not.toMatch(/<img|fixture-consent|withdrawn|retired/);
    expect(
      validateStaff(members).some((issue) => issue.code === 'staff.photo-without-consent'),
    ).toBe(true);
    expect(() => defineStaff([{ ...member, consent: { profile: null, photo: null } }])).toThrow(
      'public-without-consent',
    );
  });
  it('publishes approved photos with dimensions', () => {
    const html = render(
      <StaffList
        members={publishedStaff([{ ...member, consent: { profile: consent, photo: consent } }])}
      />,
    );
    expect(html).toContain('width="400" height="300"');
    expect(html).toContain('alt="紹介写真"');
  });
  it('removes withdrawn, unapproved and revised testimonials', () => {
    expect(
      publishableTestimonials([
        { ...voice, status: 'draft' },
        { ...voice, permission: null },
        { ...voice, permission: { ...voice.permission!, withdrawnOn: '2026-09-15' } },
        { ...voice, revisedOn: '2026-09-02' },
      ]),
    ).toEqual([]);
    expect(() => defineTestimonials([{ ...voice, permission: null }])).toThrow(
      'published-without-permission',
    );
    expect(
      validateTestimonials([{ ...voice, revisedOn: '2026-09-02' }]).some(
        (issue) => issue.code === 'testimonial.revision-not-approved',
      ),
    ).toBe(true);
  });
  it.each([
    [false, null, null],
    [true, null, 'requested'],
    [false, 'gift', 'incentive'],
    [true, 'gift', 'requestedWithIncentive'],
  ] as const)(
    'keeps disclosure for requested=%s incentive=%s',
    (requested, incentive, disclosure) => {
      const published = publishableTestimonials(
        defineTestimonials([{ ...voice, solicitation: { requested, incentive } }]),
      );
      const html = render(<TestimonialList testimonials={published} business="テスト店舗" />);
      expect(published[0]!.disclosure).toBe(disclosure);
      expect(html).not.toMatch(/A 様|<img|fixture-consent/);
      expect(html).toContain(messages.storefront.testimonials.anonymous);
      const label = formatDisclosure(published[0]!, messages.storefront.testimonials, 'テスト店舗');
      expect(missingDisclosures(html, published, () => (label ? [label] : []))).toEqual([]);
      if (label) {
        expect(html).toContain(label);
        expect(
          missingDisclosures(html.replace('data-disclosure=', 'data-missing='), published),
        ).toEqual(['first']);
        expect(missingDisclosures(html.replace(label, ''), published, () => [label])).toEqual([
          'first',
        ]);
      }
    },
  );
});
