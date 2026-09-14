import * as C from '@/content/config';
import * as P from '@/content/prices';
import { format } from '@/i18n/format';
import { esc } from '@/lib/raw';

export interface FaqEntry {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
}

/** Resolve current business values once, regardless of which page selects the question. */
export function resolveFaqEntries(entries: readonly FaqEntry[]): FaqEntry[] {
  const n = (value: number) => value.toLocaleString('en-US');
  const standard = P.build('standard').price;
  const values = {
    mStd: n(P.run('run_basic').price),
    stdPrice: n(standard),
    deposit: n(P.paymentSchedule(standard).deposit),
    pSINGLEPrice: n(P.SINGLE.price),
    pCOMPAREMONTHS: P.COMPARE_MONTHS,
    pOPTIONS0Price: n(P.OPTIONS[0].price),
    pRUNTERM: P.RUN_TERM,
    pSUBSIDYAdoptionRate: P.SUBSIDY.adoption_rate,
    cAREA: esc(C.AREA),
    cSERVICENOTE: esc(C.SERVICE_NOTE),
  };
  return entries.map((entry) => ({ ...entry, answer: format(entry.answer, values) }));
}
