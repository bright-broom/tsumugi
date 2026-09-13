import type { ReactNode } from 'react';
import { NAV_IC } from '../data/nav';
import { raw } from '../lib/raw';
import Icon from './Icon';

interface Props {
  eyebrow?: string; heading?: string; lede?: string;
  tone?: 'plain' | 'tint' | 'dark'; wide?: boolean;
  navKey?: string; h1?: boolean;
  children?: ReactNode;
}

export default function Section({
  eyebrow, heading, lede, tone = 'plain', wide = false, navKey, h1 = false, children,
}: Props) {
  const cls = tone === 'dark' ? 'dark' : tone === 'tint' ? 'tint' : '';
  const mark = navKey ? NAV_IC[navKey] : undefined;
  return (
    <section className={cls}><div className={wide ? 'wrap-w' : 'wrap'}>
      {(eyebrow || heading || lede) && (
        <div className="sh">
          {eyebrow && <span className="lab">{mark && <Icon name={mark} sm />}{eyebrow}</span>}
          {heading && (h1
            ? <h1 dangerouslySetInnerHTML={raw(heading)} />
            : <h2 dangerouslySetInnerHTML={raw(heading)} />)}
          {lede && <p className="lede" dangerouslySetInnerHTML={raw(lede)} />}
        </div>
      )}
      {children}
    </div></section>
  );
}
