import { clsx } from 'clsx';
import type { ReactNode } from 'react';
import { NAV_IC } from '@/content/nav';
import { raw } from '@/lib/raw';
import Icon from '@/components/Icon';

interface Props {
  id?: string;
  className?: string;
  eyebrow?: string;
  heading?: string;
  lede?: string;
  tone?: 'plain' | 'tint' | 'dark';
  wide?: boolean;
  navKey?: string;
  h1?: boolean;
  /** Long-form pages keep their section heading beside the reading column. */
  reading?: boolean;
  children?: ReactNode;
}

export default function Section({
  id,
  className,
  eyebrow,
  heading,
  lede,
  tone = 'plain',
  wide = false,
  navKey,
  h1 = false,
  reading = false,
  children,
}: Props) {
  const cls = tone === 'dark' ? 'dark' : tone === 'tint' ? 'tint' : '';
  const mark = navKey ? NAV_IC[navKey] : undefined;
  return (
    <section
      className={clsx(cls, h1 && 'page-intro', reading && 'reading-section', className)}
      id={id}
    >
      <div className={wide ? 'wrap-w' : 'wrap'}>
        {(eyebrow || heading || lede) && (
          <div className="sh">
            {eyebrow && (
              <span className="lab">
                {mark && <Icon name={mark} sm />}
                {eyebrow}
              </span>
            )}
            {heading &&
              (h1 ? (
                <h1 dangerouslySetInnerHTML={raw(heading)} />
              ) : (
                <h2 dangerouslySetInnerHTML={raw(heading)} />
              ))}
            {lede && <p className="lede" dangerouslySetInnerHTML={raw(lede)} />}
          </div>
        )}
        {reading ? <div className="section-body">{children}</div> : children}
      </div>
    </section>
  );
}
