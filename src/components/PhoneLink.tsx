import { clsx } from 'clsx';
import * as C from '@/content/config';
import Icon from '@/components/Icon';

/** One phone presentation for the header, footer, fixed bar and page CTAs. */
export default function PhoneLink({ className }: { className?: string }) {
  return (
    <a className={clsx(className, 'phone-link')} href={`tel:${C.TEL_LINK}`}>
      <Icon name="phone" />
      <span className="num">{C.TEL}</span>
    </a>
  );
}
