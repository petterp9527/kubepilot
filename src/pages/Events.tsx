import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity } from 'lucide-react'
import { useCluster } from '../store'
import { cn, fromNow, inNamespace } from '../lib/utils'
import { Badge, Card, StatusPill } from '../components/ui'
import type { EventItem } from '../types'
import { DataTable } from '../components/DataTable'
import type { Column } from '../components/DataTable'
import { PageHeader, SearchInput, Toolbar } from '../components/PageHeader'

type Filter = 'all' | 'Warning' | 'Normal'

export default function Events() {
  const state = useCluster()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const scoped = useMemo(
    () => inNamespace(state.events, state.namespace),
    [state.events, state.namespace],
  )

  const rows = useMemo(() => {
    const kw = q.trim().toLowerCase()
    return scoped.filter(
      (e) =>
        (filter === 'all' || e.type === filter) &&
        (!kw || e.message.toLowerCase().includes(kw) || e.reason.toLowerCase().includes(kw) || e.object.toLowerCase().includes(kw)),
    )
  }, [scoped, q, filter])

  const warnings = scoped.filter((e) => e.type === 'Warning').length

  const columns: Column<EventItem>[] = [
    {
      key: 'type',
      header: '类型',
      sortValue: (r) => r.type,
      width: '90px',
      render: (r) => <StatusPill tone={r.type === 'Warning' ? 'warn' : 'idle'}>{r.type === 'Warning' ? '警告' : '正常'}</StatusPill>,
    },
    {
      key: 'reason',
      header: '原因',
      sortValue: (r) => r.reason,
      render: (r) => <span className="font-mono text-[11.5px] font-medium text-ink">{r.reason}</span>,
    },
    {
      key: 'object',
      header: '对象',
      render: (r) => (
        <div className="min-w-0">
          <div className="max-w-[220px] truncate font-mono text-[11px] text-ink-soft">{r.object}</div>
          <div className="flex items-center gap-1 text-[10.5px] text-faint">
            <span>{r.kind}</span>
            <span>·</span>
            <span className="font-mono">{r.namespace}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'message',
      header: '消息',
      render: (r) => (
        <span className="block max-w-[420px] truncate text-[11.5px] text-muted" title={r.message}>
          {r.message}
        </span>
      ),
    },
    {
      key: 'count',
      header: '次数',
      align: 'right',
      sortValue: (r) => r.count,
      width: '70px',
      render: (r) => <span className={cn('num text-[11.5px]', r.count > 5 ? 'font-medium text-danger' : 'text-muted')}>{r.count}</span>,
    },
    {
      key: 'time',
      header: '最近发生',
      align: 'right',
      sortValue: (r) => -r.lastSeenMinutes,
      width: '110px',
      render: (r) => <span className="num text-[11px] text-faint">{fromNow(r.lastSeenMinutes)}</span>,
    },
  ]

  return (
    <div>
      <PageHeader
        title="事件"
        desc={
          <span className="flex items-center gap-3">
            <span>{scoped.length} 条事件</span>
            <span className="text-line">|</span>
            <span className={warnings ? 'text-warning' : 'text-success'}>{warnings} 条 Warning</span>
            <span className="text-line">|</span>
            <span className="text-muted">默认按时间倒序</span>
          </span>
        }
        actions={
          <Toolbar>
            <SearchInput value={q} onChange={setQ} placeholder="搜索原因或消息" />
          </Toolbar>
        }
      />

      <div className="mb-3 flex items-center gap-1.5">
        {(
          [
            { key: 'all', label: '全部', count: scoped.length },
            { key: 'Warning', label: 'Warning', count: warnings },
            { key: 'Normal', label: 'Normal', count: scoped.length - warnings },
          ] as const
        ).map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              'flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[11.5px] transition-colors',
              filter === f.key ? 'border-blue-200 bg-brand-soft font-medium text-brand-ink' : 'border-line bg-white text-muted hover:bg-slate-50',
            )}
          >
            {f.label}
            <span className="num text-[10.5px] opacity-70">{f.count}</span>
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(r) => r.id}
          emptyIcon={<Activity size={18} />}
          emptyTitle="没有匹配的事件"
          emptyDesc="事件默认保留 1 小时，可调整筛选条件"
          onRowClick={(r) => {
            if (r.kind === 'Node') navigate(`/nodes/${r.object}`)
            else if (r.kind === 'Pod') navigate(`/workloads/pods/${r.object}?ns=${r.namespace}`)
            else if (r.kind === 'Deployment') navigate(`/workloads/deployments/${r.object}`)
            else if (r.kind === 'StatefulSet') navigate(`/workloads/statefulsets/${r.object}`)
          }}
        />
      </Card>

      <div className="mt-2.5 flex items-center gap-3 px-1 text-[11px] text-muted">
        <Badge>kubectl get events --sort-by=.lastTimestamp</Badge>
        <span>点击行可跳转到关联资源</span>
      </div>
    </div>
  )
}
