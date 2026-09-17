import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import Page from '@/application/Page';
import { collectionPageProps, collectionPaths } from '@/application/static-props';
import {
  SITE_COLLECTIONS,
  collectionRoutes,
  loadCollections,
  reviewCollections,
  type CollectionSource,
} from '@/content/collections';
import { NAV_GROUPS, navigationGroups } from '@/content/nav';
import { DOMAIN } from '@/content/config';
import { sitemapXml } from '@/content/sitemap';
import { getMessages } from '@/i18n/catalog';
import { FILTER_LIMITS, matchesSelection, type CaseStudy } from '@/lib/collections/cases';
import { AREA_MIN_SPECIFIC_CHARS } from '@/lib/collections/areas';
import { CollectionError } from '@/lib/collections/core';
import { ALL_ROUTES, PUBLIC_ROUTES } from '@/routing/registry';
import PublishedWorks from '@/views/collections/works-section';
import { cloneFixture, fixtureSource } from './fixtures/collections';

const ROOT = join(import.meta.dirname, '..');
const site = loadCollections(fixtureSource);
const files = (source: CollectionSource) =>
  collectionRoutes(loadCollections(source)).map((route) => route.file);
const render = (file: string, collections = site) => {
  const props = collectionPageProps(file, collections);
  if (!props) throw new Error(`no page for ${file}`);
  return renderToStaticMarkup(<Page {...JSON.parse(JSON.stringify(props))} />);
};
const problems = (source: CollectionSource) =>
  reviewCollections(source).problems.map((problem) => `${problem.slug}: ${problem.reason}`);

describe('this site (no collection content)', () => {
  it('generates no collection pages and keeps the 21 fixed routes, sitemap and navigation', () => {
    expect(collectionRoutes(SITE_COLLECTIONS)).toEqual([]);
    expect(collectionPaths('list')).toEqual([]);
    expect(collectionPaths('entry')).toEqual([]);
    expect(ALL_ROUTES).toHaveLength(21);
    expect(sitemapXml()).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        PUBLIC_ROUTES.map(
          (route) => `  <url><loc>https://${DOMAIN}/${route.file}</loc></url>\n`,
        ).join('') +
        '</urlset>\n',
    );
    expect(NAV_GROUPS.flatMap((group) => group.entries)).toHaveLength(13);
    expect(renderToStaticMarkup(<PublishedWorks />)).toBe('');
  });

  it('ships six empty article intake slots that the pre-publication check reports', () => {
    const { drafts, problems: blocking } = reviewCollections(getMessages().entries);
    expect(blocking).toEqual([]);
    const slots = drafts.filter((draft) => draft.slot !== null);
    expect(slots.map((draft) => draft.slot)).toEqual([
      'initial-1',
      'initial-2',
      'initial-3',
      'additional-1',
      'additional-2',
      'additional-3',
    ]);
    for (const slot of slots) {
      expect(slot.missing).toContain('slug is still an intake placeholder');
      expect(slot.missing).toContain('body needs at least one paragraph');
      expect(slot.missing).toContain('publishedAt is required');
    }
  });
});

describe('generated routes (fictional fixture)', () => {
  it('publishes lists and entries, never drafts, without colliding with fixed pages', () => {
    const generated = files(fixtureSource);
    expect(generated).toEqual([
      'news.html',
      'news/fixture-column-1.html',
      'news/fixture-news-1.html',
      'cases.html',
      'cases/case-b.html',
      'cases/case-a.html',
      'cases/case-c.html',
      'areas.html',
      'areas/fixture-shiken.html',
      'areas/fixture-mihon.html',
      'works/work-fixture.html',
    ]);
    expect(generated.join()).not.toMatch(/draft|secret|outside|pending/);
    const fixed = new Set<string>(ALL_ROUTES.map((route) => route.file));
    for (const file of generated) expect(fixed.has(file)).toBe(false);
    expect(collectionPaths('list', site)).toEqual([
      { page: 'news', slug: '' },
      { page: 'cases', slug: '' },
      { page: 'areas', slug: '' },
    ]);
    expect(collectionPaths('entry', site)).toContainEqual({ page: 'works', slug: 'work-fixture' });
    expect(collectionPageProps('news/draft-initial-1.html', site)).toBeUndefined();
    expect(collectionPageProps('news/fixture-secret-draft.html', site)).toBeUndefined();
    expect(collectionPageProps('works.html', site)).toBeUndefined();
  });

  it('adds generated pages to the sitemap with canonical URLs and last modification dates', () => {
    const xml = sitemapXml(site, 'example.jp');
    for (const file of files(fixtureSource))
      expect(xml.split(`<loc>https://example.jp/${file}</loc>`)).toHaveLength(2);
    expect(xml).toContain(
      '<url><loc>https://example.jp/news/fixture-news-1.html</loc><lastmod>2026-02-01</lastmod></url>',
    );
    expect(xml).toContain('<loc>https://example.jp/news.html</loc><lastmod>2026-03-05</lastmod>');
    expect(xml).not.toMatch(/draft|secret/);
  });

  it('links generated lists from the shared navigation after the works page', () => {
    const next = navigationGroups(site).find((group) => group.id === 'next')!;
    expect(next.entries.map((entry) => entry.file)).toEqual([
      'flow.html',
      'works.html',
      'news.html',
      'cases.html',
      'areas.html',
      'faq.html',
      'about.html',
      'contact.html',
    ]);
    expect(navigationGroups()).toEqual(NAV_GROUPS);
  });

  it.each(collectionRoutes(site))('renders $file as a complete static page', (route) => {
    const props = collectionPageProps(route.file, site)!;
    expect(props.file).toBe(route.file);
    expect(Buffer.byteLength(JSON.stringify(props), 'utf8')).toBeLessThan(64 * 1024);
    // Share images fall back to an existing card instead of a new, unrendered PNG.
    expect(existsSync(join(ROOT, 'public', props.og))).toBe(true);
    const html = render(route.file);
    expect(html).toMatch(/<main\b[^>]*\bid="main"[^>]*>/);
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(html).not.toMatch(/<script|\son[a-z]+=|undefined|NaN|<!-- -->/);
    const known = new Set([
      ...ALL_ROUTES.map((fixed) => fixed.path),
      ...collectionRoutes(site).map((generated) => generated.path),
    ]);
    // Anchors only: React also emits an image preload link, whose file must exist in public/images.
    const links = [...html.matchAll(/<a\b[^>]*\shref="([^"#]+)(?:#[^"]*)?"/g)]
      .map((match) => match[1]!)
      .filter((href) => href.startsWith('/'));
    for (const href of links) expect(known, href).toContain(href);
    const firstImage = html.match(/<img\b[^>]*>/)?.[0];
    if (firstImage) {
      expect(firstImage).not.toContain('loading="lazy"');
      expect(firstImage).toContain('fetchPriority="high"');
    }
    expect(html).not.toMatch(/公開してはいけない|公開前の架空|許可待ち|対応外町/);
  });
});

describe('articles', () => {
  it('lists newest first with kinds, and shows publication and update dates', () => {
    const list = render('news.html');
    expect(list.indexOf('架空のコラム')).toBeLessThan(list.indexOf('架空のお知らせ'));
    expect(list).toContain('href="/news/fixture-news-1.html"');
    const article = render('news/fixture-news-1.html');
    expect(article).toContain('<time dateTime="2026-01-10">2026 年 1 月 10 日</time>');
    expect(article).toContain('<time dateTime="2026-02-01">2026 年 2 月 1 日</time>');
    expect(article).toContain('href="/news.html"');
  });

  it('refuses to publish an intake slot that is still empty', () => {
    const source = cloneFixture();
    source.articles.entries[2]!.status = 'published';
    expect(() => loadCollections(source)).toThrow(CollectionError);
    expect(problems(source)).toEqual(
      expect.arrayContaining([
        'draft-initial-1: title is empty',
        'draft-initial-1: slug is still an intake placeholder',
        'draft-initial-1: publishedAt is required',
        'draft-initial-1: body needs at least one paragraph',
      ]),
    );
  });

  it('rejects duplicate slugs and invalid data shapes', () => {
    const source = cloneFixture();
    source.articles.entries[1]!.slug = 'fixture-news-1';
    expect(problems(source)).toContain('fixture-news-1: slug is used more than once');
    const invalid = cloneFixture();
    invalid.articles.entries[0]!.slug = 'Not A Slug';
    expect(() => reviewCollections(invalid)).toThrow(/Invalid articles data/);
  });
});

describe('case studies and the JavaScript-free filter', () => {
  const list = render('cases.html');

  it('offers only values used by published cases and orders inputs before controls and list', () => {
    expect(list.match(/class="cf-radio /g)).toHaveLength(3 + 5 + 3);
    expect(list).not.toContain('カラー（架空）');
    const lastInput = list.lastIndexOf('<input');
    expect(lastInput).toBeLessThan(list.indexOf('class="cf-controls"'));
    expect(list.indexOf('class="cf-controls"')).toBeLessThan(list.indexOf('class="entry-list cf-list"'));
    expect(list.indexOf('class="entry-list cf-list"')).toBeLessThan(list.indexOf('class="cf-empty"'));
    expect(list).toContain('<button class="cf-reset" type="reset">条件を戻す</button>');
    expect(list).toContain('for="cf-f2-v4"');
    expect(list).toMatch(/class="entry-card cf-item cf-i1-v1 cf-i2-v2 cf-i2-v3 cf-i3-v2"/);
    expect(list.match(/checked=""/g)).toHaveLength(3);
  });

  it('matches the reference semantics: AND across facets, one choice each, 0 for all', () => {
    const facets = site.cases.facets;
    const count = (selection: number[]) =>
      site.cases.published.filter((entry) => matchesSelection(facets, entry, selection)).length;
    expect(count([0, 0, 0])).toBe(3);
    expect(count([1, 0, 0])).toBe(2);
    expect(count([1, 3, 0])).toBe(1);
    expect(count([2, 0, 2])).toBe(0); // shows the empty state
    expect(count([2, 1, 0])).toBe(0);
  });

  it('keeps the CSS selectors and the TypeScript limits in step', () => {
    const css = readFileSync(join(ROOT, 'src/styles/collections.css'), 'utf8');
    const { facets: f, values: v } = FILTER_LIMITS;
    expect(css).toContain(`.cf-f${f}-v${v}:checked ~ .cf-list > .cf-item:not(.cf-i${f}-v${v})`);
    expect(css).toContain(`.cf-f${f}-v${v}:checked ~ .cf-controls .cf-l${f}-v${v}`);
    expect(css).toContain(`.cf-f${f}-v${v}:checked ~ .cf-list > .cf-i${f}-v${v}`);
    expect(css).not.toContain(`-v${v + 1}`);
    expect(css).not.toContain(`cf-f${f + 1}-`);
    expect(css).toContain('@supports selector(:has(:is(a ~ b > c)))');
  });

  it('refuses a facet with more values than the CSS supports', () => {
    const source = cloneFixture();
    const many = Array.from({ length: FILTER_LIMITS.values + 1 }, (_, index) => ({
      id: `extra-${index}`,
      label: `架空の分類${index}`,
    }));
    source.cases.taxonomy.industries[0]!.categories.push(...many);
    source.cases.entries[0]!.categories = many.map((option) => option.id);
    expect(problems(source).join()).toContain(`the CSS filter supports ${FILTER_LIMITS.values}`);
  });

  it('reflects adding, updating and unpublishing a case', () => {
    const source = cloneFixture();
    const added = structuredClone(source.cases.entries[2]!);
    Object.assign(added, { slug: 'case-e', title: '追加した架空の事例E', publishedAt: '2026-05-01' });
    source.cases.entries.push(added);
    source.cases.entries[0]!.title = '更新した架空の屋根の事例A';
    source.cases.entries[1]!.status = 'draft';
    const changed = loadCollections(source);
    expect(files(source)).toContain('cases/case-e.html');
    expect(files(source)).not.toContain('cases/case-b.html');
    const html = render('cases.html', changed);
    expect(html).toContain('追加した架空の事例E');
    expect(html).toContain('更新した架空の屋根の事例A');
    expect(html).not.toContain('架空の水回りと外装の事例B');
    expect(render('cases/case-a.html', changed)).toContain('更新した架空の屋根の事例A');
  });

  it('renders a plain list when there is nothing to filter, and details per industry', () => {
    const source = cloneFixture();
    for (const entry of source.cases.entries.slice(1)) entry.status = 'draft';
    const html = render('cases.html', loadCollections(source));
    expect(html).not.toContain('class="cf');
    const detail = render('cases/case-a.html');
    expect(detail).toContain('<dt>工期（架空）</dt><dd>架空の3週間</dd>');
    expect(detail).not.toContain('費用の目安（架空）');
    expect(detail).toContain('href="/contact.html"');
  });

  it('validates categories and fields against the industry', () => {
    const source = cloneFixture();
    (source.cases.entries[2] as CaseStudy).categories = ['roof'];
    source.cases.entries[2]!.fields = { period: '架空' };
    expect(problems(source)).toEqual(
      expect.arrayContaining([
        'case-c: category "roof" is not defined for salon',
        'case-c: field "period" is not defined for salon',
      ]),
    );
  });
});

describe('service areas', () => {
  it('publishes only areas that are served and written for the place', () => {
    const detail = render('areas/fixture-shiken.html');
    expect(detail).toContain('一部の地域で対応しています');
    expect(detail).toContain('架空の東地区だけ');
    expect(detail).toContain('href="/contact.html"');
    const list = render('areas.html');
    expect(list).toContain('<h2 class="entry-subheading">架空県</h2>');
    expect(list).toContain('href="/areas/fixture-mihon.html"');
  });

  it('refuses unavailable, short and boilerplate area pages', () => {
    const unavailable = cloneFixture();
    Object.assign(unavailable.areas.entries[2]!, {
      ...unavailable.areas.entries[0]!,
      slug: 'fixture-outside',
      municipality: '対応外町',
      service: 'unavailable',
    });
    expect(problems(unavailable).join()).toContain('unavailable areas are not published');

    const short = cloneFixture();
    short.areas.entries[0]!.body = [{ type: 'paragraph', text: '見本市の架空の短い本文。' }];
    expect(problems(short).join()).toContain(`${AREA_MIN_SPECIFIC_CHARS} required`);

    const copied = cloneFixture();
    const original = copied.areas.entries[0]!;
    copied.areas.entries.push({
      ...structuredClone(original),
      slug: 'fixture-copy',
      municipality: '複製町',
      body: original.body.map((block) =>
        block.type === 'paragraph' ? { ...block, text: block.text.replaceAll('見本市', '複製町') } : block,
      ),
    });
    expect(problems(copied).join()).toMatch(
      /(fixture-copy: body is \d+% similar to fixture-mihon|fixture-mihon: body is \d+% similar to fixture-copy)/,
    );
  });

  it('adds and removes routes, sitemap entries and the list with the data', () => {
    const source = cloneFixture();
    source.areas.entries[1]!.status = 'draft';
    expect(files(source)).not.toContain('areas/fixture-shiken.html');
    expect(sitemapXml(loadCollections(source))).not.toContain('fixture-shiken');
    source.areas.entries[0]!.status = 'draft';
    expect(files(source).filter((file) => file.startsWith('areas'))).toEqual([]);
  });
});

describe('client work on the works page', () => {
  it('shows recorded periods and sources, and never turns "not measured" into 0', () => {
    const html = render('works/work-fixture.html');
    expect(html).toContain('未計測');
    expect(html).toContain('公開前は記録していない（架空）');
    expect(html).toContain('3.2 秒');
    expect(html).toContain('−2.4 秒');
    expect(html).toContain('出所：架空の計測 A');
    expect(html).toContain('2026 年 3 月 1 日〜2026 年 3 月 31 日');
    expect(html).toContain('両方を測った項目だけ算出します');
    expect(html).not.toMatch(/>0 件<|>\+5 件</);
    expect(html).toContain('営業時間の変更を店主が自分で反映できた（架空）');
    expect(html).toContain('写真の差し替えが予定より遅れた（架空）');
    expect(html).toContain('掲載許可を 2026 年 4 月 1 日に確認しています。');
    expect(html).toContain('href="/works.html"');
  });

  it('adds a section to works.html only when a permitted case is published', () => {
    const html = renderToStaticMarkup(<PublishedWorks site={site} />);
    expect(html).toContain('href="/works/work-fixture.html"');
    expect(html).toContain('掲載許可をいただいた顧客事例');
  });

  it('requires a recorded permission covering what is shown', () => {
    const pending = cloneFixture();
    Object.assign(pending.works.entries[0]!.permission, { status: 'pending' });
    expect(problems(pending)).toContain('work-fixture: permission.status must be "granted"');

    const scoped = cloneFixture();
    scoped.works.entries[0]!.permission.scope = ['name', 'body'];
    expect(problems(scoped)).toContain('work-fixture: metrics need the "metrics" permission scope');

    const unnamed = cloneFixture();
    unnamed.works.entries[0]!.permission.scope = ['metrics', 'body'];
    expect(render('works/work-fixture.html', loadCollections(unnamed))).toContain(
      'お名前は掲載していません',
    );
  });

  it('rejects overlapping measurement periods and unexplained gaps', () => {
    const source = cloneFixture();
    const [lcp, inquiries] = source.works.entries[0]!.metrics;
    Object.assign(lcp!.after, { from: '2026-01-15' });
    Object.assign(inquiries!.before, { note: '' });
    expect(problems(source)).toEqual(
      expect.arrayContaining([
        'work-fixture: metrics[0]: the after period must start after the before period ends',
        'work-fixture: metrics[1].before: explain why it was not measured',
      ]),
    );
  });
});
