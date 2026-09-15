import type { Messages } from '@/i18n/catalog';
import { LOCALE } from '@/i18n/catalog';
import { format } from '@/i18n/format';
import { japaneseSpacing } from '@/i18n/typography';
import { metricDifference, type Measurement, type Metric } from '@/lib/collections/works';
import { formatDate } from '@/components/collections/EntryDates';

const number = (value: number) =>
  value.toLocaleString(LOCALE.number, { maximumFractionDigits: 2 });

/**
 * Before/after figures with their periods and sources. An unmeasured side reads "not measured",
 * never 0, and no difference is calculated unless both sides were measured.
 */
export default function MetricTable({
  copy,
  metrics,
}: {
  copy: Messages['collections'];
  metrics: readonly Metric[];
}) {
  const works = copy.works;
  const cell = (heading: string, unit: string, measurement: Measurement) => (
    <td data-h={heading}>
      {measurement.status === 'measured' ? (
        <>
          <span className="metric-value tnum">
            {japaneseSpacing(`${number(measurement.value)}${unit}`)}
          </span>
          <span className="metric-note">
            {format(works.period, {
              from: formatDate(copy, measurement.from),
              to: formatDate(copy, measurement.to),
            })}
          </span>
          <span className="metric-note">{format(works.source, { source: measurement.source })}</span>
        </>
      ) : (
        <>
          <span className="metric-value">{works.notMeasured}</span>
          {measurement.note && <span className="metric-note">{measurement.note}</span>}
        </>
      )}
    </td>
  );
  return (
    <div className="tblwrap stack">
      <div className="tbl">
        <table className="metric-table">
          <thead>
            <tr>
              <th scope="col">{works.metric}</th>
              <th scope="col">{works.before}</th>
              <th scope="col">{works.after}</th>
              <th scope="col">{works.difference}</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((metric, index) => {
              const { label, unit } = works.kinds[metric.kind];
              const difference = metricDifference(metric);
              const sign = difference === null ? '' : difference > 0 ? '+' : difference < 0 ? '−' : '±';
              return (
                <tr key={index}>
                  <th scope="row">
                    <span className="metric-value">{label}</span>
                    {metric.note && <span className="metric-note">{metric.note}</span>}
                  </th>
                  {cell(works.before, unit, metric.before)}
                  {cell(works.after, unit, metric.after)}
                  <td data-h={works.difference}>
                    <span className={difference === null ? 'metric-note' : 'metric-value tnum'}>
                      {difference === null
                        ? works.noDifference
                        : japaneseSpacing(`${sign}${number(Math.abs(difference))}${unit}`)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
