import { ALL_ROUTES } from '@/routing/registry';
import { getMessages } from '@/i18n/catalog';
import { format } from '@/i18n/format';
import * as P from '@/content/prices';
import { RESPONSE_PROMISE } from '@/content/config';
const copy = getMessages().og;
export const OG_CARDS: Record<string, [string, string]> = Object.fromEntries(
  ALL_ROUTES.map((route) => {
    const values = {
      singlePrice: P.yen(P.SINGLE.price),
      netPrice: P.yen(P.subsidyCalc().net),
      response: RESPONSE_PROMISE,
    };
    const [quiet, loud] = copy.cards[route.id];
    return [route.file, [format(quiet, values), format(loud, values)]];
  }),
);
