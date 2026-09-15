import { initialNotifications } from '../../services/inquiry/outbox';
import type { InquiryRecord } from '../../services/inquiry/records';

/** Dummy personal data only: reserved example domains and all-zero phone numbers. */
export const SAMPLE_FIELDS = {
  name: 'Sample Person',
  business: null,
  industry: null,
  tel: '000-0000-0000',
  email: 'sample@example.com',
  message: 'Sample inquiry body',
} as const;

export function makeRecord(id: string, receivedAt: string, change: Partial<InquiryRecord> = {}): InquiryRecord {
  return {
    id,
    receivedAt,
    fingerprint: `fp-${id}`,
    disposition: 'accepted',
    fields: { ...SAMPLE_FIELDS },
    notifications: initialNotifications(id, ['email', 'line'], new Date(receivedAt)),
    response: { deadline: null, firstReplyAt: null, firstReplyChannel: null },
    contract: { status: 'prospect', changedAt: receivedAt, endedAt: null },
    lastActivityAt: receivedAt,
    legalHold: null,
    version: 0,
    ...change,
  };
}

export const clock = (iso: string) => {
  let current = new Date(iso);
  return {
    now: () => new Date(current),
    set: (next: string) => {
      current = new Date(next);
    },
    advance: (ms: number) => {
      current = new Date(current.getTime() + ms);
    },
  };
};
