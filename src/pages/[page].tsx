import type { GetStaticPaths, GetStaticProps } from 'next';
import {
  collectionPageProps,
  collectionPaths,
  pageProps,
} from '@/application/static-props';
import { STATIC_ROUTES, getRoute } from '@/routing/registry';
import type { AnyPageProps } from '@/content/page-props';
export { default } from '@/application/Page';
export const config = { unstable_runtimeJS: false };
export const getStaticPaths: GetStaticPaths = () => ({
  paths: [
    ...STATIC_ROUTES.map((route) => ({ params: { page: route.id } })),
    ...collectionPaths('list').map(({ page }) => ({ params: { page } })),
  ],
  fallback: false,
});
export const getStaticProps: GetStaticProps<AnyPageProps, { page: string }> = ({ params }) => {
  const page = params?.page;
  const route = page ? getRoute(page) : undefined;
  if (route) {
    if (route.id === '404' || route.id === 'index') return { notFound: true };
    return { props: pageProps(route.id) };
  }
  const collection = page ? collectionPageProps(`${page}.html`) : undefined;
  return collection ? { props: collection } : { notFound: true };
};
