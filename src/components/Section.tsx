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
  // ページの導入（h1）は既定で濃い帯にする。どのページも同じ開き方にして、
  // ヒーローの世界観を全ページへ通す（明るい導入にしたい章だけ tone="tint" を渡す）。
  const resolved = h1 && tone === 'plain' ? 'dark' : tone;
  const cls = resolved === 'dark' ? 'dark' : resolved === 'tint' ? 'tint' : '';
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
