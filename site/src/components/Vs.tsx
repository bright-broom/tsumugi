import { rnd } from '../lib/diagrams';

/** 比較バー。いちばん高い行を100%として横幅を取る */
export interface VsRow { name: string; sub: string; amount: number; ours?: boolean }
interface Props { rows: VsRow[]; max: number }

export default function Vs({ rows, max }: Props) {
  return (
    <div className="vs">{rows.map((r) => {
      const w = Math.max(4, rnd((r.amount / max) * 100));
      return (
        <div className={`row${r.ours ? ' ours' : ''}`} key={r.name}>
          <span className="nm"><span>{r.name}<em>{`　${r.sub}`}</em></span></span>
          <span className="amtv">{`${r.amount.toLocaleString('en-US')}円`}</span>
          <span className="bar"><i style={{ width: `${w}%` }}></i></span>
        </div>
      );
    })}</div>
  );
}
