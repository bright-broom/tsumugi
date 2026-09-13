import type { ReactNode } from 'react';
import type { IconName } from '../data/icons';
import { raw } from '../lib/raw';
import Icon from './Icon';

/** アイコンは状態を示すとき（warn / bad）だけ付ける（原則E） */
interface Props { heading: string; kind?: '' | 'good' | 'warn' | 'bad'; children?: ReactNode }

const ICON: Record<string, IconName> = { warn: 'triangle-alert', bad: 'circle-x' };

export default function Note({ heading, kind = '', children }: Props) {
  const icon = ICON[kind];
  return (
    <div className={`alert${kind ? ' ' + kind : ''}`}>
      {icon && <Icon name={icon} />}
      <div className="bd"><span className="h" dangerouslySetInnerHTML={raw(heading)} />{children}</div>
    </div>
  );
}
