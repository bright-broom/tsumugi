import type { IconName } from '../data/icons';
import { ic } from '../lib/ic';
import { raw } from '../lib/raw';

/** 追える計算。金額の行を積み上げて、最後に結論を1行置く */
interface Row { label: string; value?: string; cls?: '' | 'small' | 'sum' | 'net' | 'minus'; sub?: string; icon?: IconName }
interface Props { title: string; rows: Row[] }

export default function Calc({ title, rows }: Props) {
  return (
    <div className="calc">
      <div className="ttl" dangerouslySetInnerHTML={raw(title)} />
      {rows.map((r, i) => (
        <div className={`r ${r.cls ?? ''}`.trim()} key={i}>
          <span className="k"><span dangerouslySetInnerHTML={raw(
            (r.icon ? ic(r.icon) : '') + r.label + (r.sub ? `<em>${r.sub}</em>` : ''),
          )} /></span>
          <span className="v tnum" dangerouslySetInnerHTML={raw(r.value ?? '')} />
        </div>
      ))}
    </div>
  );
}
