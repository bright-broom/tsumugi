import type { AreasInput } from '@/lib/collections/areas';

/**
 * 市区町村別の対応エリア。紬の自社サイトは地域ページを作らないので空にしている。
 *
 * 顧客サイトでは、実際に対応している市区町村だけを、その地域に固有の本文とともに足す。
 * 対応外（service: 'unavailable'）・本文が短い・ほかの地域と本文がほぼ同じ、のどれかに当たると
 * 公開前チェックが止める。地名を差し替えただけのページは作らない。
 */
export default { entries: [] } satisfies AreasInput;
