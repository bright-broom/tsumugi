import Icon from '@/components/Icon';
import PhoneLink from '@/components/PhoneLink';
import { useMessages } from '@/components/ContentProvider';
import type { IconName } from '@/lib/icons';
import type { ContactAction, ContactChannel } from '@/lib/storefront/contact-actions';

const BAR_ICONS: Record<Exclude<ContactChannel, 'phone'>, IconName> = {
  contact: 'message-circle',
  line: 'message-circle',
  booking: 'calendar-days',
};

interface Props {
  action: ContactAction;
  /** button はページ内の CTA、bar はスマートフォンの固定バー */
  surface: 'button' | 'bar';
  className?: string;
  /** 問い合わせの導線にだけ使うページ固有のラベル */
  contactLabel?: string;
}

/**
 * 連絡導線1つ（ADR 0057）。ラベルは action.channel だけから選ぶので、表示と行き先が食い違わない。
 * 電話は PhoneLink に任せ、表示番号と発信先を1つの値から作る。
 */
export default function ContactActionLink({ action, surface, className, contactLabel }: Props) {
  const cta = useMessages('cta');
  const shell = useMessages('shell');
  if (action.channel === 'phone') return <PhoneLink className={className} />;
  const labels =
    surface === 'bar'
      ? { contact: shell.a3, line: shell.a2, booking: cta.bookingShort }
      : { contact: contactLabel ?? cta.cta, line: cta.line, booking: cta.booking };
  return (
    <a className={className} href={action.href}>
      {surface === 'bar' && <Icon name={BAR_ICONS[action.channel]} />}
      {labels[action.channel]}
    </a>
  );
}
