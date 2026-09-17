/** Expectations come from this checkout, independently of the remote sitemap. */
import { collectionRoutes, SITE_COLLECTIONS } from '@/content/collections';
import { CONTACT_METHOD, DOMAIN, EMAIL_LINK, PLACEHOLDER, TEL_LINK } from '@/content/config';
import { OWNER_PUBLICATION } from '@/content/publication';
import { PUBLIC_ROUTES, ROUTES } from '@/routing/registry';
import { SECURITY_HEADERS } from '../security/policy';
import { parseSiteUrl } from './site-checks';

interface TargetConfig {
  domain: string;
  placeholder: boolean;
  authorizedDomain: string | null;
}

/** An explicit target wins. Automatic selection is only for an authorized, configured site. */
export function monitorTarget(
  value: string | undefined,
  config: TargetConfig = {
    domain: DOMAIN,
    placeholder: PLACEHOLDER,
    authorizedDomain: OWNER_PUBLICATION?.domain ?? null,
  },
): URL {
  if (value?.trim()) return parseSiteUrl(value.trim());
  if (config.placeholder || config.authorizedDomain !== config.domain)
    throw new Error(
      '監視先が未設定です。SITE_URL または --url で公開先を指定してください。監視は実行していません。',
    );
  return parseSiteUrl(`https://${config.domain}`);
}

export function siteExpectations() {
  return {
    expectedHeaders: SECURITY_HEADERS,
    expectedPaths: [
      ...PUBLIC_ROUTES.map((route) => route.path),
      ...collectionRoutes(SITE_COLLECTIONS).map((route) => route.path),
    ],
    contact: {
      path: ROUTES.contact.path,
      links: [`tel:${TEL_LINK}`, ...(CONTACT_METHOD === 'email' ? [EMAIL_LINK] : [])],
    },
  };
}
