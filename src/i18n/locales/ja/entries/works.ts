import type { WorksInput } from '@/lib/collections/works';

/**
 * 紬の顧客事例。掲載できる顧客事例はまだないので空にしている（works.html は現在の説明のまま）。
 *
 * 追加するときは、掲載許可（permission）の記録、公開前後の測定値と測定期間・出所を入れる。
 * 測っていない値は { status: 'not-measured', note: '理由' } とし、0 を入れない。
 */
export default { entries: [] } satisfies WorksInput;
