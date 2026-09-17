import { clsx } from 'clsx';
import { ActionLink, type ActionAppearance } from '@/components/Action';
import * as C from '@/content/config';
import Icon from '@/components/Icon';

/** One phone presentation for the header, footer, fixed bar and page CTAs. */
export default function PhoneLink({ className, variant }: ActionAppearance) {
  const content = (
    <>
      <Icon name="phone" />
      <span className="num">{C.TEL}</span>
    </>
  );
  if (variant)
    return (
      <ActionLink
        variant={variant}
        className={clsx(className, 'phone-link')}
        href={`tel:${C.TEL_LINK}`}
      >
        {content}
      </ActionLink>
    );
  return (
    <a className={clsx(className, 'phone-link')} href={`tel:${C.TEL_LINK}`}>
      {content}
    </a>
  );
}
