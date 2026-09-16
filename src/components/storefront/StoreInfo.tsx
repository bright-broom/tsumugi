import type { ReactNode } from 'react';
import { useMessages } from '@/components/ContentProvider';
import {
  formatAddress,
  formatClosedDays,
  formatException,
  formatParking,
  formatWeeklyHours,
} from '@/i18n/storefront';
import type { IsoDate } from '@/lib/storefront/core';
import { upcomingExceptions, type StoreProfile } from '@/lib/storefront/store';

interface Props {
  store: StoreProfile;
  /** この日以降に終わる臨時の案内だけを出す（content/store.ts の STORE_AS_OF） */
  asOf: IsoDate;
}

/**
 * 来店を受ける拠点の所在地・アクセス・駐車場・地図・営業時間（ADR 0048）。
 * 地図は埋め込まず、地図サービスへのリンクにする。値は JSON-LD と同じ正本から読む。
 */
export default function StoreInfo({ store, asOf }: Props) {
  const copy = useMessages('storefront').store;
  const multiple = store.locations.length > 1;
  return (
    <div className="cards">
      <div className="g">
        {store.locations.map((location) => {
          const { visit } = location;
          if (!visit) return null;
          const exceptions = upcomingExceptions(location, asOf);
          const tel = location.telephone.replace(/[^\d+]/g, '');
          const rows: [label: string, value: ReactNode][] = [
            [copy.address, formatAddress(location.address, copy)],
            [
              copy.telephone,
              <a key="telephone" href={`tel:${tel}`}>
                {location.telephone}
              </a>,
            ],
            [copy.access, visit.access],
            [copy.parking, formatParking(visit.parking, copy)],
            [
              copy.hours,
              formatWeeklyHours(location.hours, copy).map((line, index) => (
                <span key={line}>
                  {index > 0 && <br />}
                  {line}
                </span>
              )),
            ],
            [copy.closedDays, formatClosedDays(location.hours, location.publicHolidays, copy)],
          ];
          if (exceptions.length)
            rows.push([
              copy.exceptions,
              <ul key="exceptions" className="plain">
                {exceptions.map((exception) => (
                  <li key={exception.from}>{formatException(exception, copy)}</li>
                ))}
              </ul>,
            ]);
          rows.push([
            copy.map,
            <a key="map" href={visit.mapUrl}>
              {copy.mapLink}
            </a>,
          ]);
          return (
            <article className="card" id={`store-${location.id}`} key={location.id}>
              {multiple && <h3>{location.name ?? store.name}</h3>}
              <div className="tblwrap stack">
                <div className="tbl">
                  <table>
                    <tbody>
                      {rows.map(([label, value]) => (
                        <tr key={label}>
                          <th scope="row">{label}</th>
                          <td>{value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
