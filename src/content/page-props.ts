import type { Messages } from '@/i18n/catalog';
import type { RouteId, TemplateId } from '@/routing/registry';
import type { VerifiedSummary } from '@/lib/verification-report';
export type SharedMessages = Pick<
  Messages,
  'shell' | 'cta' | 'entry' | 'plans' | 'table' | 'vs' | 'diagrams'
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
/** Discriminated union keeps every template paired with its own catalog. */
export type AnyPageProps = { [K in TemplateId]: PageProps<K> }[TemplateId];
