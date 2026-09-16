import Figure from '@/components/Figure';
import { useMessages } from '@/components/ContentProvider';
import {
  cap,
  DiagramNode,
  ArrowLine,
  DIM,
  NW,
  type DiagramCopy,
} from '@/components/diagrams/primitives';

function Panel({
  copy,
  own,
  narrow = false,
}: {
  copy: DiagramCopy;
  own: boolean;
  narrow?: boolean;
}) {
  return (
    <>
      {cap(0, 18, own ? copy.landVsOwnNarrowLabel5 : copy.landVsOwnNarrowLabel1, 15)}
      <DiagramNode y={36} title={copy.landPanel} sub={copy.landPanel2} icon="code-xml" />
      <DiagramNode
        y={128}
        title={copy.landPanel3}
        sub={own ? copy.landVsOwnNarrowLabel6 : copy.landVsOwnNarrowLabel2}
        icon="globe"
        accent={own}
      />
      <ArrowLine
        x1={34}
        y1={218}
        x2={34}
        y2={252}
        stroke="currentColor"
        strokeWidth="1.5"
        marker="neutral"
      />
      <text x={56} y={240} {...DIM}>
        {copy.landPanel4}
      </text>
      <DiagramNode
        y={264}
        h={88}
        icon={own ? 'key' : 'file-text'}
        accent={own}
        title={
          own ? copy.landVsOwnLabel5 : narrow ? copy.landVsOwnNarrowLabel3 : copy.landVsOwnLabel2
        }
        sub={own ? copy.landVsOwnNarrowLabel8 : copy.landVsOwnNarrowLabel4}
      />
    </>
  );
}

export function LandVsOwn() {
  const copy = useMessages('diagrams');
  return (
    <Figure
      icons={['code-xml', 'globe', 'key', 'file-text']}
      arrows={['neutral']}
      wide={
        <>
          <Panel copy={copy} own={false} />
          <g transform="translate(382 0)">
            <Panel copy={copy} own />
          </g>
        </>
      }
      narrow={[
        <>
          <Panel copy={copy} own={false} narrow />
          <g transform="translate(0 390)">
            <Panel copy={copy} own narrow />
          </g>
        </>,
        `0 0 ${NW} 746`,
      ]}
      caption={copy.landVsOwn}
      label={copy.landVsOwn2 + copy.landVsOwn3 + copy.landVsOwn4 + copy.landVsOwn5}
      viewBox="0 0 722 356"
    />
  );
}
