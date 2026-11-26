import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, Search } from 'lucide-react'
import { cn } from '../lib/utils'

export function PageHeader({
  title,
  desc,
  actions,
  back,
  meta,
}: {
  title: ReactNode
  desc?: ReactNode
  actions?: ReactNode
  back?: { to: string; label: string }
  meta?: ReactNode
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {back && (
          <Link
            to={back.to}
            className="mb-1.5 inline-flex items-center gap-1 text-[11.5px] text-muted transition-colors hover:text-brand"
          >
            <ChevronLeft size={13} />
            {back.label}
          </Link>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-[19px] font-semibold leading-tight tracking-[-0.01em] text-ink">{title}</h1>
          {meta}
        </div>
        {desc && <p className="mt-1 text-[12px] text-muted">{desc}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Toolbar({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn('flex flex-wrap items-center gap-2', className)}>{children}</div>
}

export function SearchInput({
  value,
  onChange,
  placeholder = '按名称搜索',
  className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex h-8 w-[240px] items-center gap-2 rounded-lg border border-line bg-white px-2.5 transition-colors focus-within:border-blue-300 focus-within:shadow-[0_0_0_3px_rgba(191,219,254,.35)]',
        className,
      )}
    >
      <Search size={13} className="shrink-0 text-faint" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-[12.5px] text-ink outline-none placeholder:text-faint"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="shrink-0 rounded text-[11px] text-faint hover:text-ink"
        >
          清除
        </button>
      )}
    </div>
  )
}
