import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  type GbpOps,
  approveChange,
  approveTask,
  compareProfiles,
  draftTask,
  dueTasks,
  editDraft,
  profileSchema,
  proposeChange,
  recordChangeApplied,
  recordTaskDone,
} from '../../tools/ops/gbp/model';

const profile = (name: string) =>
  profileSchema.parse(
    JSON.parse(
      readFileSync(new URL(`../../tools/ops/fixtures/gbp/${name}`, import.meta.url), 'utf8'),
    ),
  );
const site = profile('site-profile.json');
const gbp = profile('gbp-profile.json');
const empty: GbpOps = { customerId: 'sample-shop', changes: [], tasks: [] };
const meta = { at: '2026-09-16T10:00:00+09:00', by: 'サンプル担当' };

describe('サイトと GBP の突き合わせ', () => {
  const findings = compareProfiles(site, gbp);
  const kind = (field: string) => findings.find((f) => f.field === field)?.kind;

  it('正規化して同じなら表記ゆれ、違えば不一致、片方だけなら片方だけ', () => {
    expect(kind('店名')).toBe('notation');
    expect(kind('住所')).toBe('notation');
    expect(kind('電話')).toBe('notation');
    expect(kind('ウェブサイト')).toBe('notation');
    expect(kind('予約先')).toBe('missing');
    expect(kind('営業時間（月）')).toBe('match');
    expect(kind('営業時間（水）')).toBe('match');
    expect(findings.find((f) => f.field === '営業時間（土）')).toEqual({
      field: '営業時間（土）',
      site: '11:00-21:00',
      gbp: '11:00-20:00',
      kind: 'mismatch',
    });
    expect(findings.find((f) => f.field === '臨時営業時間（2026-12-31）')).toMatchObject({
      site: '休業',
      gbp: '（未設定）',
      kind: 'missing',
    });
  });

  it('住所の番地が違えば不一致、他の顧客のプロフィールは比べない', () => {
    const moved = { ...gbp, address: '架空県架空市中央1-2-4' };
    expect(compareProfiles(site, moved).find((f) => f.field === '住所')?.kind).toBe('mismatch');
    expect(() => compareProfiles(site, { ...gbp, customerId: 'other-shop' })).toThrow('顧客 ID');
    expect(() => compareProfiles(gbp, site)).toThrow('サイト側と GBP 側');
  });
});

describe('変更は承認してから反映を記録する', () => {
  it('承認のない変更を反映済みにしない', () => {
    let f = proposeChange(empty, {
      id: 'hours-sat',
      field: '営業時間（土）',
      value: '11:00-21:00',
      target: 'gbp',
      by: 'サンプル担当',
      on: '2026-09-16',
    });
    expect(() =>
      recordChangeApplied(f, 'hours-sat', { by: 'x', on: '2026-09-16', evidence: 'x' }),
    ).toThrow('承認されていない');
    f = approveChange(f, 'hours-sat', { by: 'サンプル顧客', on: '2026-09-17' });
    f = recordChangeApplied(f, 'hours-sat', {
      by: 'サンプル担当',
      on: '2026-09-18',
      evidence: '管理画面の表示を確認（サンプル）',
    });
    expect(f.changes[0]).toMatchObject({
      approved: { by: 'サンプル顧客' },
      applied: { on: '2026-09-18' },
    });
    expect(() => approveChange(f, 'hours-sat', { by: 'x', on: '2026-09-18' })).toThrow('承認済み');
  });
});

describe('投稿・口コミ返信：下書き → 承認 → 実施の記録', () => {
  const drafted = () =>
    draftTask(
      empty,
      {
        id: 'post-0901',
        kind: 'post',
        dueOn: '2026-09-20',
        draft: '秋のメニューのお知らせ（サンプル）',
      },
      meta,
    );

  it('承認のない投稿・返信を実施済みにしない', () => {
    expect(() =>
      recordTaskDone(drafted(), 'post-0901', { ...meta, on: '2026-09-20', evidence: 'x' }),
    ).toThrow('承認されていない');
  });

  it('承認後に文面を直すと承認が外れ、承認し直すまで実施を記録できない', () => {
    let f = approveTask(drafted(), 'post-0901', { ...meta, by: 'サンプル顧客', on: '2026-09-17' });
    f = editDraft(f, 'post-0901', '秋のメニューのお知らせ（修正版・サンプル）', meta);
    expect(f.tasks[0]).toMatchObject({ status: 'draft' });
    expect(f.tasks[0]!.approved).toBeUndefined();
    expect(() =>
      recordTaskDone(f, 'post-0901', { ...meta, on: '2026-09-20', evidence: 'x' }),
    ).toThrow('承認されていない');
    f = approveTask(f, 'post-0901', { ...meta, by: 'サンプル顧客', on: '2026-09-18' });
    f = recordTaskDone(f, 'post-0901', {
      ...meta,
      on: '2026-09-20',
      evidence: '公開後の表示を確認（サンプル）',
    });
    expect(f.tasks[0]!.history.map((h) => h.action)).toEqual([
      '下書きを作成',
      '承認',
      '文面を修正（承認を取り消し）',
      '承認',
      '実施を記録',
    ]);
    expect(() => editDraft(f, 'post-0901', '変更', meta)).toThrow('実施済み');
  });

  it('承認した後に文面だけが書き換えられていたら、実施を記録しない', () => {
    const f = approveTask(drafted(), 'post-0901', { ...meta, on: '2026-09-17' });
    const tampered = { ...f, tasks: [{ ...f.tasks[0]!, draft: '承認していない文面' }] };
    expect(() =>
      recordTaskDone(tampered, 'post-0901', { ...meta, on: '2026-09-20', evidence: 'x' }),
    ).toThrow('承認した文面');
  });

  it('口コミ返信は対象の口コミを必須にし、期日を過ぎた未実施を出す', () => {
    expect(() =>
      draftTask(
        empty,
        {
          id: 'reply-1',
          kind: 'review_reply',
          dueOn: '2026-09-18',
          draft: 'ご来店ありがとうございます（サンプル）',
        },
        meta,
      ),
    ).toThrow('口コミの特定');
    let f = draftTask(
      empty,
      {
        id: 'reply-1',
        kind: 'review_reply',
        dueOn: '2026-09-18',
        draft: 'ご来店ありがとうございます（サンプル）',
        reviewRef: '2026-09-15 の口コミ（サンプル）',
      },
      meta,
    );
    f = draftTask(f, { id: 'post-2', kind: 'post', dueOn: '2026-09-30', draft: 'サンプル' }, meta);
    expect(dueTasks(f, '2026-09-19').map((d) => [d.task.id, d.overdue])).toEqual([
      ['reply-1', true],
      ['post-2', false],
    ]);
  });
});
