/**
 * DataTable — Shared sortable data table with progress bars.
 * Preserved from original AdBrief design.
 */
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown, ChevronsUpDown, ChevronUp } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/shared/ui/table';

export interface DataColumn<T> {
  key: string;
  label: ReactNode;
  align?: 'left' | 'right' | 'center';
  /** Raw value used for sorting. */
  value: (row: T) => string | number;
  /** Custom cell render; falls back to the raw value. */
  render?: (row: T) => ReactNode;
  /** Render the numeric cell with a thin %Approved-style underline bar (0..1). */
  progressOf?: (row: T) => number | undefined;
  /** Minimum column width (CSS value, e.g. "200px"). */
  minWidth?: string;
}

export interface DataTableProps<T> {
  columns: DataColumn<T>[];
  rows: T[];
  /** Footer cells aligned to columns; render bold with a top border. */
  footer?: ReactNode[];
  sortable?: boolean;
  /** When set, the body scrolls and the header sticks. */
  maxHeight?: number;
  rowKey: (row: T, index: number) => string | number;
  /** Additional className applied to every data cell. */
  cellClassName?: string;
  /** Additional className for the root scroll container (e.g. "min-h-0 flex-1" for flex-fill). */
  className?: string;
}

/**
 * Shared sortable data table: gray header row, zebra hover, right-aligned
 * tabular numerics, optional bold "Total" footer row, client-side sorting.
 */
export default function DataTable<T>({
  columns,
  rows,
  footer,
  sortable = true,
  maxHeight,
  rowKey,
  cellClassName,
  className,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return rows;
    const dir = sortDir === 'asc' ? 1 : -1;
    return rows.slice().sort((a, b) => {
      const va = col.value(a);
      const vb = col.value(b);
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }, [rows, columns, sortKey, sortDir]);

  const toggleSort = (key: string) => {
    if (!sortable) return;
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  return (
    <div className={cn('overflow-auto rounded-lg border border-[#E5E8EC]', className)} style={maxHeight ? { maxHeight } : undefined}>
      <Table>
        <TableHeader className="sticky top-0 z-10">
          <TableRow className="bg-[#F1F3F5] hover:bg-[#F1F3F5]">
            {columns.map((c) => (
              <TableHead
                key={c.key}
                onClick={() => toggleSort(c.key)}
                style={c.minWidth ? { minWidth: c.minWidth } : undefined}
                className={cn(
                  'h-9 whitespace-nowrap px-3 text-[10.5px] font-bold uppercase tracking-wide text-[#4B5563]',
                  c.align === 'right' && 'text-right',
                  c.align === 'center' && 'text-center',
                  sortable && 'cursor-pointer select-none',
                )}
              >
                <span className="inline-flex items-center gap-1">
                  {c.label}
                  {sortable &&
                    (sortKey === c.key ? (
                      sortDir === 'asc' ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )
                    ) : (
                      <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
                    ))}
                </span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((row, i) => (
            <TableRow key={rowKey(row, i)} className="hover:bg-[#F8FAFB]">
              {columns.map((c) => {
                const progress = c.progressOf?.(row);
                return (
                  <TableCell
                    key={c.key}
                    style={c.minWidth ? { minWidth: c.minWidth } : undefined}
                    className={cn(
                      'px-3 py-2 text-[11px] font-medium text-[#1F2A37]',
                      cellClassName,
                      c.align === 'right' && 'text-right tabular-nums',
                      c.align === 'center' && 'text-center',
                    )}
                  >
                    <span className="relative inline-block pb-1">
                      {c.render ? c.render(row) : String(c.value(row))}
                      {progress !== undefined && (
                        <span className="absolute bottom-0 left-0 h-[3px] w-full rounded bg-[#E5E8EC]">
                          <span
                            className="block h-full rounded bg-[#2563EB] transition-[width] duration-700"
                            style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
                          />
                        </span>
                      )}
                    </span>
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
        {footer && (
          <TableFooter>
            <TableRow className="border-t-2 border-[#E5E8EC] bg-white font-bold hover:bg-white">
              {footer.map((cell, i) => (
                <TableCell
                  key={i}
                  className={cn(
                    'px-3 py-2.5 text-[11px] font-bold text-[#1F2A37]',
                    columns[i]?.align === 'right' && 'text-right tabular-nums',
                    columns[i]?.align === 'center' && 'text-center',
                  )}
                >
                  {cell}
                </TableCell>
              ))}
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </div>
  );
}