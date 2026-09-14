import { href } from '@/routing/registry';
import PhoneLink from '@/components/PhoneLink';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useMessages } from '@/components/ContentProvider';
/**
 * ページの器。21ページぶんの共通部分（ページごとの head / OGP / JSON-LD / ヘッダー / フッター / 固定CTA）。
 * ページに依らない head（テーマ色・アイコン・CSS）は pages/_document.tsx に置いてある。
 */
import Head from 'next/head';
import { LOCALE } from '@/i18n/catalog';
import { canonical, ogImage } from '@/routing/registry';
import type { ReactNode } from 'react';
import * as C from '@/content/config';
import { raw } from '@/lib/raw';
import Icon from '@/components/Icon';

interface Props {
  file: string;
  title: string;
  desc: string;
  children: ReactNode;
}

export default function Base({ file, title, desc, children }: Props) {
  const copy = useMessages('shell');
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: C.BRAND,
    description: copy.structuredDataDescription + copy.structuredDataDescription2,
    url: `https://${C.DOMAIN}/`,
    telephone: C.TEL,
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'JP',
      addressRegion: C.ADDRESS_REGION,
      addressLocality: C.ADDRESS_CITY,
      streetAddress: C.ADDRESS_STREET,
      postalCode: C.POSTAL_CODE,
    },
    areaServed: { '@type': 'Country', name: copy.areaServedName },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '09:00',
        closes: '18:00',
      },
    ],
    knowsLanguage: LOCALE.language,
  };

  const url = canonical(C.DOMAIN, file);
  const og = ogImage(C.DOMAIN, file);
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <meta name="description" content={desc} />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={desc} />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content={LOCALE.openGraph} />
        <meta property="og:site_name" content={C.BRAND_T} />
        <meta property="og:url" content={url} />
        <meta property="og:image" content={og} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={raw(JSON.stringify(structuredData, null, 2))}
        />
      </Head>
      <div className="nah-app" data-profile={C.PROFILE} id="page-top">
        <a className="skip" href="#main">
          {copy.skip}
        </a>
        {C.PLACEHOLDER && (
          <div className="draft">
            <Icon name="triangle-alert" sm />
            <span>{copy.span}</span>
          </div>
        )}
        <Header file={file} />
        <main id="main">{children}</main>
        <Footer file={file} />
        <div className="fixbar">
          <PhoneLink />
          <a href={C.LINE_URL || href('contact')}>
            <Icon name="message-circle" />
            {C.LINE_URL ? copy.a2 : copy.a3}
          </a>
        </div>
      </div>
    </>
  );
}
