import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'

import cn from '../../lib/cn'
import { SkeletonRows } from './Skeleton'
import { EmptyState, ErrorState, TableState } from './States'

/**
 * Data table.
 *
 * Columns are declared as objects rather than JSX children so the same
 * definition can drive both the desktop table and the `<md` card list — the
 * responsive requirement (spec §8) is impossible to honour consistently if each
 * screen hand-rolls its own `<td>`s.
 *
 * Column shape:
 *   {
 *     key,                     // unique; also the sort key unless sortKey given
 *     header,                  // column label
 *     render: (row) => node,   // cell content
 *     sortable?: boolean,
 *     align?: 'left'|'right'|'center',
 *     width?: string,          // tailwind width class
 *     hideBelow?: 'sm'|'md'|'lg',   // drop the column on small screens
 *     primary?: boolean,       // used as the title in card mode
 *     className?: string,
 *   }
 *
 * Sorting is controlled: the table renders the indicator and calls `onSort`,
 * but the caller owns the order. Server-side pagination means the table can
 * never sort correctly on its own.
 */

const ALIGN = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
}

export default function Table({
  columns,
  rows,
  rowKey = (row, index) => row.id ?? index,
  onRowClick,
  loading = false,
  error = null,
  onRetry,
  empty,
  sort,
  onSort,
  stickyHeader = true,
  skeletonRows = 6,
  className,
  caption,
}) {
  const visible = columns.filter(Boolean)
  const colSpan = visible.length

  function toggleSort(column) {
    if (!onSort || !column.sortable) return
    const key = column.sortKey ?? column.key
    const direction = sort?.key === key && sort.direction === 'asc' ? 'desc' : 'asc'
    onSort({ key, direction })
  }

  const body = () => {
    if (loading) return <SkeletonRows rows={skeletonRows} columns={colSpan} />

    if (error) {
      return (
        <TableState colSpan={colSpan}>
          <ErrorState message={error} onRetry={onRetry} />
        </TableState>
      )
    }

    if (!rows || rows.length === 0) {
      return (
        <TableState colSpan={colSpan}>
          {empty ?? <EmptyState title="Nothing to show" description="There are no records here yet." />}
        </TableState>
      )
    }

    return rows.map((row, index) => (
      <tr
        key={rowKey(row, index)}
        onClick={onRowClick ? () => onRowClick(row) : undefined}
        onKeyDown={
          onRowClick
            ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onRowClick(row)
                }
              }
            : undefined
        }
        // A clickable row is a real tab stop with a button role, so the detail
        // drawer is reachable without a mouse (spec §9).
        tabIndex={onRowClick ? 0 : undefined}
        role={onRowClick ? 'button' : undefined}
        className={cn(
          'border-b border-neutral-100 last:border-0',
          'transition-colors duration-hover ease-out',
          onRowClick && 'cursor-pointer hover:bg-neutral-50 focus-visible:bg-neutral-50'
        )}
      >
        {visible.map((column) => (
          <td
            key={column.key}
            className={cn(
              'px-4 py-3.5 text-sm text-neutral-700 align-middle',
              ALIGN[column.align] ?? ALIGN.left,
              column.hideBelow === 'sm' && 'hidden sm:table-cell',
              column.hideBelow === 'md' && 'hidden md:table-cell',
              column.hideBelow === 'lg' && 'hidden lg:table-cell',
              column.className
            )}
          >
            {column.render(row)}
          </td>
        ))}
      </tr>
    ))
  }

  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table className="w-full min-w-full border-collapse">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead
          className={cn(
            'bg-neutral-50',
            stickyHeader && 'sticky top-0 z-10'
          )}
        >
          <tr className="border-b border-neutral-200">
            {visible.map((column) => {
              const key = column.sortKey ?? column.key
              const active = sort?.key === key
              const Indicator = !active ? ChevronsUpDown : sort.direction === 'asc' ? ArrowUp : ArrowDown

              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={
                    active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined
                  }
                  className={cn(
                    'whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-neutral-500',
                    ALIGN[column.align] ?? ALIGN.left,
                    column.width,
                    column.hideBelow === 'sm' && 'hidden sm:table-cell',
                    column.hideBelow === 'md' && 'hidden md:table-cell',
                    column.hideBelow === 'lg' && 'hidden lg:table-cell'
                  )}
                >
                  {column.sortable && onSort ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(column)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-sm transition-colors duration-hover',
                        'hover:text-neutral-800',
                        active && 'text-primary-800'
                      )}
                    >
                      {column.header}
                      <Indicator size={13} aria-hidden="true" />
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>{body()}</tbody>
      </table>
    </div>
  )
}

/**
 * The same data as a stacked card list, for `<md` where a table would force a
 * horizontal scroll (spec §8).
 *
 * Uses the `primary` column as the card title and shows the rest as
 * label/value pairs, skipping any column marked `hideBelow`.
 */
export function TableCards({
  columns,
  rows,
  rowKey = (row, index) => row.id ?? index,
  onRowClick,
  loading = false,
  error = null,
  onRetry,
  empty,
  className,
}) {
  if (loading) {
    return (
      <div className={cn('space-y-3', className)} aria-busy="true">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="skeleton h-24 rounded-lg" />
        ))}
      </div>
    )
  }

  if (error) return <ErrorState message={error} onRetry={onRetry} />
  if (!rows || rows.length === 0)
    return empty ?? <EmptyState title="Nothing to show" description="There are no records here yet." />

  const primary = columns.find((column) => column.primary) ?? columns[0]
  const rest = columns.filter((column) => column !== primary && !column.hideBelow)

  return (
    <div className={cn('space-y-3', className)}>
      {rows.map((row, index) => (
        <div
          key={rowKey(row, index)}
          onClick={onRowClick ? () => onRowClick(row) : undefined}
          onKeyDown={
            onRowClick
              ? (event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onRowClick(row)
                  }
                }
              : undefined
          }
          tabIndex={onRowClick ? 0 : undefined}
          role={onRowClick ? 'button' : undefined}
          className={cn(
            'rounded-lg border border-neutral-200 bg-white p-4 shadow-card',
            onRowClick && 'cursor-pointer transition-shadow duration-hover hover:shadow-hover'
          )}
        >
          <div className="mb-3 text-sm font-semibold text-neutral-900">{primary.render(row)}</div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
            {rest.map((column) => (
              <div key={column.key} className="min-w-0">
                <dt className="text-[11px] uppercase tracking-wide text-neutral-400">
                  {column.header}
                </dt>
                <dd className="mt-0.5 truncate text-sm text-neutral-700">{column.render(row)}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  )
}

/**
 * Table on `md` and up, cards below. The default for every admin list, so the
 * responsive behaviour is one import rather than a decision per screen.
 */
export function ResponsiveTable(props) {
  return (
    <>
      <div className="hidden md:block">
        <Table {...props} />
      </div>
      <div className="md:hidden">
        <TableCards {...props} />
      </div>
    </>
  )
}
