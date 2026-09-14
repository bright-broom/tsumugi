import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { getMessages } from '@/i18n/catalog';
import { questions } from '@/i18n/locales/ja/questions';
import { resolveFaqEntries } from '@/content/faq';
import { NAV, NAV_GROUPS } from '@/content/nav';
import * as P from '@/content/prices';
import { href, ROUTES } from '@/routing/registry';
import FaqList from '@/components/FaqList';
import NavigationGroups from '@/components/NavigationGroups';

const copy = getMessages();
const allQuestions = copy.faq.groups.flatMap((group) => [...group.entries]);

describe('information architecture', () => {
  it('keeps every canonical question in exactly one category with stable unique anchors', () => {
    const ids = allQuestions.map((entry) => entry.id);
    expect(ids).toHaveLength(30);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.sort()).toEqual(Object.keys(questions).sort());
    const html = renderToStaticMarkup(<FaqList entries={allQuestions} />);
    for (const id of ids) expect(html.split(`id="faq-${id}"`)).toHaveLength(2);
  });

  it('uses the same complete answer for each of the five home questions', () => {
    expect(copy.home.questions).toHaveLength(5);
    for (const question of copy.home.questions) {
      const canonical = allQuestions.find((entry) => entry.id === question.id);
      expect(question).toEqual(canonical);
      expect(renderToStaticMarkup(<FaqList entries={[question]} />)).toBe(
        renderToStaticMarkup(<FaqList entries={[canonical!]} />),
      );
    }
  });

  it('resolves business values and links without losing restrictions', () => {
    const entries = resolveFaqEntries(allQuestions);
    const answer = (id: string) => entries.find((entry) => entry.id === id)!.answer;
    expect(JSON.stringify(entries)).not.toMatch(/\{[A-Za-z][A-Za-z0-9]*\}|@route:/);
    expect(answer('monthly-cost')).toContain(P.run('run_basic').price.toLocaleString('en-US'));
    expect(answer('monthly-cost')).toContain('外部費は別途');
    expect(answer('initial-cost')).toContain(
      P.paymentSchedule(P.build('standard').price).deposit.toLocaleString('en-US'),
    );
    expect(answer('initial-cost')).toContain('受付準備中');
    expect(answer('writing')).toContain('支給素材から原稿を整理');
    expect(answer('writing')).toContain(href('price'));
    expect(answer('case-studies')).toContain('この自社サイト1件');
    expect(answer('case-studies')).toContain(href('works'));
  });

  it('keeps four ownership deliverables consistent and retains third-party rights', () => {
    expect(copy.home.ownership).toEqual(copy.owned.ownership);
    expect(copy.home.ownership).toHaveLength(4);
    expect(copy.home.ownership.map((item) => item.link[1])).toEqual([
      href('terms'),
      href('source'),
      href('spec'),
      href('terms'),
    ]);
    expect(copy.home.ownership[3].desc).toContain('第三者の利用条件');
  });

  it('groups all main routes once without hiding any route', () => {
    const files = NAV_GROUPS.flatMap((group) => group.entries.map((entry) => entry.file));
    expect(files.sort()).toEqual(NAV.map(([file]) => file).sort());
    expect(new Set(files).size).toBe(files.length);
  });

  it('labels both navigation surfaces independently and marks the current page', () => {
    const html = renderToStaticMarkup(
      <>
        <NavigationGroups file={ROUTES.faq.file} surface="menu" />
        <NavigationGroups file={ROUTES.faq.file} surface="footer" />
      </>,
    );
    const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((match) => match[1]);
    expect(new Set(ids).size).toBe(6);
    expect(ids).toHaveLength(6);
    for (const id of ids) expect(html).toContain(`aria-labelledby="${id}"`);
    expect(html.match(/aria-current="page"/g)).toHaveLength(2);
    expect(html.match(new RegExp(`href="${href('faq')}" aria-current="page"`, 'g'))).toHaveLength(
      2,
    );
  });
});
