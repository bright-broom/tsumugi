import Figure from '@/components/Figure';
import { useMessages } from '@/components/ContentProvider';
import { format } from '@/i18n/format';
import {
  cap,
  DiagramNode,
  DiagramIcon,
  arrow,
  vdown,
  c,
  NW,
  type DiagramCopy,
} from '@/components/diagrams/primitives';

function FlowRow({
  copy,
  portal,
  fee,
  run,
  own,
  narrow = false,
}: {
  copy: DiagramCopy;
  portal: number;
  fee: number;
  run: number;
  own: boolean;
  narrow?: boolean;
}) {
  const cost = format(own ? copy.rentVsOwnNarrowLabel10 : copy.rentVsOwnNarrowLabel3, {
    run: c(run),
    portal: c(portal),
  });
  const costLines = [
    own ? copy.moneyFlowNarrowLabel5 : copy.listingFee,
    format(copy.monthlyAmount, { amount: c(own ? run : portal) }),
  ] as const;
  const booking = own ? copy.rentVsOwnNarrowLabel13 : format(copy.rentVsOwnNarrowLabel6, { fee });
  const result = own
    ? narrow
      ? copy.rentVsOwnNarrowLabel14
      : copy.rentVsOwnLabel2
    : copy.rentVsOwnNarrowLabel7;
  return (
    <>
      {cap(0, 18, own ? copy.rentVsOwnNarrowLabel9 : copy.rentVsOwnNarrowLabel1, 14)}
      {narrow ? (
        <>
          <DiagramNode y={34} h={70} title={copy.rentVsOwnNarrowLabel2} icon="users" />
          {vdown(112, 146, cost, own, 34)}
          <DiagramNode
            y={154}
            title={own ? copy.rentVsOwnNarrowLabel11 : copy.rentVsOwnNarrowLabel4}
            sub={own ? copy.rentVsOwnNarrowLabel12 : copy.rentVsOwnNarrowLabel5}
            icon={own ? 'globe' : 'building-2'}
            accent={own}
          />
          {vdown(242, 276, booking, own, 34)}
          <DiagramNode y={284} h={70} title={copy.rentVsOwnNarrowLabel8} icon="map-pin" />
          <DiagramIcon name={own ? 'key' : 'circle-x'} x={0} y={374} size={20} accent={own} />
          <text x={30} y={389}>
            {own ? copy.rentVsOwnNarrowLabel12 : result}
          </text>
          {own && (
            <text x={0} y={415}>
              {result}
            </text>
          )}
        </>
      ) : (
        <>
          <DiagramNode
            x={0}
            y={36}
            w={124}
            h={108}
            title={copy.rentVsOwnNarrowLabel2}
            sub={copy.rentVsOwnLabel1}
            icon="users"
            stacked
          />
          {arrow(132, 92, 246, costLines, own)}
          <DiagramNode
            x={254}
            y={36}
            w={212}
            h={108}
            title={own ? copy.rentVsOwnNarrowLabel11 : copy.rentVsOwnNarrowLabel4}
            sub={own ? copy.rentVsOwnNarrowLabel12 : copy.rentVsOwnNarrowLabel5}
            icon={own ? 'globe' : 'building-2'}
            accent={own}
            stacked
          />
          {arrow(474, 92, 588, booking, own)}
          <DiagramNode
            x={596}
            y={36}
            w={124}
            h={108}
            title={copy.rentVsOwnNarrowLabel8}
            icon="map-pin"
            stacked
          />
          <DiagramIcon name={own ? 'key' : 'circle-x'} x={16} y={164} size={20} accent={own} />
          <text x={46} y={179}>
            {result}
          </text>
        </>
      )}
    </>
  );
}
export function RentVsOwn({ portal, fee, run }: { portal: number; fee: number; run: number }) {
  const copy = useMessages('diagrams');
  const props = { copy, portal, fee, run };
  return (
    <Figure
      icons={['users', 'building-2', 'globe', 'map-pin', 'key', 'circle-x']}
      arrows={['neutral', 'accent']}
      wide={
        <>
          <FlowRow {...props} own={false} />
          <g transform="translate(0 224)">
            <FlowRow {...props} own />
          </g>
        </>
      }
      narrow={[
        <>
          <FlowRow {...props} own={false} narrow />
          <g transform="translate(0 438)">
            <FlowRow {...props} own narrow />
          </g>
        </>,
        `0 0 ${NW} 864`,
      ]}
      caption={copy.rentVsOwn + copy.rentVsOwn2}
      label={
        format(copy.rentVsOwn3, { portal: c(portal) }) +
        format(copy.rentVsOwn4, { fee }) +
        format(copy.rentVsOwn5, { run: c(run) }) +
        copy.rentVsOwn6
      }
      viewBox="0 0 722 414"
    />
  );
}
