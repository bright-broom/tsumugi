import type { AnyPageProps } from '@/content/page-props';
import { ContentProvider } from '@/components/ContentProvider';
import NotFoundPage from '@/views/404';
import AboutPage from '@/views/about';
import ContactPage from '@/views/contact';
import CostCutPage from '@/views/cost-cut';
import FaqPage from '@/views/faq';
import FlowPage from '@/views/flow';
import IndexPage from '@/views/index';
import IndustryPage from '@/views/industry';
import LegalPage from '@/views/legal';
import OwnedPage from '@/views/owned';
import PricePage from '@/views/price';
import CatalogPage from '@/views/catalog';
import PrivacyPage from '@/views/privacy';
import SourcePage from '@/views/source';
import SpecPage from '@/views/spec';
import SubsidyPage from '@/views/subsidy';
import TermsPage from '@/views/terms';
import UnlimitedPage from '@/views/unlimited';
import WorksPage from '@/views/works';
import ArticleListPage from '@/views/collections/article-list';
import ArticlePage from '@/views/collections/article';
import CaseListPage from '@/views/collections/case-list';
import CaseStudyPage from '@/views/collections/case-study';
import AreaListPage from '@/views/collections/area-list';
import AreaPage from '@/views/collections/area';
import WorkPage from '@/views/collections/work';
function renderPage(props: AnyPageProps) {
  switch (props.template) {
    case 'articleList':
      return <ArticleListPage {...props} />;
    case 'article':
      return <ArticlePage {...props} />;
    case 'caseList':
      return <CaseListPage {...props} />;
    case 'caseStudy':
      return <CaseStudyPage {...props} />;
    case 'areaList':
      return <AreaListPage {...props} />;
    case 'area':
      return <AreaPage {...props} />;
    case 'work':
      return <WorkPage {...props} />;
    case 'notFound':
      return <NotFoundPage {...props} />;
    case 'about':
      return <AboutPage {...props} />;
    case 'contact':
      return <ContactPage {...props} />;
    case 'costCut':
      return <CostCutPage {...props} />;
    case 'faq':
      return <FaqPage {...props} />;
    case 'flow':
      return <FlowPage {...props} />;
    case 'home':
      return <IndexPage {...props} />;
    case 'industry':
      return <IndustryPage {...props} />;
    case 'legal':
      return <LegalPage {...props} />;
    case 'owned':
      return <OwnedPage {...props} />;
    case 'price':
      return <PricePage {...props} />;
    case 'catalog':
      return <CatalogPage {...props} />;
    case 'privacy':
      return <PrivacyPage {...props} />;
    case 'source':
      return <SourcePage {...props} />;
    case 'spec':
      return <SpecPage {...props} />;
    case 'subsidy':
      return <SubsidyPage {...props} />;
    case 'terms':
      return <TermsPage {...props} />;
    case 'unlimited':
      return <UnlimitedPage {...props} />;
    case 'works':
      return <WorksPage {...props} />;
    default: {
      const exhaustive: never = props;
      throw new Error(`Unknown template: ${exhaustive}`);
    }
  }
}
export default function Page(props: AnyPageProps) {
  return <ContentProvider messages={props.messages}>{renderPage(props)}</ContentProvider>;
}
