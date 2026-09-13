/**
 * ページの器。21ページぶんの共通部分（ページごとの head / OGP / JSON-LD / ヘッダー / フッター / 固定CTA）。
 * ページに依らない head（テーマ色・アイコン・CSS）は pages/_document.tsx に置いてある。
 */
import Head from 'next/head';
import type { ReactNode } from 'react';
import * as C from '../data/config';
import { NAV, NAV_MAIN, NAV_LEGAL, NAV_IC, INDUSTRIES } from '../data/nav';
import { raw } from '../lib/raw';
import Icon from '../components/Icon';

interface Props { file: string; title: string; desc: string; children: ReactNode }

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'ProfessionalService',
  name: C.BRAND,
  description:
    '小規模事業者向けのホームページ制作と運用。全国対応。' +
    '変更は何回でも無料、ソースコードを納品、掲載費の見直しまで。',
  url: `https://${C.DOMAIN}/`,
  telephone: C.TEL,
  address: {
    '@type': 'PostalAddress', addressCountry: 'JP',
    addressRegion: C.ADDRESS_REGION, addressLocality: C.ADDRESS_CITY,
    streetAddress: C.ADDRESS_STREET, postalCode: C.POSTAL_CODE,
  },
  areaServed: { '@type': 'Country', name: '日本' },
  openingHoursSpecification: [{
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    opens: '09:00', closes: '18:00',
  }],
  knowsLanguage: 'ja',
};

function Tel() {
  return (
    <a className="tel" href={`tel:${C.TEL_LINK}`}><Icon name="phone" />
      <span className="t"><span className="lbl">タップで発信</span>
        <span className="num">{C.TEL}</span></span></a>
  );
}

export default function Base({ file, title, desc, children }: Props) {
  const url = `https://${C.DOMAIN}/${file}`;
  const og = `https://${C.DOMAIN}/og/${file.replace('.html', '')}.png`;
  const one = C.BRAND.length <= 2 ? ' one' : '';
  const current = (u: string) => (u === file ? 'page' : undefined);
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
        <meta property="og:locale" content="ja_JP" />
        <meta property="og:site_name" content={C.BRAND_T} />
        <meta property="og:url" content={url} />
        <meta property="og:image" content={og} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json" dangerouslySetInnerHTML={raw(JSON.stringify(structuredData, null, 2))} />
      </Head>
      <div className="nah-app" data-profile={C.PROFILE}>
        <a className="skip" href="#main">本文へ移動</a>
        {C.PLACEHOLDER && (
          <div className="draft"><Icon name="triangle-alert" sm />
            <span>準備中の見本です。電話番号・所在地・ドメインは仮の値です。</span></div>
        )}
        <header className="hdr">
          <div className="hdr-in">
            <a className={`logo${one}`} href="index.html">
              <span className="n">{C.BRAND}</span>
              {C.BRAND_READING && <span className="rd">{C.BRAND_READING}</span>}
              <span className="s">ホームページ制作と運用｜全国対応</span>
              <span className="s2">ホームページ制作</span>
            </a>
            <nav className="nav" aria-label="主なご案内"><ul>
              {NAV_MAIN.map(([u, t]) => (
                <li key={u}><a href={u} aria-current={current(u)}><Icon name={NAV_IC[u]!} sm />{t}</a></li>
              ))}
            </ul></nav>
            <span className="tel-hours"><span>お電話でのご相談<br />{C.TEL_HOURS}</span></span>
            <Tel />
            <details className="menu">
              <summary aria-label="サイト内のご案内を開く"><span>メニュー</span></summary>
              <div className="menu-panel">
                <p className="hd">ご案内</p>
                <ul>{NAV.map(([u, t]) => <li key={u}><a href={u} aria-current={current(u)}>{t}</a></li>)}</ul>
                <p className="hd">業種別のご案内</p>
                <ul>{INDUSTRIES.map(([u, nm]) => <li key={u}><a href={u}>{nm}</a></li>)}</ul>
              </div>
            </details>
          </div>
        </header>
        <main id="main">{children}</main>
        <footer className="ftr">
          <div className="wrap">
            <div className="ftr-g">
              <div>
                <h4>{C.BRAND_T}</h4>
                <p>飲食店・工務店・美容室・士業のホームページを作って、運用まで一緒にやります。<br />
                  {C.SERVICE_NOTE}</p>
                <p><Tel /></p>
                <p className="meta"><span className="mk">受付</span><span>{C.TEL_HOURS}</span></p>
                <p className="meta"><span className="mk">所在地</span>
                  <span>{`〒${C.POSTAL_CODE} ${C.ADDRESS_REGION}${C.ADDRESS_CITY}${C.ADDRESS_STREET}`}</span></p>
                <p className="meta"><span className="mk">メール</span>
                  <a href={`mailto:${C.EMAIL}`}>{C.EMAIL}</a></p>
              </div>
              <div><h4>ご案内</h4>
                <ul>{NAV.map(([u, t]) => <li key={u}><a href={u}>{t}</a></li>)}</ul></div>
              <div><h4>業種別のご案内</h4>
                <ul>{INDUSTRIES.map(([u, nm]) => <li key={u}><a href={u}>{nm}</a></li>)}</ul></div>
            </div>
            <ul className="ftr-legal">{NAV_LEGAL.map(([u, t]) => (
              <li key={u}><a href={u}><Icon name={NAV_IC[u]!} sm />{t}</a></li>))}</ul>
            <p className="fine">
              掲載している他社サービスの料金は各社が公開している情報です（2026年9月時点）。
              補助金の要件・締切は変更されることがあります。金額はすべて税別表記です。
              補助金は採択された場合の金額で、採択を保証するものではありません。<br />
              {`© ${C.LEGAL_NAME}`}
            </p>
          </div>
        </footer>
        <div className="fixbar">
          <a href={`tel:${C.TEL_LINK}`}><Icon name="phone" />電話する</a>
          <a href={C.LINE_URL || 'contact.html'}><Icon name="message-circle" />
            {C.LINE_URL ? 'LINEで相談' : '相談する'}</a>
        </div>
      </div>
    </>
  );
}
