import NavigationGroups from '@/components/NavigationGroups';
import { useMessages } from '@/components/ContentProvider';
import Icon from '@/components/Icon';
import PhoneLink from '@/components/PhoneLink';
import * as C from '@/content/config';
import { INDUSTRIES, NAV_IC, NAV_LEGAL } from '@/content/nav';
import { format } from '@/i18n/format';
import { href, pathForFile } from '@/routing/registry';

export default function Footer({ file }: { file: string }) {
  const copy = useMessages('shell');
  const current = (url: string) => (url === file ? 'page' : undefined);

  return (
    <footer className="ftr" id="footer">
      <div className="wrap">
        <div className="footer-intro">
          <div>
            <p className="footer-eyebrow">
              <Icon name="handshake" sm />
              {copy.footer.eyebrow}
            </p>
            <h2>
              <span>{copy.footer.heading}</span>
              <wbr />
              <span>{copy.footer.heading2}</span>
            </h2>
          </div>
          <a className="footer-contact" href={href('contact')}>
            <Icon name="message-circle" />
            <span>{copy.header.contact}</span>
            <Icon name="arrow-right" />
          </a>
        </div>
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
            <PhoneLink className="footer-phone" />
            <dl className="footer-facts">
              <div>
                <dt>
                  <Icon name="clock" sm />
                  <span>{copy.mk}</span>
                </dt>
                <dd>{C.TEL_HOURS}</dd>
              </div>
              <div>
                <dt>
                  <Icon name="mail" sm />
                  <span>{`${copy.mk3}（${C.EMAIL_HOURS}）`}</span>
                </dt>
                <dd>
                  <a className="contact-email" href={C.EMAIL_LINK}>
                    {C.EMAIL}
                  </a>
                </dd>
              </div>
              <div>
                <dt>
                  <Icon name="map-pin" sm />
                  <span>{copy.mk2}</span>
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
            <h3>{copy.hd}</h3>
            <NavigationGroups file={file} surface="footer" />
          </nav>
          <nav className="footer-industries" aria-label={copy.hd2}>
            <h3>{copy.hd2}</h3>
            <ul>
              {INDUSTRIES.map(([url, label]) => (
                <li key={url}>
                  <a href={pathForFile(url)} aria-current={current(url)}>
                    <Icon name={NAV_IC[url]!} />
                    <span>{label}</span>
                    <Icon name="arrow-right" sm />
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
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
        <div className="footer-bottom">
          <p className="footer-copyright">{`© ${C.LEGAL_NAME}`}</p>
          <a className="footer-top" href="#page-top">
            <span>{copy.footer.backToTop}</span>
            <Icon name="arrow-up" />
          </a>
        </div>
      </div>
    </footer>
  );
}
