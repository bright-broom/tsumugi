import Figure from '@/components/Figure';
import { useMessages } from '@/components/ContentProvider';
import { format } from '@/i18n/format';
import type { IconName } from '@/lib/icons';
import {
  cap,
  DiagramNode,
  DiagramIcon,
  ArrowLine,
  NW,
  type DiagramCopy,
} from '@/components/diagrams/primitives';

const short = (d: string) => {
  const m = /(\d+)\s*月\s*(\d+)\s*日/.exec(d);
  return m ? `${m[1]}/${m[2]}` : d;
};
function Timeline({
  copy,
  form4,
  deadline,
  narrow = false,
}: {
  copy: DiagramCopy;
  form4: string;
  deadline: string;
  narrow?: boolean;
}) {
  const steps: { title: string; sub: string; icon: IconName }[] = [
    { title: copy.steps, sub: format(copy.steps2, { shortForm4: short(form4) }), icon: 'landmark' },
    {
      title: copy.steps3,
      sub: format(copy.steps4, { shortDeadline: short(deadline) }),
      icon: 'file-text',
    },
    { title: copy.steps5, sub: copy.steps6, icon: 'clock' },
    { title: copy.steps7, sub: copy.steps8, icon: 'handshake' },
    { title: copy.steps9, sub: copy.steps10, icon: 'hand-coins' },
  ];
  return (
    <>
      {narrow && cap(0, 18, copy.subsidyTimelineNarrowLabel1, 14)}
      {steps.map((step, i) => {
        const x = narrow ? 0 : i * 158;
        const y = narrow ? 40 + i * 104 + (i >= 3 ? 84 : 0) : 86;
        const w = narrow ? NW : 140;
        const h = narrow ? 80 : 110;
        return (
          <g key={step.icon}>
            <DiagramNode {...step} x={x} y={y} w={w} h={h} accent={i >= 3} stacked={!narrow} />
            {i < 4 && i !== 2 && (
              <ArrowLine
                x1={narrow ? 34 : x + w + 3}
                y1={narrow ? y + h + 4 : y + h / 2}
                x2={narrow ? 34 : x + 154}
                y2={narrow ? y + 100 : y + h / 2}
                stroke="currentColor"
                strokeWidth="1.4"
                marker="neutral"
              />
            )}
          </g>
        );
      })}
      <DiagramIcon name="triangle-alert" x={narrow ? 0 : 16} y={narrow ? 346 : 15} size={22} />
      <text
        x={narrow ? 32 : 48}
        y={narrow ? 362 : 31}

        fontWeight="700"
      >
        {copy.subsidyTimeline}
      </text>
      <text
        x={narrow ? 32 : 48}
        y={narrow ? 384 : 53}

        fontWeight="700"
      >
        {copy.subsidyTimeline2}
      </text>
      <line
        x1={narrow ? 0 : 465}
        y1={narrow ? 400 : 16}
        x2={narrow ? NW : 465}
        y2={narrow ? 400 : 210}
        stroke="currentColor"
        strokeOpacity=".4"
        strokeWidth="1"
        strokeDasharray="4 5"
      />
      <DiagramIcon
        name="calendar-days"
        x={narrow ? 0 : 482}
        y={narrow ? 636 : 222}
        size={20}
        accent
      />
      <text x={narrow ? 30 : 512} y={narrow ? 651 : 237} fontSize={narrow ? 14 : 12}>
        {narrow ? copy.subsidyTimelineNarrow2 : copy.subsidyTimeline3}
      </text>
    </>
  );
}
export function SubsidyTimeline({ form4, deadline }: { form4: string; deadline: string }) {
  const copy = useMessages('diagrams');
  const props = { copy, form4, deadline };
  return (
    <Figure
      icons={[
        'landmark',
        'file-text',
        'clock',
        'handshake',
        'hand-coins',
        'triangle-alert',
        'calendar-days',
      ]}
      arrows={['neutral']}
      wide={<Timeline {...props} />}
      narrow={[<Timeline key="narrow" {...props} narrow />, `0 0 ${NW} 666`]}
      caption={format(copy.subsidyTimeline4, { form4, deadline })}
      label={format(copy.subsidyTimeline5, { form4, deadline })}
      viewBox="0 0 776 252"
    />
  );
}
