import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, Pause, Play, Search, WrapText } from 'lucide-react'
import type { Pod } from '../types'
import { generateLogs } from '../lib/logs'
import { cn, logTime } from '../lib/utils'
import { Button, IconButton } from './ui'

const LIVE_LINES = [
  '[http] GET /healthz 200 1.8ms',
  '[http] GET /v1/orders 200 23.4ms',
  '[http] POST /v1/cart 200 41.2ms',
  '[gc] heap=312MB goroutines=64',
  '[http] GET /v1/products?page=2 200 12.7ms',
  '[http] PUT /v1/users/me 200 33.1ms',
]

export function LogViewer({ pod }: { pod: Pod }) {
  const [container, setContainer] = useState(pod.containers[0]?.name ?? 'main')
  const [follow, setFollow] = useState(true)
  const [wrap, setWrap] = useState(true)
  const [filter, setFilter] = useState('')
  const [lines, setLines] = useState<string[]>(() => generateLogs(pod, pod.containers[0]?.name))
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLines(generateLogs(pod, container))
  }, [pod, container])

  useEffect(() => {
    if (!follow) return
    let i = 0
    const id = window.setInterval(() => {
      const time = logTime()
      const body = LIVE_LINES[i % LIVE_LINES.length]
      i += 1
      setLines((prev) => [...prev.slice(-500), `${time} INFO  ${body}`])
    }, 1400)
    return () => window.clearInterval(id)
  }, [follow])

  useEffect(() => {
    if (follow && boxRef.current) {
      boxRef.current.scrollTop = boxRef.current.scrollHeight
    }
  }, [lines, follow])

  const shown = useMemo(() => {
    const kw = filter.trim().toLowerCase()
    return kw ? lines.filter((l) => l.toLowerCase().includes(kw)) : lines
  }, [lines, filter])

  const download = () => {
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${pod.name}-${container}.log`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-800 bg-[#0b1220]">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-3 py-2">
        {pod.containers.length > 1 ? (
          <select
            value={container}
            onChange={(e) => setContainer(e.target.value)}
            className="h-7 rounded-md border border-slate-700 bg-slate-900 px-2 font-mono text-[11.5px] text-slate-200 outline-none"
          >
            {pod.containers.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-[11.5px] text-slate-300">
            {container}
          </span>
        )}

        <div className="flex h-7 items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-2">
          <Search size={11} className="text-slate-500" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="过滤关键字"
            className="w-32 bg-transparent text-[11.5px] text-slate-200 outline-none placeholder:text-slate-600"
          />
        </div>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setFollow((v) => !v)}
            className={cn(
              'flex h-7 items-center gap-1.5 rounded-md border px-2 text-[11px] transition-colors',
              follow
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200',
            )}
          >
            {follow ? <Pause size={11} /> : <Play size={11} />}
            {follow ? '实时跟随' : '已暂停'}
          </button>
          <IconButton
            label="自动换行"
            onClick={() => setWrap((v) => !v)}
            className={cn('h-7 w-7 text-slate-400 hover:bg-slate-800 hover:text-slate-100', wrap && 'text-sky-300')}
          >
            <WrapText size={13} />
          </IconButton>
          <IconButton label="下载日志" onClick={download} className="h-7 w-7 text-slate-400 hover:bg-slate-800 hover:text-slate-100">
            <Download size={13} />
          </IconButton>
        </div>
      </div>

      <div ref={boxRef} className="h-[calc(100vh-330px)] min-h-[380px] overflow-auto px-3 py-2 font-mono text-[11.5px] leading-[19px]">
        {shown.length === 0 && <p className="py-8 text-center text-slate-500">没有匹配的日志行</p>}
        {shown.map((l, i) => {
          const isErr = l.includes('ERROR')
          const isWarn = l.includes('WARN')
          return (
            <div
              key={i}
              className={cn(
                'whitespace-pre text-slate-300 hover:bg-white/[0.04]',
                wrap ? 'break-all' : 'whitespace-pre',
                isErr && 'text-rose-300',
                isWarn && 'text-amber-300',
              )}
            >
              {l}
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-3 border-t border-slate-800 px-3 py-1.5 text-[10.5px] text-slate-500">
        <span className="num">{shown.length} 行</span>
        <span>·</span>
        <span>{pod.name}</span>
        <span className="ml-auto">{follow ? 'streaming…' : 'paused'}</span>
      </div>
    </div>
  )
}
