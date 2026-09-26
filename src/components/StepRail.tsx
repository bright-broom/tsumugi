import type { IconName } from '@/lib/icons';
import { raw } from '@/lib/raw';
import Icon from '@/components/Icon';

/** 短い手順を横一列の図で見せる。文章で順番を説明する代わりに使う。390px では縦に並ぶ */
interface Props {
  label: string;
  steps: readonly { title: string; who?: string; icon: IconName }[];
}

export default function StepRail({ label, steps }: Props) {
  return (
    <ol className="step-rail" aria-label={label}>
      {steps.map((s, i) => (
        <li key={s.title}>
          <span className="step-rail-mark">
            <Icon name={s.icon} />
            <span className="step-rail-num tnum">{String(i + 1)}</span>
          </span>
          <b dangerouslySetInnerHTML={raw(s.title)} />
          {s.who && <span className="step-rail-who">{s.who}</span>}
        </li>
      ))}
    </ol>
  );
}
