/**
 * 架空のコレクションデータ（テスト専用）。実在の事業者・地域・記事・顧客・数値ではない。
 * src/ からは参照しないので、公開物（out/）には出ない。
 */
import type { ArticlesInput } from '@/lib/collections/articles';
import type { AreasInput } from '@/lib/collections/areas';
import type { CasesInput } from '@/lib/collections/cases';
import type { WorksInput } from '@/lib/collections/works';

const seo = (subject: string) => ({
  title: '',
  description: `${subject}の説明です。これはテスト用の架空のデータで、実在の事業者・地域・記事とは関係がありません。`,
});

const articles: ArticlesInput = {
  entries: [
    {
      slug: 'fixture-news-1',
      status: 'published',
      kind: 'news',
      title: '架空のお知らせ（テスト用）',
      publishedAt: '2026-01-10',
      updatedAt: '2026-02-01',
      seo: seo('架空のお知らせ'),
      body: [{ type: 'paragraph', text: 'テスト用の架空のお知らせ本文です。' }],
    },
    {
      slug: 'fixture-column-1',
      status: 'published',
      kind: 'column',
      title: '架空のコラム（テスト用）',
      publishedAt: '2026-03-05',
      image: { src: '/images/fixture/column.webp', alt: '架空のコラムの写真', width: 1200, height: 800 },
      seo: seo('架空のコラム'),
      body: [
        { type: 'heading', text: '架空の見出し' },
        { type: 'paragraph', text: 'テスト用の架空のコラム本文です。' },
        { type: 'list', items: ['架空の項目1', '架空の項目2'] },
      ],
    },
    {
      slug: 'draft-initial-1',
      status: 'draft',
      kind: 'column',
      title: '',
      seo: { title: '', description: '' },
      body: [],
      intake: { slot: 'initial-1', group: 'initial' },
    },
    {
      slug: 'fixture-secret-draft',
      status: 'draft',
      kind: 'news',
      title: '公開してはいけない架空の下書き',
      publishedAt: '2026-04-01',
      seo: seo('公開してはいけない架空の下書き'),
      body: [{ type: 'paragraph', text: '公開してはいけない架空の本文です。' }],
    },
  ],
};

const cases: CasesInput = {
  taxonomy: {
    industries: [
      {
        id: 'builder',
        label: '架空の工務店業',
        categories: [
          { id: 'roof', label: '屋根（架空）' },
          { id: 'bath', label: '水回り（架空）' },
          { id: 'exterior', label: '外装（架空）' },
        ],
        fields: [
          { id: 'period', label: '工期（架空）' },
          { id: 'budget', label: '費用の目安（架空）' },
        ],
      },
      {
        id: 'salon',
        label: '架空のサロン業',
        categories: [
          { id: 'cut', label: 'カット（架空）' },
          { id: 'color', label: 'カラー（架空）' },
        ],
        fields: [{ id: 'menu', label: 'メニュー（架空）' }],
      },
    ],
    areas: [
      { id: 'mihon', label: '見本市（架空）' },
      { id: 'shiken', label: '試験町（架空）' },
    ],
  },
  entries: [
    {
      slug: 'case-a',
      status: 'published',
      title: '架空の屋根の事例A',
      publishedAt: '2026-02-01',
      image: { src: '/images/fixture/case-a.webp', alt: '架空の屋根の写真', width: 1200, height: 800 },
      seo: seo('架空の屋根の事例A'),
      industry: 'builder',
      categories: ['roof'],
      area: 'mihon',
      summary: 'テスト用の架空の事例Aです。',
      fields: { period: '架空の3週間' },
      gallery: [],
      body: [],
    },
    {
      slug: 'case-b',
      status: 'published',
      title: '架空の水回りと外装の事例B',
      publishedAt: '2026-03-01',
      seo: seo('架空の水回りと外装の事例B'),
      industry: 'builder',
      categories: ['bath', 'exterior'],
      area: 'shiken',
      summary: 'テスト用の架空の事例Bです。',
      fields: {},
      gallery: [],
      body: [],
      image: { src: '/images/fixture/case-b.webp', alt: '架空の水回りの写真', width: 1200, height: 800 },
    },
    {
      slug: 'case-c',
      status: 'published',
      title: '架空のカットの事例C',
      publishedAt: '2026-01-15',
      seo: seo('架空のカットの事例C'),
      industry: 'salon',
      categories: ['cut'],
      area: 'mihon',
      summary: 'テスト用の架空の事例Cです。',
      fields: { menu: '架空のメニュー' },
      gallery: [],
      body: [{ type: 'paragraph', text: 'テスト用の架空の本文です。' }],
      image: { src: '/images/fixture/case-c.webp', alt: '架空の店内の写真', width: 1200, height: 800 },
    },
    {
      slug: 'case-d-draft',
      status: 'draft',
      title: '公開前の架空のカラーの事例D',
      seo: { title: '', description: '' },
      industry: 'salon',
      categories: ['color'],
      summary: '',
      fields: {},
      gallery: [],
      body: [],
    },
  ],
};

const areas: AreasInput = {
  entries: [
    {
      slug: 'fixture-mihon',
      status: 'published',
      title: '見本市（架空）の対応エリア',
      publishedAt: '2026-02-10',
      seo: seo('見本市（架空）の対応エリア'),
      prefecture: '架空県',
      municipality: '見本市',
      service: 'available',
      serviceNote: '',
      body: [
        {
          type: 'paragraph',
          text: 'これはテスト用の架空の地域ページです。見本市では、駅の北側にある古い商店街の店舗から、坂の上の住宅地まで、移動に片道三十分ほどかかる範囲を想定しています。',
        },
        {
          type: 'paragraph',
          text: '冬は路面が凍る日があるため、打ち合わせは日中に設定し、写真の撮影は晴れた日の午前に行うという、架空の運用ルールを書いています。',
        },
      ],
    },
    {
      slug: 'fixture-shiken',
      status: 'published',
      title: '試験町（架空）の対応エリア',
      publishedAt: '2026-02-12',
      seo: seo('試験町（架空）の対応エリア'),
      prefecture: '架空県',
      municipality: '試験町',
      service: 'partial',
      serviceNote: '架空の東地区だけ',
      body: [
        {
          type: 'paragraph',
          text: 'これもテスト用の架空の地域ページです。試験町は川をはさんで東西に分かれていて、橋を渡る必要がない東地区だけを訪問の対象にしているという想定です。',
        },
        {
          type: 'paragraph',
          text: '西地区のご相談は電話とオンラインで受け、資料は郵送でやり取りするという、架空の条件を記載しています。港の近くの漁具店の事例を想定した文章です。',
        },
      ],
    },
    {
      slug: 'fixture-outside',
      status: 'draft',
      title: '対応外の架空の町',
      seo: { title: '', description: '' },
      prefecture: '架空県',
      municipality: '対応外町',
      service: 'unavailable',
      serviceNote: '',
      body: [],
    },
  ],
};

const works: WorksInput = {
  entries: [
    {
      slug: 'work-fixture',
      status: 'published',
      title: '架空商店のサイト（テスト用）',
      publishedAt: '2026-04-10',
      seo: seo('架空商店のサイト'),
      client: { name: '架空商店（テスト用）', industry: '架空の小売業', area: '架空県' },
      permission: {
        status: 'granted',
        scope: ['name', 'metrics', 'body'],
        recordedAt: '2026-04-01',
        method: 'テスト用の架空の記録',
        note: '',
      },
      launchedAt: '2026-02-15',
      summary: 'テスト用の架空の顧客事例です。',
      metrics: [
        {
          kind: 'lcp',
          note: '架空のトップページ',
          before: { status: 'measured', value: 3.2, from: '2026-01-01', to: '2026-01-31', source: '架空の計測A' },
          after: { status: 'measured', value: 0.8, from: '2026-03-01', to: '2026-03-31', source: '架空の計測B' },
        },
        {
          kind: 'inquiries',
          note: '架空のフォーム経由',
          before: { status: 'not-measured', note: '公開前は記録していない（架空）' },
          after: { status: 'measured', value: 5, from: '2026-03-01', to: '2026-03-31', source: '架空の受付記録' },
        },
      ],
      outcomes: ['営業時間の変更を店主が自分で反映できた（架空）'],
      setbacks: ['写真の差し替えが予定より遅れた（架空）'],
      body: [{ type: 'paragraph', text: 'テスト用の架空の本文です。' }],
    },
    {
      slug: 'work-pending',
      status: 'draft',
      title: '許可待ちの架空の事例',
      seo: { title: '', description: '' },
      client: { name: '許可待ちの架空の店', industry: '架空', area: '' },
      permission: { status: 'pending', scope: [], method: '', note: '' },
      summary: '',
      metrics: [],
      outcomes: [],
      setbacks: [],
      body: [],
    },
  ],
};

export const fixtureSource = { articles, cases, areas, works };
export type FixtureSource = typeof fixtureSource;
/** A deep copy the test may change without affecting other tests. */
export const cloneFixture = (): FixtureSource => structuredClone(fixtureSource);
