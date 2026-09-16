import type { Messages } from '@/i18n/catalog';
import type { RouteId, TemplateId } from '@/routing/registry';
import type { VerifiedSummary } from '@/lib/verification-report';
import type { Article } from '@/lib/collections/articles';
import type { CaseStudy, CaseTaxonomy, Facet } from '@/lib/collections/cases';
import type { ServiceArea } from '@/lib/collections/areas';
import type { Work } from '@/lib/collections/works';
export type SharedMessages = Pick<
  Messages,
  'shell' | 'cta' | 'entry' | 'plans' | 'table' | 'vs' | 'diagrams' | 'storefront'
>;
/** Public, serializable build input; only this page and common UI copy are included. */
export interface PageProps<K extends TemplateId> {
  route: RouteId;
  template: K;
  copy: Messages[K];
  messages: SharedMessages;
  /** 同じコミットの全項目・FAIL 0 の検査記録。works だけが使い、無ければ null（未計測） */
  verification: VerifiedSummary | null;
}
type StaticPageProps = { [K in TemplateId]: PageProps<K> }[TemplateId];

/** List pages omit entry bodies to keep the page input small. */
type Summary<T> = Omit<T, 'body'> & { path: string };
interface CollectionPageData {
  articleList: { entries: Summary<Article>[] };
  article: { entry: Article };
  caseList: { entries: Summary<CaseStudy>[]; facets: Facet[]; taxonomy: CaseTaxonomy };
  caseStudy: { entry: CaseStudy; taxonomy: CaseTaxonomy };
  areaList: { entries: Summary<ServiceArea>[] };
  area: { entry: ServiceArea };
  work: { entry: Work };
}
type CollectionTemplateId = keyof CollectionPageData;

/** Generated pages carry their own file, list path and share card instead of a registry id. */
export interface CollectionPageProps<K extends CollectionTemplateId> {
  template: K;
  file: string;
  listPath: string;
  og: string;
  copy: Messages['collections'];
  messages: SharedMessages;
  data: CollectionPageData[K];
}
export type AnyCollectionPageProps = {
  [K in CollectionTemplateId]: CollectionPageProps<K>;
}[CollectionTemplateId];

/** Discriminated union keeps every template paired with its own catalog. */
export type AnyPageProps = StaticPageProps | AnyCollectionPageProps;
