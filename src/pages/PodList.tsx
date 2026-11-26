import { useMemo, useState } from 'react'
import { useCluster, actions, toast } from '../store'
import { cn, inNamespace } from '../lib/utils'
import { Card } from '../components/ui'
import type { Pod } from '../types'
import { PodTable } from '../components/PodTable'
import { PageHeader, SearchInput, Toolbar } from '../components/PageHeader'
import { ConfirmDeleteModal } from '../components/WorkloadDialogs'

type Filter = 'all' | 'running' | 'abnormal'

export default function PodList() {
  const state = useCluster()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [deleteTarget, setDeleteTarget] = useState<Pod | null>(null)

  const scoped = useMemo(() => inNamespace(state.pods, state.namespace), [state.pods, state.namespace])

  const rows = useMemo(() => {
    const kw = q.trim().toLowerCase()
    return scoped.filter((p) => {
      const matchQ = !kw || p.name.toLowerCase().includes(kw) || p.ownerName.toLowerCase().includes(kw)
      const matchF =
        filter === 'all' ||
        (filter === 'running' ? p.phase === 'Running' : p.phase !== 'Running')
      return matchQ && matchF
    })
  }, [scoped, q, filter])

  const running = scoped.filter((p) => p.phase === 'Running').length
  const restarts = scoped.reduce((a, p) => a + p.restarts, 0)

  return (
    <div>
      <PageHeader
        title="Pod"
        desc={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{scoped.length} 个 Pod</span>
            <span className="text-line">|</span>
            <span>
              Running <span className="num text-success">{running}</span>
            </span>
            <span className="text-line">|</span>
            <span>
              异常 <span className={cn('num', scoped.length - running ? 'text-warning' : 'text-ink-soft')}>{scoped.length - running}</span>
            </span>
            <span className="text-line">|</span>
            <span>
              累计重启 <span className="num text-ink-soft">{restarts}</span>
            </span>
          </span>
        }
        actions={
          <Toolbar>
            <SearchInput value={q} onChange={setQ} placeholder="搜索 Pod 或控制器" />
          </Toolbar>
        }
      />

      <div className="mb-3 flex items-center gap-1.5">
        {(
          [
            { key: 'all', label: '全部', count: scoped.length },
            { key: 'running', label: 'Running', count: running },
            { key: 'abnormal', label: '非 Running', count: scoped.length - running },
          ] as const
        ).map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              'flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[11.5px] transition-colors',
              filter === f.key
                ? 'border-blue-200 bg-brand-soft font-medium text-brand-ink'
                : 'border-line bg-white text-muted hover:bg-slate-50',
            )}
          >
            {f.label}
            <span className="num text-[10.5px] opacity-70">{f.count}</span>
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        <PodTable
          pods={rows}
          showOwner
          onDelete={setDeleteTarget}
          emptyTitle="没有匹配的 Pod"
          emptyDesc="调整搜索条件、状态筛选或命名空间"
        />
      </Card>

      <p className="mt-2.5 px-1 text-[11px] text-muted">
        提示：点击行进入 Pod 详情；「日志」图标直达实时日志视图。
      </p>

      <ConfirmDeleteModal
        target={
          deleteTarget
            ? { kind: 'Pod', name: deleteTarget.name, namespace: deleteTarget.namespace, detail: deleteTarget.node }
            : null
        }
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return
          actions.deletePod(deleteTarget.name, deleteTarget.namespace)
          toast(`${deleteTarget.name} 已删除，控制器将重建`, 'info')
        }}
      />
    </div>
  )
}
