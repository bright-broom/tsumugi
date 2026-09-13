import type { IconName } from '../data/icons';
import Icon from './Icon';

interface Props { items: { icon: IconName; value: string | number; unit?: string; label: string }[] }

export default function Stats({ items }: Props) {
  return (
    <div className="stats">{items.map((s) => (
      <div className="stat" key={s.label}><Icon name={s.icon} sm />
        <div className="v tnum">{`${s.value}${s.unit ?? ''}`}</div>
        <div className="k">{s.label}</div></div>
    ))}</div>
  );
}
