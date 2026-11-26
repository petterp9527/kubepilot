import { useMemo } from 'react'
import { cn } from '../lib/utils'

const VALUE_RE = /^(".*"|'.*'|\d+(\.\d+)?|true|false|null)$/

function Line({ line }: { line: string }) {
  const kv = /^(\s*)(-\s)?([A-Za-z0-9_.\-/]+):(\s*)(.*)$/.exec(line)
  if (kv) {
    const [, indent, dash, key, , value] = kv
    const isRef = /^(\||>)/.test(value)
    return (
      <span>
        {indent}
        {dash && <span className="text-rose-400">{dash}</span>}
        <span className="text-sky-300">{key}</span>
        <span className="text-slate-400">:</span>
        {value && (
          <>
            {' '}
            <span
              className={cn(
                'text-emerald-300',
                !isRef && /^\d+$/.test(value) && 'text-amber-300',
                !isRef && /^(true|false|null)$/.test(value) && 'text-fuchsia-300',
                VALUE_RE.test(value) ? '' : 'text-slate-200',
              )}
            >
              {value}
            </span>
          </>
        )}
      </span>
    )
  }
  const dash = /^(\s*)(-\s)(.*)$/.exec(line)
  if (dash) {
    return (
      <span>
        {dash[1]}
        <span className="text-rose-400">{dash[2]}</span>
        <span className="text-slate-200">{dash[3]}</span>
      </span>
    )
  }
  if (/^\s*#/.test(line)) return <span className="text-slate-500">{line}</span>
  return <span className="text-slate-200">{line}</span>
}

export function YamlView({
  yaml,
  className,
  maxHeight = '520px',
  editing,
  onChange,
}: {
  yaml: string
  className?: string
  maxHeight?: string
  editing?: boolean
  onChange?: (v: string) => void
}) {
  const lines = useMemo(() => yaml.split('\n'), [yaml])

  if (editing) {
    return (
      <div className={cn('flex overflow-hidden rounded-lg border border-slate-700 bg-[#0d1526]', className)} style={{ maxHeight }}>
        <div className="select-none border-r border-slate-700/60 bg-black/20 px-2 py-3 text-right font-mono text-[11.5px] leading-[20px] text-slate-600">
          {lines.map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        <textarea
          value={yaml}
          onChange={(e) => onChange?.(e.target.value)}
          spellCheck={false}
          className="min-h-[420px] flex-1 resize-none bg-transparent px-3 py-3 font-mono text-[11.5px] leading-[20px] text-slate-200 outline-none"
          style={{ maxHeight }}
        />
      </div>
    )
  }

  return (
    <div
      className={cn('overflow-auto rounded-lg border border-slate-800 bg-[#0d1526] py-3', className)}
      style={{ maxHeight }}
    >
      <div className="flex min-w-full font-mono text-[11.5px] leading-[20px]">
        <div className="select-none border-r border-slate-800/80 px-2 text-right text-slate-600">
          {lines.map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        <pre className="flex-1 px-3 text-slate-200">
          {lines.map((l, i) => (
            <div key={i} className="whitespace-pre hover:bg-white/[0.03]">
              <Line line={l} />
            </div>
          ))}
        </pre>
      </div>
    </div>
  )
}
