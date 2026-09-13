import * as C from '../data/config';
import Icon from './Icon';

interface Props { primary?: string; where?: string }

export default function Cta({ primary = 'まず話を聞いてみる', where = 'contact.html' }: Props) {
  return (
    <div className="btns">
      <a className="btn btn-1" href={`tel:${C.TEL_LINK}`}><Icon name="phone" />{`電話する　${C.TEL}`}</a>
      <a className="btn btn-2" href={where}>{primary}</a>
    </div>
  );
}
