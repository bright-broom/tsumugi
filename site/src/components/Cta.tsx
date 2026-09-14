import { href } from '@/routing/registry';
import PhoneLink from '@/components/PhoneLink';
import { useMessages } from '@/components/ContentProvider';

interface Props {
  primary?: string;
  where?: string;
}

export default function Cta({ primary, where = href('contact') }: Props) {
  const copy = useMessages('cta');
  return (
    <div className="btns">
      <PhoneLink className="btn btn-1" />
      <a className="btn btn-2" href={where}>
        {primary ?? copy.cta}
      </a>
    </div>
  );
}
