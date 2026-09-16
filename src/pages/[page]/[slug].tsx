import type { GetStaticPaths, GetStaticProps } from 'next';
import { collectionPageProps, collectionPaths } from '@/application/static-props';
import type { AnyPageProps } from '@/content/page-props';
export { default } from '@/application/Page';
export const config = { unstable_runtimeJS: false };
/** Published collection entries only (`/news/<slug>.html`); drafts and empty collections emit nothing. */
export const getStaticPaths: GetStaticPaths = () => ({
  paths: collectionPaths('entry').map((params) => ({ params })),
  fallback: false,
});
export const getStaticProps: GetStaticProps<AnyPageProps, { page: string; slug: string }> = ({
  params,
}) => {
  const props = params ? collectionPageProps(`${params.page}/${params.slug}.html`) : undefined;
  return props ? { props } : { notFound: true };
};
