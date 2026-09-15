import ContactActionLink from '@/components/ContactAction';
import { CONTACT_ACTIONS } from '@/content/contact-actions';
import type { ContactAction } from '@/lib/storefront/contact-actions';

/**
 * primary は問い合わせの導線に付けるページ固有のラベル。
 * where で別のページへ送るときは、その行き先を表すラベル（primary）も必ず渡す。
 */
type Props = ({ primary?: string; where?: undefined } | { primary: string; where: string }) & {
  /** 業種別などで優先順を変えるとき。既定は content/contact-actions.ts */
  actions?: readonly ContactAction[];
};

export default function Cta({ primary, where, actions = CONTACT_ACTIONS.buttons }: Props) {
  const [first, second] = actions;
  return (
    <div className="btns">
      {first && (
        <ContactActionLink
          action={first}
          surface="button"
          className="btn btn-1"
          contactLabel={where === undefined ? primary : undefined}
        />
      )}
      {where !== undefined ? (
        <a className="btn btn-2" href={where}>
          {primary}
        </a>
      ) : (
        second && (
          <ContactActionLink
            action={second}
            surface="button"
            className="btn btn-2"
            contactLabel={primary}
          />
        )
      )}
    </div>
  );
}
