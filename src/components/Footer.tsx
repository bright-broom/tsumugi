import NavigationGroups from '@/components/NavigationGroups';
import { useMessages } from '@/components/ContentProvider';
import Icon from '@/components/Icon';
import PhoneLink from '@/components/PhoneLink';
import * as C from '@/content/config';
import { INDUSTRIES, NAV_IC, NAV_LEGAL } from '@/content/nav';
import { languageLinks } from '@/content/languages';
import { format } from '@/i18n/format';
import { href, pathForFile } from '@/routing/registry';

export default function Footer({ file }: { file: string }) {
  const copy = useMessages('shell');
  const current = (url: string) => (url === file ? 'page' : undefined);
  const emailBreak = C.EMAIL.indexOf('@');

  return (
    <footer className="ftr" id="footer">
      <div className="footer-intro">
        <div className="wrap footer-intro-inner">
          <div className="footer-invitation">
            <p className="footer-eyebrow">
              <Icon name="handshake" sm />
              {copy.footer.eyebrow}
            </p>
            <h2>
              <span>{copy.footer.heading}</span>
              <span>{copy.footer.heading2}</span>
            </h2>
          </div>
          <div className="footer-channels">
            <div className="footer-channel">
              <PhoneLink className="footer-phone" />
              <p>{C.TEL_HOURS}</p>
            </div>
            <div className="footer-channel">
              <a className="footer-email" href={C.EMAIL_LINK}>
                <Icon name="mail" />
                <span>
                  {C.EMAIL.slice(0, emailBreak)}
                  <wbr />
                  {C.EMAIL.slice(emailBreak)}
                </span>
                <span className="footer-email-arrow">
                  <Icon name="arrow-up-right" />
                </span>
              </a>
              <p>{C.EMAIL_HOURS}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="wrap footer-directory">
        <div className="footer-grid">
          <div className="footer-company">
            <a className="footer-brand" href={href('index')} aria-label={C.BRAND_T}>
              <span className="footer-kanji" aria-hidden="true">
                {C.BRAND}
              </span>
              <span className="footer-brand-copy" aria-hidden="true">
                <span>{copy.header.roman}</span>
                <span>{copy.header.tagline}</span>
              </span>
            </a>
            <p className="footer-description">
              {copy.p}
              <br />
              {C.SERVICE_NOTE}
            </p>
            <dl className="footer-facts">
              <div>
                <dt>
                  <Icon name="map-pin" sm />
                  <span className="sr-only">{copy.mk2}</span>
                </dt>
                <dd>
                  {format(copy.span4, {
                    cPOSTALCODE: C.POSTAL_CODE,
                    cADDRESSREGION: C.ADDRESS_REGION,
                    cADDRESSCITY: C.ADDRESS_CITY,
                    cADDRESSSTREET: C.ADDRESS_STREET,
                  })}
                </dd>
              </div>
            </dl>
          </div>
          <nav className="footer-navigation" aria-label={copy.footer.navigation}>
            <NavigationGroups file={file} surface="footer" />
          </nav>
        </div>
        <nav className="footer-industries" aria-label={copy.hd2}>
          <h3>{copy.hd2}</h3>
          <ul>
            {INDUSTRIES.map(([url, label]) => (
              <li key={url}>
                <a href={pathForFile(url)} aria-current={current(url)}>
                  <Icon name={NAV_IC[url]!} />
                  <span>{label}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label={copy.footer.legal}>
          <ul className="ftr-legal">
            {NAV_LEGAL.map(([url, label]) => (
              <li key={url}>
                <a href={pathForFile(url)} aria-current={current(url)}>
                  <Icon name={NAV_IC[url]!} sm />
                  <span>{label}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <p className="fine">{copy.fine}</p>
        {languageLinks(file).length > 0 && (
          <nav className="fine" aria-label={copy.language.label}>
            {languageLinks(file).map((link) => (
              <a key={link.locale} href={link.href} hrefLang={link.language} lang={link.language}>
                {link.name}
              </a>
            ))}
          </nav>
        )}
        <div className="footer-bottom">
          <p className="footer-copyright">{`© ${C.LEGAL_NAME}`}</p>
          <a className="footer-top" href="#page-top">
            <span className="sr-only">{copy.footer.backToTop}</span>
            <Icon name="arrow-up" />
          </a>
        </div>
      </div>
    </footer>
  );
}
