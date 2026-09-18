import articles from '@/i18n/locales/ja/entries/articles';
import areas from '@/i18n/locales/ja/entries/areas';
import cases from '@/i18n/locales/ja/entries/cases';
import cms from '@/i18n/locales/ja/entries/cms.json';
import works from '@/i18n/locales/ja/entries/works';

/**
 * Collection documents for this locale. Validated and published by content/collections.ts.
 * cms.json is the snapshot written by `npm run cms:pull` (ADR 0080). While a collection there is
 * null, the entries in this directory are used; the case taxonomy always stays in this repository.
 */
const entries = {
  articles: cms.articles ? { entries: cms.articles } : articles,
  cases: cms.cases ? { taxonomy: cases.taxonomy, entries: cms.cases } : cases,
  areas,
  works,
};
export default entries;
