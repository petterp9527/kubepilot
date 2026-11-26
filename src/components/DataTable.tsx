import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '../lib/utils'
import { EmptyState } from './ui'

export interface Column<T> {
  key: string
  header: ReactNode
  render: (row: T) => ReactNode
  sortValue?: (row: T) => string | number
  width?: string
  align?: 'left' | 'right' | 'center'
  mono?: boolean
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  renderActions,
  emptyTitle = '没有匹配的资源',
  emptyDesc = '试试调整搜索条件或切换命名空间',
  emptyIcon,
  rowClassName,
}: {
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  renderActions?: (row: T) => ReactNode
  emptyTitle?: string
  emptyDesc?: string
  emptyIcon?: ReactNode
  rowClassName?: (row: T) => string
}) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null)

  const sorted = useMemo(() => {
    if (!sort) return rows
    const col = columns.find((c) => c.key === sort.key)
    if (!col?.sortValue) return rows
    const copy = [...rows]
    copy.sort((a, b) => {
      const va = col.sortValue!(a)
      const vb = col.sortValue!(b)
      if (typeof va === 'number' && typeof vb === 'number') return sort.dir === 'asc' ? va - vb : vb - va
      return sort.dir === 'asc'
        ? String(va).localeCompare(String(vb), 'zh-CN')
        : String(vb).localeCompare(String(va), 'zh-CN')
    })
    return copy
  }, [rows, sort, columns])

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-left">
        <thead>
          <tr className="border-b border-line bg-slate-50/70">
            {columns.map((c) => {
              const active = sort?.key === c.key
              return (
                <th
                  key={c.key}
                  style={c.width ? { width: c.width } : undefined}
                  className={cn(
                    'h-9 whitespace-nowrap px-3 text-[11px] font-medium text-muted first:pl-4 last:pr-4',
                    c.align === 'right' && 'text-right',
                    c.align === 'center' && 'text-center',
                  )}
                >
                  {c.sortValue ? (
                    <button
                      type="button"
                      onClick={() =>
                        setSort((prev) =>
                          prev?.key === c.key
                            ? { key: c.key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
                            : { key: c.key, dir: 'asc' },
                        )
                      }
                      className={cn(
                        'inline-flex items-center gap-1 rounded transition-colors hover:text-ink',
                        active && 'text-ink',
                      )}
                    >
                      {c.header}
                      {active ? (
                        sort!.dir === 'asc' ? (
                          <ChevronUp size={11} />
                        ) : (
                          <ChevronDown size={11} />
                        )
                      ) : (
                        <ChevronDown size={11} className="opacity-25" />
                      )}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              )
            })}
            {renderActions && <th className="h-9 w-[140px] px-3 pr-4 text-right text-[11px] font-medium text-muted">操作</th>}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={() => onRowClick?.(row)}
              className={cn(
                'group row-hover border-b border-line-soft last:border-0',
                onRowClick && 'cursor-pointer',
                rowClassName?.(row),
              )}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cn(
                    'h-[46px] whitespace-nowrap px-3 align-middle text-[12.5px] text-ink-soft first:pl-4 last:pr-4',
                    c.align === 'right' && 'text-right',
                    c.align === 'center' && 'text-center',
                    c.mono && 'font-mono text-[12px]',
                  )}
                >
                  {c.render(row)}
                </td>
              ))}
              {renderActions && (
                <td className="h-[46px] px-3 pr-4 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
                    {renderActions(row)}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {sorted.length === 0 && <EmptyState icon={emptyIcon} title={emptyTitle} desc={emptyDesc} />}
    </div>
  )
}
