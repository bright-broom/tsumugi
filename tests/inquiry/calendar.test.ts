import { describe, expect, it } from 'vitest';
import { BUSINESS_CALENDAR } from '@/content/business-calendar';
import { STORE } from '@/content/store';
import { RESPONSE_ACTUAL, TEL_HOURS } from '@/content/config';
import { CalendarCoverageError, createBusinessCalendar } from '../../services/inquiry/calendar';
import { responseState, summarizeResponses, withFirstReply } from '../../services/inquiry/response';
import { makeRecord } from './fixtures';

const calendar = createBusinessCalendar(BUSINESS_CALENDAR);
/** JST wall-clock time to an instant */
const jst = (local: string) => new Date(`${local}+09:00`);

describe('business calendar data', () => {
  it('lists unique ISO dates inside the declared coverage', () => {
    const { holidays, coverage } = BUSINESS_CALENDAR;
    expect(new Set(holidays).size).toBe(holidays.length);
    expect([...holidays].sort()).toEqual([...holidays]);
    for (const day of holidays) {
      expect(day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(day >= coverage.from && day <= coverage.to).toBe(true);
    }
  });
  it('uses the business hours shown to visitors', () => {
    const hhmm = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
    expect(TEL_HOURS).toContain(hhmm(BUSINESS_CALENDAR.opensAtMinutes));
    expect(TEL_HOURS).toContain(hhmm(BUSINESS_CALENDAR.closesAtMinutes));
    expect(Object.keys(STORE.locations[0]!.hours)).toHaveLength(7);
    for (const hours of Object.values(STORE.locations[0]!.hours))
      expect(hours).toEqual([{ opens: '08:00', closes: '22:00' }]);
    expect(calendar.isBusinessDay('2026-09-12')).toBe(true);
    expect(calendar.isBusinessDay('2026-09-13')).toBe(true);
  });
});

describe('reply deadline (one business day)', () => {
  it.each([
    ['during hours', '2026-09-15T10:00:00', '2026-09-16T10:00:00'],
    ['before opening', '2026-09-15T07:30:00', '2026-09-15T22:00:00'],
    ['after closing', '2026-09-15T23:00:00', '2026-09-16T22:00:00'],
    ['exactly at closing', '2026-09-15T22:00:00', '2026-09-16T22:00:00'],
    ['late on Friday', '2026-09-11T17:00:00', '2026-09-12T17:00:00'],
    ['on Saturday', '2026-09-12T11:00:00', '2026-09-13T11:00:00'],
    ['before the silver week holidays', '2026-09-20T10:00:00', '2026-09-24T10:00:00'],
    ['on a substitute holiday', '2026-05-06T12:00:00', '2026-05-07T22:00:00'],
  ])('%s', (_, received, deadline) => {
    expect(calendar.replyDeadline(jst(received)).toISOString()).toBe(jst(deadline).toISOString());
  });

  it('refuses to guess outside the configured holiday data', () => {
    expect(() => calendar.replyDeadline(jst('2027-12-31T17:00:00'))).toThrow(CalendarCoverageError);
    expect(() => calendar.isBusinessDay('2028-01-04')).toThrow(CalendarCoverageError);
  });

  it('counts only business minutes between two instants', () => {
    expect(calendar.businessMinutesBetween(jst('2026-09-11T17:00:00'), jst('2026-09-14T10:00:00'))).toBe(2100);
    expect(calendar.businessMinutesBetween(jst('2026-09-12T09:00:00'), jst('2026-09-13T22:00:00'))).toBe(1620);
  });
});

describe('response tracking', () => {
  const received = jst('2026-09-15T10:00:00').toISOString();
  const deadline = jst('2026-09-16T10:00:00').toISOString();
  const base = makeRecord('INQ-20260915-AAAAAAAA', received, {
    response: { deadline, firstReplyAt: null, firstReplyChannel: null },
  });

  it('records only the first reply and rejects replies before the inquiry', () => {
    const replied = withFirstReply(base, jst('2026-09-15T15:00:00'), 'tel')!;
    expect(replied.response).toMatchObject({ firstReplyChannel: 'tel' });
    expect(replied.lastActivityAt).toBe(jst('2026-09-15T15:00:00').toISOString());
    expect(withFirstReply(replied, jst('2026-09-15T16:00:00'), 'email')).toBeUndefined();
    expect(() => withFirstReply(base, jst('2026-09-15T09:00:00'), 'tel')).toThrow();
  });

  it('classifies met, late, pending, overdue and untracked inquiries', () => {
    const now = jst('2026-09-16T12:00:00');
    expect(responseState(withFirstReply(base, jst('2026-09-16T09:59:00'), 'email')!, now)).toBe('met');
    expect(responseState(withFirstReply(base, jst('2026-09-16T10:01:00'), 'email')!, now)).toBe('late');
    expect(responseState(base, jst('2026-09-16T09:00:00'))).toBe('pending');
    expect(responseState(base, now)).toBe('overdue');
    expect(responseState({ ...base, response: { ...base.response, deadline: null } }, now)).toBe('untracked');
  });

  it('reports no rate without measured replies and ignores suspected spam', () => {
    const now = jst('2026-09-16T12:00:00');
    expect(summarizeResponses([], calendar, now)).toMatchObject({ total: 0, metRate: null, maxBusinessMinutes: null });
    const spam = { ...withFirstReply(base, jst('2026-09-17T10:00:00'), 'email')!, disposition: 'suspected-spam' as const };
    const summary = summarizeResponses(
      [withFirstReply(base, jst('2026-09-15T15:00:00'), 'tel')!, { ...base, id: 'b' }, spam],
      calendar,
      now,
    );
    expect(summary).toMatchObject({ total: 2, met: 1, overdue: 1, metRate: 1, maxBusinessMinutes: 300 });
  });

  it('keeps the published response actual empty until measured data is confirmed by the owner', () => {
    expect(RESPONSE_ACTUAL).toBeNull();
  });
});
