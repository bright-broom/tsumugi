import { getMessages } from '@/i18n/catalog';
import { ROUTES, type RouteId } from '@/routing/registry';
import type { AnyPageProps } from '@/content/page-props';
import { verifyPass } from '@/lib/measured';
/** Called only from getStaticProps; filesystem access stays in the build process. */
export function pageProps(route: RouteId): AnyPageProps {
  const catalog = getMessages();
  const { shell, cta, entry, plans, table, vs, diagrams, storefront } = catalog;
  const template = ROUTES[route].template;
  // Both discriminator and copy are selected by the same registry key. TS does not
  // distribute a computed indexed access into the union, so assert only here.
  return {
    route,
    template,
    copy: catalog[template],
    messages: { shell, cta, entry, plans, table, vs, diagrams, storefront },
    pass: route === 'works' ? verifyPass() : '',
  } as AnyPageProps;
}
