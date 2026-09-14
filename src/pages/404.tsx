import type { GetStaticProps } from 'next';
import { pageProps } from '@/application/static-props';
import type { AnyPageProps } from '@/content/page-props';
export { default } from '@/application/Page';
export const config = { unstable_runtimeJS: false };
export const getStaticProps: GetStaticProps<AnyPageProps> = () => ({ props: pageProps('404') });
