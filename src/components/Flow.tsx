import { raw } from '@/lib/raw';
import Icon from '@/components/Icon';

/** 手順の縦軸。表にすると4列になり、390pxでは右2列が見えない */
interface Props {
  steps: { title: string; desc: string; who: string; when: string; highlight?: boolean }[];
}

export default function Flow({ steps }: Props) {
  return (
    <ol className="flow">{steps.map((s, i) => (
      <li className={`fl${s.highlight ? ' acc-step' : ''}`} key={i}>
        <span className="num">{i + 1}</span>
        <b dangerouslySetInnerHTML={raw(s.title)} />
        <p className="d" dangerouslySetInnerHTML={raw(s.desc)} />
        <p className="tags">
          <span><Icon name="users" sm />{s.who}</span>
          <span><Icon name="clock" sm />{s.when}</span>
        </p>
      </li>
    ))}</ol>
  );
}
