import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  Check,
  ChevronDown,
  Layers,
  RefreshCw,
  Search,
  Server,
  Network,
  Container,
  Globe,
} from 'lucide-react'
import { actions, useCluster, ALL_NS, toast } from '../../store'
import { cn, fromNow, inNamespace } from '../../lib/utils'
import { Button, Kbd } from '../ui'

function useOutside<T extends HTMLElement>(onClose: () => void) {
  const ref = useRef<T>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])
  return ref
}

const kindPath: Record<string, string> = {
  Deployment: '/workloads/deployments',
  StatefulSet: '/workloads/statefulsets',
  DaemonSet: '/workloads/daemonsets',
  Pod: '/workloads/pods',
}

export default function Topbar() {
  const state = useCluster()
  const navigate = useNavigate()
  const [nsOpen, setNsOpen] = useState(false)
  const [bellOpen, setBellOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const nsRef = useOutside<HTMLDivElement>(() => setNsOpen(false))
  const bellRef = useOutside<HTMLDivElement>(() => setBellOpen(false))

  const namespaces = useMemo(() => {
    const set = new Set<string>()
    state.pods.forEach((p) => set.add(p.namespace))
    return [...set].sort()
  }, [state.pods])

  const counts = useMemo(() => {
    const map = new Map<string, number>()
    state.pods.forEach((p) => map.set(p.namespace, (map.get(p.namespace) ?? 0) + 1))
    return map
  }, [state.pods])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const items: { key: string; title: string; sub: string; type: string; to: string }[] = []
    inNamespace(state.workloads, state.namespace)
      .filter((w) => w.name.toLowerCase().includes(q))
      .slice(0, 5)
      .forEach((w) =>
        items.push({
          key: `w-${w.kind}-${w.namespace}-${w.name}`,
          title: w.name,
          sub: `${w.namespace} · ${w.kind}`,
          type: w.kind,
          to: `${kindPath[w.kind]}/${w.name}`,
        }),
      )
    inNamespace(state.pods, state.namespace)
      .filter((p) => p.name.toLowerCase().includes(q))
      .slice(0, 4)
      .forEach((p) =>
        items.push({
          key: `p-${p.name}`,
          title: p.name,
          sub: `${p.namespace} · ${p.node}`,
          type: 'Pod',
          to: `/workloads/pods/${p.name}`,
        }),
      )
    state.nodes
      .filter((n) => n.name.includes(q))
      .slice(0, 2)
      .forEach((n) =>
        items.push({ key: `n-${n.name}`, title: n.name, sub: n.internalIP, type: 'Node', to: `/nodes/${n.name}` }),
      )
    return items
  }, [query, state])

  const warnings = state.events.filter((e) => e.type === 'Warning' && (state.namespace === ALL_NS || e.namespace === state.namespace))

  const doRefresh = () => {
    setRefreshing(true)
    actions.refresh()
    window.setTimeout(() => setRefreshing(false), 700)
    toast('已重新拉取集群指标', 'info')
  }

  return (
    <header className="relative z-20 flex h-[56px] shrink-0 items-center gap-3 border-b border-line bg-white/85 px-4 backdrop-blur">
      {/* 全局搜索 */}
      <div className="relative w-[288px]">
        <div
          className={cn(
            'flex h-8 items-center gap-2 rounded-lg border bg-slate-50 px-2.5 transition-colors',
            focused ? 'border-blue-300 bg-white shadow-[0_0_0_3px_rgba(191,219,254,.35)]' : 'border-line',
          )}
        >
          <Search size={14} className="shrink-0 text-faint" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => window.setTimeout(() => setFocused(false), 160)}
            placeholder="搜索工作负载、Pod、节点…"
            className="w-full bg-transparent text-[12.5px] text-ink outline-none placeholder:text-faint"
          />
          <Kbd>⌘K</Kbd>
        </div>
        {focused && query.trim() && (
          <div className="animate-in absolute left-0 top-9 w-[420px] overflow-hidden rounded-xl border border-line bg-white shadow-[0_20px_50px_rgba(15,23,42,.14)]">
            {results.length === 0 ? (
              <p className="px-3 py-6 text-center text-[12px] text-muted">未找到与「{query}」匹配的资源</p>
            ) : (
              <ul className="max-h-[320px] overflow-y-auto py-1">
                {results.map((r) => (
                  <li key={r.key}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        navigate(r.to)
                        setQuery('')
                        setFocused(false)
                      }}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-50"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand">
                        {r.type === 'Node' ? <Server size={13} /> : r.type === 'Pod' ? <Container size={13} /> : r.type === 'Service' ? <Network size={13} /> : r.type === 'Ingress' ? <Globe size={13} /> : <Layers size={13} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-mono text-[12px] text-ink">{r.title}</span>
                        <span className="block truncate text-[11px] text-muted">{r.sub}</span>
                      </span>
                      <span className="shrink-0 rounded border border-line px-1 py-px text-[10px] text-faint">{r.type}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="flex-1" />

      {/* 命名空间 */}
      <div className="relative" ref={nsRef}>
        <button
          type="button"
          onClick={() => setNsOpen((v) => !v)}
          className="flex h-8 items-center gap-2 rounded-lg border border-line bg-white px-2.5 text-[12.5px] text-ink-soft transition-colors hover:bg-slate-50"
        >
          <span className="text-[11px] text-faint">命名空间</span>
          <span className="font-medium text-ink">
            {state.namespace === ALL_NS ? '全部' : state.namespace}
          </span>
          <ChevronDown size={13} className={cn('text-faint transition-transform', nsOpen && 'rotate-180')} />
        </button>
        {nsOpen && (
          <div className="animate-in absolute right-0 top-9 z-30 w-[248px] overflow-hidden rounded-xl border border-line bg-white shadow-[0_20px_50px_rgba(15,23,42,.14)]">
            <div className="border-b border-line-soft px-3 py-2 text-[10.5px] font-medium tracking-wide text-faint">
              全局生效，影响列表与统计
            </div>
            <ul className="max-h-[300px] overflow-y-auto py-1">
              {[ALL_NS, ...namespaces].map((ns) => {
                const active = state.namespace === ns
                return (
                  <li key={ns}>
                    <button
                      type="button"
                      onClick={() => {
                        actions.setNamespace(ns)
                        setNsOpen(false)
                        toast(ns === ALL_NS ? '已切换到全部命名空间' : `已切换到 ${ns}`, 'info')
                      }}
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] hover:bg-slate-50',
                        active ? 'font-medium text-brand-ink' : 'text-ink-soft',
                      )}
                    >
                      <span className="flex w-3.5 justify-center">{active && <Check size={13} />}</span>
                      <span className="flex-1 truncate font-mono">{ns === ALL_NS ? '__all__' : ns}</span>
                      <span className="num text-[10.5px] text-faint">{ns === ALL_NS ? state.pods.length : counts.get(ns) ?? 0} pods</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={doRefresh}
        title="刷新指标"
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white text-muted transition-colors hover:bg-slate-50 hover:text-ink"
      >
        <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
      </button>

      {/* 通知 */}
      <div className="relative" ref={bellRef}>
        <button
          type="button"
          onClick={() => setBellOpen((v) => !v)}
          className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white text-muted transition-colors hover:bg-slate-50 hover:text-ink"
        >
          <Bell size={14} />
          {warnings.length > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9.5px] font-semibold text-white">
              {warnings.length}
            </span>
          )}
        </button>
        {bellOpen && (
          <div className="animate-in absolute right-0 top-9 z-30 w-[384px] overflow-hidden rounded-xl border border-line bg-white shadow-[0_20px_50px_rgba(15,23,42,.14)]">
            <div className="flex items-center justify-between border-b border-line-soft px-3 py-2">
              <span className="text-[12px] font-medium text-ink">Warning 事件</span>
              <Button size="sm" variant="ghost" onClick={() => { setBellOpen(false); navigate('/events') }}>
                查看全部
              </Button>
            </div>
            <ul className="max-h-[320px] divide-y divide-line-soft overflow-y-auto">
              {warnings.slice(0, 5).map((e) => (
                <li key={e.id} className="px-3 py-2.5 hover:bg-slate-50">
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                    <span className="font-mono text-[11.5px] text-ink">{e.reason}</span>
                    <span className="ml-auto text-[10.5px] text-faint">{fromNow(e.lastSeenMinutes)}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-muted">{e.message}</p>
                </li>
              ))}
              {warnings.length === 0 && <li className="px-3 py-6 text-center text-[12px] text-muted">当前没有 Warning 事件</li>}
            </ul>
          </div>
        )}
      </div>

      <div className="mx-1 h-5 w-px bg-line" />

      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-[11px] font-semibold text-white">
          YZ
        </div>
        <div className="hidden leading-tight xl:block">
          <div className="text-[11.5px] font-medium text-ink">yuzhang</div>
          <div className="text-[10px] text-faint">cluster-admin</div>
        </div>
      </div>
    </header>
  )
}
