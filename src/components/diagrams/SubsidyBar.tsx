import Figure from '@/components/Figure';
import { useMessages } from '@/components/ContentProvider';
import { format } from '@/i18n/format';
import { rnd } from '@/lib/round';
import {
  cap,
  BOX_F,
  BOX_S,
  DIM,
  ArrowLine,
  NW,
  c,
  type Narrow,
  type DiagramCopy,
} from '@/components/diagrams/primitives';

function subsidyBarNarrow(
  copy: DiagramCopy,
  total: number,
  web: number,
  pr: number,
  grant: number,
  net: number,
): Narrow {
  const ww = rnd((NW * web) / total);
  const gw = rnd((NW * grant) / total);
  const s = (
    <>
      {cap(0, 12, format(copy.subsidyBarNarrowLabel1, { total: c(total) }))}
      <rect x="0" y="22" width={ww - 4} height="52" rx="7" {...BOX_F} {...BOX_S} />
      <text
        x={ww / 2 - 2}
        y="44"
        textAnchor="middle"
        fontSize="12"
        fontWeight="700"
        fill="currentColor"
      >
        {copy.subsidyBarNarrowLabel2}
      </text>
      <text x={ww / 2 - 2} y="62" textAnchor="middle" fontSize="12.5" {...DIM}>
        {format(copy.subsidyBarNarrowLabel3, { web: c(web) })}
      </text>
      <rect x={ww} y="22" width={NW - ww} height="52" rx="7" {...BOX_F} {...BOX_S} />
      <text
        x={ww + (NW - ww) / 2}
        y="44"
        textAnchor="middle"
        fontSize="12"
        fontWeight="700"
        fill="currentColor"
      >
        {copy.subsidyBarNarrowLabel4}
      </text>
      <text x={ww + (NW - ww) / 2} y="62" textAnchor="middle" fontSize="12.5" {...DIM}>
        {format(copy.subsidyBarNarrowLabel5, { pr: c(pr) })}
      </text>
      <ArrowLine
        x1={NW / 2}
        y1="82"
        x2={NW / 2}
        y2="106"
        stroke="currentColor"
        strokeWidth="1.6"
        marker="neutral"
      />
      {cap(0, 132, copy.subsidyBarNarrowLabel6)}
      <rect
        x="0"
        y="142"
        width={gw - 4}
        height="52"
        rx="7"
        fill="var(--fig-ok)"
        fillOpacity=".11"
        stroke="var(--fig-ok)"
        strokeWidth="1.6"
      />
      <text
        x={gw / 2 - 2}
        y="164"
        textAnchor="middle"
        fontSize="12"
        fontWeight="700"
        fill="var(--fig-ok)"
      >
        {copy.subsidyBarNarrowLabel7}
      </text>
      <text x={gw / 2 - 2} y="182" textAnchor="middle" fontSize="12.5" fill="var(--fig-ok)">
        {format(copy.subsidyBarNarrowLabel8, { grant: c(grant) })}
      </text>
      <rect x={gw} y="142" width={NW - gw} height="52" rx="7" {...BOX_F} {...BOX_S} />
      <text
        x={gw + (NW - gw) / 2}
        y="164"
        textAnchor="middle"
        fontSize="12"
        fontWeight="700"
        fill="currentColor"
      >
        {copy.subsidyBarNarrowLabel9}
      </text>
      <text
        x={gw + (NW - gw) / 2}
        y="182"
        textAnchor="middle"
        fontSize="12.5"
        fontWeight="700"
        fill="currentColor"
      >
        {format(copy.subsidyBarNarrowLabel10, { net: c(net) })}
      </text>
    </>
  );
  return [s, `0 0 ${NW} 204`];
}

export function SubsidyBar({
  total,
  web,
  pr,
  grant,
  net,
}: {
  total: number;
  web: number;
  pr: number;
  grant: number;
  net: number;
}) {
  const copy = useMessages('diagrams');
  const w = 700;
  const ww = rnd((w * web) / total);
  const gw = rnd((w * grant) / total);
  const s = (
    <>
      {cap(0, 14, format(copy.subsidyBarNarrowLabel1, { total: c(total) }))}
      <rect x="0" y="26" width={ww - 5} height="52" rx="7" {...BOX_F} {...BOX_S} />
      <text
        x={ww / 2 - 2}
        y="50"
        textAnchor="middle"
        fontSize="13"
        fontWeight="700"
        fill="currentColor"
      >
        {copy.subsidyBarNarrowLabel2}
      </text>
      <text x={ww / 2 - 2} y="68" textAnchor="middle" fontSize="12" {...DIM}>
        {format(copy.subsidyBarLabel1, { web: c(web) })}
      </text>
      <rect x={ww} y="26" width={w - ww} height="52" rx="7" {...BOX_F} {...BOX_S} />
      <text
        x={ww + (w - ww) / 2}
        y="50"
        textAnchor="middle"
        fontSize="13"
        fontWeight="700"
        fill="currentColor"
      >
        {copy.subsidyBarLabel2}
      </text>
      <text x={ww + (w - ww) / 2} y="68" textAnchor="middle" fontSize="12" {...DIM}>
        {format(copy.subsidyBarLabel3, { pr: c(pr) })}
      </text>
      <ArrowLine
        x1={w / 2}
        y1="86"
        x2={w / 2}
        y2="110"
        stroke="currentColor"
        strokeWidth="1.6"
        marker="neutral"
      />
      {cap(0, 136, copy.subsidyBarNarrowLabel6)}
      <rect
        x="0"
        y="148"
        width={gw - 5}
        height="52"
        rx="7"
        fill="var(--fig-ok)"
        fillOpacity=".11"
        stroke="var(--fig-ok)"
        strokeWidth="1.6"
      />
      <text
        x={gw / 2 - 2}
        y="172"
        textAnchor="middle"
        fontSize="13"
        fontWeight="700"
        fill="var(--fig-ok)"
      >
        {copy.subsidyBarNarrowLabel7}
      </text>
      <text x={gw / 2 - 2} y="190" textAnchor="middle" fontSize="12" fill="var(--fig-ok)">
        {format(copy.subsidyBarLabel4, { grant: c(grant) })}
      </text>
      <rect x={gw} y="148" width={w - gw} height="52" rx="7" {...BOX_F} {...BOX_S} />
      <text
        x={gw + (w - gw) / 2}
        y="172"
        textAnchor="middle"
        fontSize="13"
        fontWeight="700"
        fill="currentColor"
      >
        {copy.subsidyBarNarrowLabel9}
      </text>
      <text
        x={gw + (w - gw) / 2}
        y="190"
        textAnchor="middle"
        fontSize="12"
        fontWeight="700"
        fill="currentColor"
      >
        {format(copy.subsidyBarLabel5, { net: c(net) })}
      </text>
    </>
  );
  return (
    <Figure
      arrows={['neutral']}
      wide={s}
      caption={format(copy.subsidyBar, { total: c(total), net: c(net) })}
      label={format(copy.subsidyBar2, {
        total: c(total),
        web: c(web),
        pr: c(pr),
        grant: c(grant),
        net: c(net),
      })}
      viewBox="0 0 700 208"
      narrow={subsidyBarNarrow(copy, total, web, pr, grant, net)}
    />
  );
}
