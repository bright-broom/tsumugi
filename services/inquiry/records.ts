/**
 * 受付記録の型と保存先のインターフェース（ADR 0032）。
 * 通知の送信状態（送信箱）と返信・契約・保持の情報も同じ記録に持ち、1 回の書き込みで受付と通知予定を同時に残す。
 */

export type ChannelId = 'email' | 'line' | 'sms';
export type ReplyChannel = 'tel' | 'email' | 'line' | 'sms';
type Disposition ='accepted' | 'suspected-spam';
export type ContractStatus = 'prospect' | 'contracted' | 'ended';

export interface InquiryFields {
  name: string;
  business: string | null;
  industry: string | null;
  tel: string;
  email: string | null;
  message: string;
}

export interface NotificationState {
  channel: ChannelId;
  /** 受付番号とチャネルから決まる。送信アダプタに渡し、再送でも同じ値を使う */
  idempotencyKey: string;
  status: 'pending' | 'sending' | 'delivered' | 'failed';
  attempts: number;
  nextAttemptAt: string;
  leaseToken: string | null;
  leaseUntil: string | null;
  deliveredAt: string | null;
  lastError: string | null;
}

export interface InquiryRecord {
  id: string;
  receivedAt: string;
  /** 同一内容の判定用。入力値の SHA-256。記録と一緒に削除される */
  fingerprint: string;
  disposition: Disposition;
  fields: InquiryFields;
  notifications: NotificationState[];
  response: {
    deadline: string | null;
    firstReplyAt: string | null;
    firstReplyChannel: ReplyChannel | null;
  };
  contract: { status: ContractStatus; changedAt: string; endedAt: string | null };
  /** 受付・初回返信・契約状態の記録のうち最も新しい時刻。非契約の保持期限の起点 */
  lastActivityAt: string;
  legalHold: { reason: string; placedAt: string; placedBy: string } | null;
  version: number;
}

interface CreateResult {
  record: InquiryRecord;
  created: boolean;
}

/**
 * 保存先。本番の実装は、次の 2 つを原子的に行えること（条件付き書き込み・一意制約・トランザクションなど）。
 * - createOrGetRecent: 同じ fingerprint で notBefore 以降の記録があればそれを返し、なければ保存する
 * - update: 読み取りから書き込みまでの間にほかの更新が入らないこと（version で比較する）
 */
export interface InquiryStore {
  createOrGetRecent(record: InquiryRecord, notBefore: Date): Promise<CreateResult>;
  get(id: string): Promise<InquiryRecord | undefined>;
  /** change が undefined を返したら書き込まない。記録がなければ undefined */
  update(
    id: string,
    change: (current: InquiryRecord) => InquiryRecord | undefined,
  ): Promise<InquiryRecord | undefined>;
  list(): Promise<InquiryRecord[]>;
  delete(id: string): Promise<boolean>;
}

const copy = <T>(value: T): T => structuredClone(value);

/** 配列に対する操作。メモリ実装とファイル実装で共有する */
export const recordsOps = {
  createOrGetRecent(records: InquiryRecord[], record: InquiryRecord, notBefore: Date) {
    const since = notBefore.getTime();
    const recent = records.find(
      (r) => r.fingerprint === record.fingerprint && Date.parse(r.receivedAt) >= since,
    );
    if (recent) return { records, result: { record: copy(recent), created: false } };
    if (records.some((r) => r.id === record.id))
      throw new Error(`Inquiry id already exists: ${record.id}`);
    const stored = { ...copy(record), version: 1 };
    return { records: [...records, stored], result: { record: copy(stored), created: true } };
  },
  update(
    records: InquiryRecord[],
    id: string,
    change: (current: InquiryRecord) => InquiryRecord | undefined,
  ) {
    const index = records.findIndex((r) => r.id === id);
    if (index < 0) return { records, result: undefined, changed: false };
    const current = records[index]!;
    const next = change(copy(current));
    if (!next) return { records, result: copy(current), changed: false };
    if (next.id !== current.id) throw new Error('Inquiry id cannot change');
    const stored = { ...copy(next), version: current.version + 1 };
    const updated = records.slice();
    updated[index] = stored;
    return { records: updated, result: copy(stored), changed: true };
  },
};

/** テストと単一プロセスの開発用。再起動で消える */
export class MemoryInquiryStore implements InquiryStore {
  #records: InquiryRecord[] = [];

  async createOrGetRecent(record: InquiryRecord, notBefore: Date) {
    const { records, result } = recordsOps.createOrGetRecent(this.#records, record, notBefore);
    this.#records = records;
    return result;
  }
  async get(id: string) {
    const found = this.#records.find((r) => r.id === id);
    return found && copy(found);
  }
  async update(id: string, change: (current: InquiryRecord) => InquiryRecord | undefined) {
    const { records, result } = recordsOps.update(this.#records, id, change);
    this.#records = records;
    return result;
  }
  async list() {
    return copy(this.#records);
  }
  async delete(id: string) {
    const before = this.#records.length;
    this.#records = this.#records.filter((r) => r.id !== id);
    return this.#records.length !== before;
  }
}
