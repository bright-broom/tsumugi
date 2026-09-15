import type { Messages } from '@/i18n/catalog';
import type { RouteId, TemplateId } from '@/routing/registry';
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
  pass: number | string;
}
/** Discriminated union keeps every template paired with its own catalog. */
export type AnyPageProps = { [K in TemplateId]: PageProps<K> }[TemplateId];
