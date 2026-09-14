import type { GetStaticPaths, GetStaticProps } from 'next';
import { pageProps } from '@/application/static-props';
import { STATIC_ROUTES, getRoute } from '@/routing/registry';
import type { AnyPageProps } from '@/content/page-props';
export { default } from '@/application/Page';
export const config = { unstable_runtimeJS: false };
export const getStaticPaths: GetStaticPaths = () => ({
  paths: STATIC_ROUTES.map((route) => ({ params: { page: route.id } })),
  fallback: false,
});
export const getStaticProps: GetStaticProps<AnyPageProps, { page: string }> = ({ params }) => {
  const route = params?.page ? getRoute(params.page) : undefined;
  if (!route || route.id === '404' || route.id === 'index') return { notFound: true };
  return { props: pageProps(route.id) };
};
