import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Server } from 'lucide-react'
import { useCluster } from '../store'
import { formatAge, statusText, usageTone } from '../lib/utils'
import { StatusPill, Card, ProgressBar, Badge } from '../components/ui'
import type { NodeItem } from '../types'
import { DataTable } from '../components/DataTable'
import type { Column } from '../components/DataTable'
import { PageHeader, SearchInput, Toolbar } from '../components/PageHeader'

export default function NodeList() {
  const state = useCluster()
  const navigate = useNavigate()
  const [q, setQ] = useState('')

  const rows = useMemo(
    () => state.nodes.filter((n) => n.name.includes(q.trim())),
    [state.nodes, q],
  )

  const ready = state.nodes.filter((n) => n.status === 'Ready').length

  const columns: Column<NodeItem>[] = [
    {
      key: 'name',
      header: '节点名称',
      sortValue: (r) => r.name,
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-slate-500">
            <Server size={12} />
          </span>
          <span className="font-mono text-[12px] font-medium text-ink">{r.name}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: '状态',
      sortValue: (r) => r.status,
      render: (r) => (
        <StatusPill tone={r.status === 'Ready' ? 'ok' : r.status === 'NotReady' ? 'bad' : 'warn'} pulse={r.status === 'Ready'}>
          {statusText[r.status]}
        </StatusPill>
      ),
    },
    {
      key: 'roles',
      header: '角色',
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.roles.map((role) => (
            <Badge key={role} className={role === 'worker' ? 'bg-white' : 'border-indigo-200 bg-indigo-50 text-indigo-600'}>
              {role}
            </Badge>
          ))}
        </div>
      ),
    },
    { key: 'version', header: '版本', render: (r) => <span className="font-mono text-[11.5px] text-muted">{r.version}</span> },
    {
      key: 'cpu',
      header: 'CPU',
      sortValue: (r) => r.cpuUsage,
      width: '150px',
      render: (r) => <UsageCell percent={r.cpuUsage} detail={`${r.cpuCores} 核`} />,
    },
    {
      key: 'memory',
      header: '内存',
      sortValue: (r) => r.memoryUsage,
      width: '150px',
      render: (r) => <UsageCell percent={r.memoryUsage} detail={`${r.memoryGiB} GiB`} />,
    },
    {
      key: 'pods',
      header: 'Pod',
      sortValue: (r) => r.pods,
      align: 'right',
      render: (r) => (
        <span className="num text-[12px]">
          {r.pods}
          <span className="text-faint">/{r.podCapacity}</span>
        </span>
      ),
    },
    {
      key: 'age',
      header: '存活时间',
      sortValue: (r) => r.ageMinutes,
      align: 'right',
      render: (r) => <span className="num text-[11.5px] text-muted">{formatAge(r.ageMinutes)}</span>,
    },
  ]

  return (
    <div>
      <PageHeader
        title="节点"
        desc={`${ready}/${state.nodes.length} 节点就绪 · ${state.nodes.reduce((a, n) => a + n.cpuCores, 0)} 核 · ${state.nodes.reduce((a, n) => a + n.memoryGiB, 0)} GiB 可分配内存`}
        actions={
          <Toolbar>
            <SearchInput value={q} onChange={setQ} placeholder="搜索节点名称" />
          </Toolbar>
        }
      />

      <Card className="overflow-hidden">
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(r) => r.name}
          onRowClick={(r) => navigate(`/nodes/${r.name}`)}
          emptyTitle="没有匹配的节点"
          emptyDesc="清空搜索条件后重试"
        />
      </Card>

      <div className="mt-2.5 flex items-center gap-4 px-1 text-[11px] text-muted">
        <span>共 {rows.length} 个节点</span>
        <span className="h-3 w-px bg-line" />
        <span>点击行进入节点详情，查看条件、污点与节点上的 Pod</span>
      </div>
    </div>
  )
}

export function UsageCell({ percent, detail }: { percent: number; detail?: string }) {
  return (
    <div className="flex items-center gap-2">
      <ProgressBar value={percent} tone={usageTone(percent)} height={4} className="w-16" />
      <span className="num w-9 text-[11.5px] text-ink-soft">{percent}%</span>
      {detail && <span className="num text-[10.5px] text-faint">{detail}</span>}
    </div>
  )
}
