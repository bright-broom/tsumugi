import { japaneseSpacing } from '@/i18n/typography';
import ContactActionLink from '@/components/ContactAction';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useMessages } from '@/components/ContentProvider';
/**
 * ページの器。22ページぶんの共通部分（ページごとの head / OGP / JSON-LD / ヘッダー / フッター / 固定CTA）。
 * ページに依らない head（テーマ色・アイコン・CSS）は pages/_document.tsx に置いてある。
 */
import Head from 'next/head';
import { LOCALE } from '@/i18n/catalog';
import { ALL_ROUTES, ROUTES, canonical, ogImage } from '@/routing/registry';
import { LOCALE_SETTINGS } from '@/lib/locale';
import { publicImageUrl } from '@/routing/collections';
import type { ReactNode } from 'react';
import * as C from '@/content/config';
import { CONTACT_ACTIONS } from '@/content/contact-actions';
import { STORE, STORE_AS_OF } from '@/content/store';
import { jsonLd } from '@/lib/raw';
import { localBusinessJsonLd } from '@/lib/storefront/store';
import Icon from '@/components/Icon';

interface Props {
  file: string;
  title: string;
  desc: string;
  /** Existing share image under public/og/ for generated pages; fixed pages use their own card. */
  og?: string;
  children: ReactNode;
}

export default function Base({ file, title, desc, og: ogPath, children }: Props) {
  const copy = useMessages('shell');
  title = japaneseSpacing(title);
  desc = japaneseSpacing(desc);
  // 店舗情報の正本（content/store.ts）から作る。業種の型・臨時の営業時間も同じ正本に持つ（ADR 0048）。
  const structuredData = localBusinessJsonLd(STORE, { asOf: STORE_AS_OF });

  const url = canonical(C.DOMAIN, file);
  const og = ogPath ? publicImageUrl(C.DOMAIN, ogPath) : ogImage(C.DOMAIN, file);
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <meta name="description" content={desc} />
        <link rel="canonical" href={url} />
        {/* Alternates only when the site publishes more than one language (ADR 0081). */}
        {C.PUBLISHED_LOCALES.length > 1 &&
          [...C.PUBLISHED_LOCALES, 'x-default' as const].map((locale) => (
            <link
              key={locale}
              rel="alternate"
              hrefLang={locale === 'x-default' ? locale : LOCALE_SETTINGS[locale].language}
              href={canonical(C.DOMAIN, file, locale === 'x-default' ? C.PUBLISHED_LOCALES[0] : locale)}
            />
          ))}
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
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(structuredData)} />
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
        <main
          id="main"
          className={file === ROUTES.index.file ? undefined : 'interior-content'}
          data-page={file}
          data-kind={ALL_ROUTES.find((route) => route.file === file)?.kind}
        >
          {children}
        </main>
        <Footer file={file} />
        <div className="fixbar">
          {CONTACT_ACTIONS.bar.map((action) => (
            <ContactActionLink action={action} surface="bar" key={action.channel} />
          ))}
        </div>
      </div>
    </>
  );
}
