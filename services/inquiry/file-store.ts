/**
 * ローカル開発用のファイル保存先。1 つの JSON に全件を持ち、一時ファイルへ書いてから置き換える。
 * 同じプロセス内の書き込みは順番に処理する。複数プロセス・本番での利用は想定しない（ADR 0032）。
 * 保存場所は Git 管理外（既定は .artifacts/inquiry/）にし、ファイルの権限は所有者だけにする。
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { recordsOps, type InquiryRecord, type InquiryStore } from './records';

interface FileShape {
  format: 1;
  records: InquiryRecord[];
}

export class FileInquiryStore implements InquiryStore {
  readonly file: string;
  #queue: Promise<unknown> = Promise.resolve();

  constructor(directory: string) {
    this.file = join(directory, 'inquiries.json');
  }

  async #read(): Promise<InquiryRecord[]> {
    try {
      const parsed = JSON.parse(await readFile(this.file, 'utf8')) as FileShape;
      if (parsed.format !== 1 || !Array.isArray(parsed.records))
        throw new Error(`Unsupported inquiry file format: ${this.file}`);
      return parsed.records;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  }

  async #write(records: InquiryRecord[]) {
    const directory = join(this.file, '..');
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const temporary = `${this.file}.${process.pid}.${Date.now()}.tmp`;
    const body: FileShape = { format: 1, records };
    await writeFile(temporary, `${JSON.stringify(body, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, this.file);
  }

  /** 読み取りから書き込みまでを直列にする */
  #exclusive<T>(task: () => Promise<T>): Promise<T> {
    const run = this.#queue.then(task, task);
    this.#queue = run.catch(() => undefined);
    return run;
  }

  createOrGetRecent(record: InquiryRecord, notBefore: Date) {
    return this.#exclusive(async () => {
      const current = await this.#read();
      const { records, result } = recordsOps.createOrGetRecent(current, record, notBefore);
      if (result.created) await this.#write(records);
      return result;
    });
  }

  get(id: string) {
    return this.#exclusive(async () => (await this.#read()).find((r) => r.id === id));
  }

  update(id: string, change: (current: InquiryRecord) => InquiryRecord | undefined) {
    return this.#exclusive(async () => {
      const { records, result, changed } = recordsOps.update(await this.#read(), id, change);
      if (changed) await this.#write(records);
      return result;
    });
  }

  list() {
    return this.#exclusive(() => this.#read());
  }

  delete(id: string) {
    return this.#exclusive(async () => {
      const current = await this.#read();
      const records = current.filter((r) => r.id !== id);
      if (records.length === current.length) return false;
      await this.#write(records);
      return true;
    });
  }
}
