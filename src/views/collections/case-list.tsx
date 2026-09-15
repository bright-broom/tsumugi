import * as C from '@/content/config';
import type { CollectionPageProps } from '@/content/page-props';
import { format } from '@/i18n/format';
import Base from '@/layouts/Base';
import Section from '@/components/Section';
import Cta from '@/components/Cta';
import CaseFilter from '@/components/collections/CaseFilter';

export default function CaseListPage({ file, og, copy, data }: CollectionPageProps<'caseList'>) {
  const text = copy.cases;
  return (
    <Base
      file={file}
      og={og}
      title={format(copy.titleFormat, { title: text.title, brand: C.BRAND_T })}
      desc={text.description}
    >
      <Section
        eyebrow={text.eyebrow}
        heading={text.heading}
        h1
        lede={data.facets.length ? text.lede : undefined}
      />
      <Section>
        <CaseFilter
          copy={text}
          entries={data.entries}
          facets={data.facets}
          taxonomy={data.taxonomy}
        />
        <Cta primary={text.contact} />
      </Section>
    </Base>
  );
}
