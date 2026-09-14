import { href } from '@/routing/registry';
import PhoneLink from '@/components/PhoneLink';
import Header from '@/components/Header';
import { useMessages } from '@/components/ContentProvider';
import { format } from '@/i18n/format';
/**
 * ページの器。21ページぶんの共通部分（ページごとの head / OGP / JSON-LD / ヘッダー / フッター / 固定CTA）。
 * ページに依らない head（テーマ色・アイコン・CSS）は pages/_document.tsx に置いてある。
 */
import Head from 'next/head';
import { LOCALE } from '@/i18n/catalog';
import { canonical, ogImage, pathForFile } from '@/routing/registry';
import type { ReactNode } from 'react';
import * as C from '@/content/config';
import { NAV, NAV_LEGAL, NAV_IC, INDUSTRIES } from '@/content/nav';
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
      <div className="nah-app" data-profile={C.PROFILE}>
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
        <footer className="ftr">
          <div className="wrap">
            <div className="ftr-g">
              <div>
                <h4>{C.BRAND_T}</h4>
                <p>
                  {copy.p}
                  <br />
                  {C.SERVICE_NOTE}
                </p>
                <p>
                  <PhoneLink className="tel" />
                </p>
                <p className="meta">
                  <span className="mk">{copy.mk}</span>
                  <span>{C.TEL_HOURS}</span>
                </p>
                <p className="meta">
                  <span className="mk">{copy.mk2}</span>
                  <span>
                    {format(copy.span4, {
                      cPOSTALCODE: C.POSTAL_CODE,
                      cADDRESSREGION: C.ADDRESS_REGION,
                      cADDRESSCITY: C.ADDRESS_CITY,
                      cADDRESSSTREET: C.ADDRESS_STREET,
                    })}
                  </span>
                </p>
                <p className="meta">
                  <span className="mk">{copy.mk3}</span>
                  <a href={`mailto:${C.EMAIL}`}>{C.EMAIL}</a>
                </p>
              </div>
              <div>
                <h4>{copy.hd}</h4>
                <ul>
                  {NAV.map(([u, t]) => (
                    <li key={u}>
                      <a href={pathForFile(u)}>{t}</a>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4>{copy.hd2}</h4>
                <ul>
                  {INDUSTRIES.map(([u, nm]) => (
                    <li key={u}>
                      <a href={pathForFile(u)}>{nm}</a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <ul className="ftr-legal">
              {NAV_LEGAL.map(([u, t]) => (
                <li key={u}>
                  <a href={pathForFile(u)}>
                    <Icon name={NAV_IC[u]!} sm />
                    {t}
                  </a>
                </li>
              ))}
            </ul>
            <p className="fine">
              {copy.fine}
              <br />
              {`© ${C.LEGAL_NAME}`}
            </p>
          </div>
        </footer>
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
