import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Page from '@/application/Page';
import { pageProps } from '@/application/static-props';
import { NAV } from '@/content/nav';
import { ALL_ROUTES, ROUTES } from '@/routing/registry';

const html = renderToStaticMarkup(<Page {...pageProps('index')} />);
const main = html.match(/<main[\s\S]*?<\/main>/)![0];
const pages = (fragment: string) =>
  new Set([...fragment.matchAll(/href="(\/[a-z0-9-]+\.html)(?:#[^"]*)?"/g)].map((m) => m[1]));

describe('トップページから詳細ページへの導線', () => {
  it('本文だけで、全ての詳細ページと業種ページへ移動できる', () => {
    const linked = pages(main);
    const details = ALL_ROUTES.filter(
      (route) => (route.kind === 'main' || route.kind === 'industry') && route.id !== 'index',
    );
    expect(details.length).toBeGreaterThan(15);
    expect(details.filter((route) => !linked.has(route.path)).map((route) => route.id)).toEqual([]);
  });

  it('各セクションに詳細ページへのリンクが1つ以上ある', () => {
    const sections = [
      ...main.matchAll(
        /<section class="([^"]*(?:home-section|home-intro)[^"]*)"[\s\S]*?<\/section>/g,
      ),
    ];
    expect(sections).toHaveLength(9);
    for (const [fragment, cls] of sections) {
      const detail = [...pages(fragment)].filter((path) => path !== ROUTES.index.path);
      expect(detail, cls).not.toEqual([]);
    }
  });

  it('導線の文言はナビと同じラベルを使う', () => {
    const labels = new Map(NAV.map(([file, label]) => [`/${file}`, label]));
    const links = [...main.matchAll(/<ul class="route-links">([\s\S]*?)<\/ul>/g)].flatMap(
      ([list]) => [...list.matchAll(/href="([^"]+)"[\s\S]*?<span>([^<]+)<\/span>/g)],
    );
    // 各セクションの末尾に 1 行ずつ詳細への導線を置く（2026-09-26、ボタンと本文中のリンクを導線の行へ集約）
    expect(links.length).toBe(14);
    for (const [, path, label] of links) expect(label).toBe(labels.get(path!));
  });
});
