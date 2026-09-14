import type { CSSProperties } from 'react';
import { useMessages } from '@/components/ContentProvider';
import { raw } from '@/lib/raw';

/**
 * 比較表。2〜3列で1列目が行見出しなら、狭い画面では横に引かず縦に開く（.stack）。
 * data-h は、縦に開いたときに各セルの頭へ出す列名。
 * 見出しが # で始まる列は数値列（右寄せ・縦に開かない）。
 */
interface Props {
  headers: string[];
  rows: (string[] | string)[];
  caption?: string;
  foot?: string;
  minw?: number;
}

const bare = (s: string) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/^#/, '')
    .trim();

export default function Table({ headers, rows, caption, foot, minw }: Props) {
  const copy = useMessages('table');
  const showHead = headers.some((h) => h.trim() !== '');
  const stack = headers.length >= 2 && headers.length <= 3 && !headers[0]!.startsWith('#');
  const notes = [foot, caption].filter((n): n is string => Boolean(n));
  return (
    <div className={`tblwrap${stack ? ' stack' : ''}`}>
      <div className="tbl">
        <table
          className={minw ? 'table-sized' : undefined}
          style={minw ? ({ '--table-min-width': `${minw}px` } as CSSProperties) : undefined}
        >
          {showHead && (
            <thead>
              <tr>
                {headers.map((h, i) => (
                  <th
                    scope="col"
                    key={i}
                    className={h.startsWith('#') ? 'n' : undefined}
                    dangerouslySetInnerHTML={raw(h.replace(/^#/, ''))}
                  />
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {rows.map((r, ri) =>
              typeof r === 'string' ? (
                <tr key={ri}>
                  <td className="grp" colSpan={headers.length} dangerouslySetInnerHTML={raw(r)} />
                </tr>
              ) : (
                <tr key={ri}>
                  {r.map((c, i) => {
                    const num = headers[i]!.startsWith('#');
                    const lab = bare(headers[i]!);
                    return i === 0 && !num ? (
                      <th scope="row" key={i} dangerouslySetInnerHTML={raw(c)} />
                    ) : (
                      <td
                        key={i}
                        className={num ? 'n' : undefined}
                        data-h={lab || undefined}
                        dangerouslySetInnerHTML={raw(c)}
                      />
                    );
                  })}
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
      {!stack && (
        <p className="tbl-hint" aria-hidden="true">
          {copy.tblHint}
        </p>
      )}
      {notes.map((n, i) => (
        <p className="tbl-note" key={i} dangerouslySetInnerHTML={raw(n)} />
      ))}
    </div>
  );
}
