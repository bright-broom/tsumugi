import NavigationGroups from '@/components/NavigationGroups';
import { useMessages } from '@/components/ContentProvider';
import Icon from '@/components/Icon';
import PhoneLink from '@/components/PhoneLink';
import * as C from '@/content/config';
import { INDUSTRIES, NAV_MAIN } from '@/content/nav';
import { href, pathForFile, ROUTES } from '@/routing/registry';

export default function Header({ file }: { file: string }) {
  const copy = useMessages('shell');
  const current = (url: string) => (url === file ? 'page' : undefined);

  return (
    <header className="hdr">
      <div className="hdr-in">
        <a className="logo" href={href('index')} aria-label={C.BRAND_T}>
          <span className="n" aria-hidden="true">
            {C.BRAND}
          </span>
          <span className="logo-copy" aria-hidden="true">
            <span className="roman">{copy.header.roman}</span>
            <span className="s">{copy.header.tagline}</span>
          </span>
        </a>
        <nav className="nav" aria-label={copy.ariaLabel}>
          <ul>
            {NAV_MAIN.map(([url, label]) => (
              <li key={url}>
                <a href={pathForFile(url)} aria-current={current(url)}>
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="header-actions">
          <PhoneLink className="header-phone" />
          <a
            className="header-contact"
            href={href('contact')}
            aria-current={current(ROUTES.contact.file)}
          >
            <span className="contact-long">{copy.header.contact}</span>
            <span className="contact-short">{copy.header.contactShort}</span>
            <Icon name="arrow-right" sm />
          </a>
          <details className="menu">
            <summary>
              <span className="menu-lines" aria-hidden="true" />
              <span className="menu-open">{copy.header.menu}</span>
              <span className="menu-close">{copy.header.close}</span>
            </summary>
            <div className="menu-panel">
              <nav aria-label={copy.header.navigation}>
                <NavigationGroups file={file} surface="menu" />
                <p className="hd">{copy.hd2}</p>
                <ul>
                  {INDUSTRIES.map(([url, label]) => (
                    <li key={url}>
                      <a href={pathForFile(url)} aria-current={current(url)}>
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
              <div className="menu-phone">
                <PhoneLink />
                <p>{C.TEL_HOURS}</p>
                <p>{`${copy.mk3} ${C.EMAIL_HOURS}`}</p>
              </div>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
