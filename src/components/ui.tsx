import { useEffect, useState } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Check, Copy, X } from 'lucide-react'
import { cn } from '../lib/utils'
import { useToasts } from '../store'

// ---------------------------------------------------------------- Button
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerSoft'
type Size = 'sm' | 'md'

const VARIANT: Record<Variant, string> = {
  primary:
    'bg-brand text-white border border-brand/20 shadow-[0_1px_2px_rgba(37,99,235,.28)] hover:bg-brand-ink active:bg-brand-ink',
  secondary:
    'bg-white text-ink-soft border border-line hover:bg-slate-50 hover:text-ink active:bg-slate-100',
  ghost: 'text-muted border border-transparent hover:bg-slate-100 hover:text-ink',
  danger: 'bg-danger text-white border border-danger/20 hover:bg-red-700',
  dangerSoft:
    'bg-danger-soft text-danger border border-red-200 hover:bg-red-100',
}

const SIZE: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-[12px] gap-1.5 rounded-md',
  md: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center font-medium whitespace-nowrap transition-colors select-none',
        'focus-ring disabled:cursor-not-allowed disabled:opacity-45',
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...rest}
    />
  )
}

export function IconButton({
  label,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors',
        'hover:bg-slate-100 hover:text-ink focus-ring',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------- Tone / badges
export type Tone = 'ok' | 'warn' | 'bad' | 'idle' | 'info'

const TONE: Record<Tone, { chip: string; dot: string; bar: string; text: string }> = {
  ok: { chip: 'bg-success-soft text-success border-green-200/70', dot: 'bg-success', bar: 'bg-success', text: 'text-success' },
  warn: { chip: 'bg-warning-soft text-warning border-amber-200/70', dot: 'bg-warning', bar: 'bg-warning', text: 'text-warning' },
  bad: { chip: 'bg-danger-soft text-danger border-red-200/70', dot: 'bg-danger', bar: 'bg-danger', text: 'text-danger' },
  idle: { chip: 'bg-slate-100 text-slate-500 border-slate-200', dot: 'bg-slate-400', bar: 'bg-slate-400', text: 'text-slate-500' },
  info: { chip: 'bg-brand-soft text-brand-ink border-blue-200/70', dot: 'bg-brand', bar: 'bg-brand', text: 'text-brand-ink' },
}

export function StatusPill({
  tone,
  children,
  pulse,
  className,
}: {
  tone: Tone
  children: ReactNode
  pulse?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-[2px] text-[11.5px] font-medium leading-[18px] whitespace-nowrap',
        TONE[tone].chip,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', TONE[tone].dot, pulse && 'live-dot')} />
      {children}
    </span>
  )
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border border-line bg-slate-50 px-1.5 py-[1px] font-mono text-[11px] text-muted',
        className,
      )}
    >
      {children}
    </span>
  )
}

// ---------------------------------------------------------------- Card
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('card', className)}>{children}</div>
}

export function Panel({
  title,
  desc,
  action,
  className,
  bodyClassName,
  children,
}: {
  title: ReactNode
  desc?: ReactNode
  action?: ReactNode
  className?: string
  bodyClassName?: string
  children: ReactNode
}) {
  return (
    <section className={cn('card flex flex-col overflow-hidden', className)}>
      <header className="flex items-start justify-between gap-3 border-b border-line-soft px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold text-ink">{title}</h2>
          {desc && <p className="mt-0.5 text-[11.5px] text-muted">{desc}</p>}
        </div>
        {action}
      </header>
      <div className={cn('px-4 py-3', bodyClassName)}>{children}</div>
    </section>
  )
}

// ---------------------------------------------------------------- Progress
export function ProgressBar({
  value,
  tone = 'info',
  className,
  height = 6,
}: {
  value: number
  tone?: Tone
  className?: string
  height?: number
}) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div className={cn('w-full overflow-hidden rounded-full bg-slate-100', className)} style={{ height }}>
      <div
        className={cn('h-full rounded-full transition-[width] duration-500', TONE[tone].bar)}
        style={{ width: `${v}%` }}
      />
    </div>
  )
}

export function Meter({
  label,
  percent,
  detail,
  tone,
  compact,
}: {
  label: string
  percent: number
  detail?: string
  tone?: Tone
  compact?: boolean
}) {
  const auto: Tone = percent >= 85 ? 'bad' : percent >= 70 ? 'warn' : 'ok'
  return (
    <div className={cn('min-w-0', compact ? 'space-y-1' : 'space-y-1.5')}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[11.5px] text-muted">{label}</span>
        <span className="num shrink-0 text-[11.5px] font-medium text-ink-soft">
          {percent.toFixed(1)}%
          {detail && <span className="ml-1 font-normal text-faint">{detail}</span>}
        </span>
      </div>
      <ProgressBar value={percent} tone={tone ?? auto} height={compact ? 4 : 6} />
    </div>
  )
}

// ---------------------------------------------------------------- Form
export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[12px] font-medium text-ink-soft">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-muted">{hint}</span>}
    </label>
  )
}

export const inputClass =
  'h-8 w-full rounded-lg border border-line bg-white px-2.5 text-[13px] text-ink placeholder:text-faint focus-ring focus:border-blue-300'

// ---------------------------------------------------------------- Modal
export function Modal({
  open,
  onClose,
  title,
  desc,
  children,
  footer,
  width = 'w-[440px]',
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  desc?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  width?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-slate-900/25 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'animate-in relative max-h-[86vh] overflow-y-auto rounded-xl border border-line bg-white shadow-[0_24px_60px_rgba(15,23,42,.18)]',
          width,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line-soft px-4 py-3">
          <div>
            <h3 className="text-[14px] font-semibold text-ink">{title}</h3>
            {desc && <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{desc}</p>}
          </div>
          <IconButton label="关闭" onClick={onClose} className="-mr-1 -mt-0.5">
            <X size={15} />
          </IconButton>
        </div>
        {children && <div className="px-4 py-3.5 text-[13px] text-ink-soft">{children}</div>}
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-line-soft bg-slate-50/60 px-4 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- Drawer
export function Drawer({
  open,
  onClose,
  title,
  desc,
  children,
  footer,
  width = 'w-[620px]',
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  desc?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/25 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'animate-in relative flex h-full max-w-full flex-col border-l border-line bg-white shadow-[-24px_0_60px_rgba(15,23,42,.14)]',
          width,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line-soft px-5 py-3.5">
          <div>
            <h3 className="text-[14px] font-semibold text-ink">{title}</h3>
            {desc && <p className="mt-0.5 text-[12px] text-muted">{desc}</p>}
          </div>
          <IconButton label="关闭" onClick={onClose} className="-mr-1">
            <X size={16} />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-line-soft bg-slate-50/60 px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- Tabs
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { key: T; label: string; count?: number }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex items-center gap-1 border-b border-line">
      {tabs.map((t) => {
        const active = t.key === value
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={cn(
              'relative -mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-[12.5px] font-medium transition-colors',
              active
                ? 'border-brand text-brand-ink'
                : 'border-transparent text-muted hover:text-ink',
            )}
          >
            {t.label}
            {typeof t.count === 'number' && (
              <span
                className={cn(
                  'num rounded-full px-1.5 py-px text-[10.5px] leading-4',
                  active ? 'bg-brand-soft text-brand-ink' : 'bg-slate-100 text-muted',
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------- Misc
export function EmptyState({
  icon,
  title,
  desc,
}: {
  icon?: ReactNode
  title: string
  desc?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {icon && (
        <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-faint">
          {icon}
        </div>
      )}
      <p className="text-[13px] font-medium text-ink-soft">{title}</p>
      {desc && <p className="max-w-sm text-[12px] text-muted">{desc}</p>}
    </div>
  )
}

export function CopyButton({ text, label = '复制' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
        } catch {
          /* 剪贴板不可用时静默降级 */
        }
        setDone(true)
        window.setTimeout(() => setDone(false), 1400)
      }}
    >
      {done ? <Check size={13} className="text-success" /> : <Copy size={13} />}
      {done ? '已复制' : label}
    </Button>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-line bg-slate-50 px-1.5 py-px font-sans text-[10.5px] text-muted">
      {children}
    </kbd>
  )
}

// ---------------------------------------------------------------- Toaster
export function Toaster() {
  const toasts = useToasts()
  if (!toasts.length) return null
  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'animate-in flex items-center gap-2 rounded-lg border px-3.5 py-2 text-[12.5px] font-medium shadow-[0_12px_32px_rgba(15,23,42,.16)]',
            t.tone === 'success' && 'border-green-200 bg-white text-ink',
            t.tone === 'info' && 'border-line bg-white text-ink',
            t.tone === 'danger' && 'border-red-200 bg-white text-danger',
          )}
        >
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              t.tone === 'success' && 'bg-success',
              t.tone === 'info' && 'bg-brand',
              t.tone === 'danger' && 'bg-danger',
            )}
          />
          {t.message}
        </div>
      ))}
    </div>
  )
}
