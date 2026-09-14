import Acc from '@/components/Acc';
import { resolveFaqEntries, type FaqEntry } from '@/content/faq';

export default function FaqList({ entries }: { entries: readonly FaqEntry[] }) {
  return resolveFaqEntries(entries).map((entry) => (
    <Acc id={`faq-${entry.id}`} summary={entry.question} html={entry.answer} key={entry.id} />
  ));
}
