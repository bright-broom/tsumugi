import type { ReactNode } from 'react';
import { raw } from '@/lib/raw';

/**
 * 詳しい説明は畳んでおく。details なので JavaScript は要らない。
 * 中身が HTML 文字列のとき（FAQ など）は children ではなく html で渡す。
 */
interface Props {
  id?: string;
  summary: string;
  html?: string;
  children?: ReactNode;
}

export default function Acc({ id, summary, html, children }: Props) {
  return (
    <details className="acc" id={id}>
      <summary>
        <span dangerouslySetInnerHTML={raw(summary)} />
      </summary>
      {html !== undefined ? (
        <div className="bd" dangerouslySetInnerHTML={raw(html)} />
      ) : (
        <div className="bd">{children}</div>
      )}
    </details>
  );
}
