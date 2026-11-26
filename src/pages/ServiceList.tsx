import { useMemo, useState } from 'react'
import { Network } from 'lucide-react'
import { useCluster } from '../store'
import { formatAge, inNamespace } from '../lib/utils'
import { Badge, Card, StatusPill } from '../components/ui'
import type { ServiceItem } from '../types'
import { DataTable } from '../components/DataTable'
import type { Column } from '../components/DataTable'
import { PageHeader, SearchInput, Toolbar } from '../components/PageHeader'

export default function ServiceList() {
  const state = useCluster()
  const [q, setQ] = useState('')

  const scoped = useMemo(() => inNamespace(state.services, state.namespace), [state.services, state.namespace])
  const rows = scoped.filter((s) => s.name.includes(q.trim().toLowerCase()))

  const columns: Column<ServiceItem>[] = [
    {
      key: 'name',
      header: '名称',
      sortValue: (r) => r.name,
      render: (r) => (
        <div>
          <div className="font-mono text-[12px] font-medium text-ink">{r.name}</div>
          <div className="text-[10.5px] text-faint">{r.namespace}</div>
        </div>
      ),
    },
    {
      key: 'type',
      header: '类型',
      sortValue: (r) => r.type,
      render: (r) => (
        <Badge
          className={
            r.type === 'LoadBalancer'
              ? 'border-purple-200 bg-purple-50 text-purple-600'
              : r.type === 'NodePort'
                ? 'border-amber-200 bg-warning-soft text-warning'
                : 'border-slate-200 bg-white text-muted'
          }
        >
          {r.type}
        </Badge>
      ),
    },
    { key: 'clusterIP', header: 'Cluster IP', mono: true, render: (r) => r.clusterIP },
    {
      key: 'external',
      header: 'External IP',
      render: (r) => (
        <span className={r.externalIP === '<none>' ? 'font-mono text-[11px] text-faint' : 'font-mono text-[11px] text-brand'}>
          {r.externalIP}
        </span>
      ),
    },
    {
      key: 'ports',
      header: '端口',
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.ports.map((p) => (
            <span key={`${p.name}-${p.port}`} className="num rounded border border-line bg-slate-50 px-1 text-[10.5px] text-muted">
              {p.port}→{p.targetPort}/{p.protocol}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: 'endpoints',
      header: 'Endpoints',
      align: 'right',
      sortValue: (r) => r.endpoints,
      render: (r) => (
        <span className={r.endpoints ? 'num text-[11.5px] text-ink-soft' : 'num text-[11.5px] text-warning'}>
          {r.endpoints}
        </span>
      ),
    },
    {
      key: 'age',
      header: '存活时间',
      align: 'right',
      sortValue: (r) => r.ageMinutes,
      render: (r) => <span className="num text-[11.5px] text-muted">{formatAge(r.ageMinutes)}</span>,
    },
  ]

  return (
    <div>
      <PageHeader
        title="Service"
        desc={`${scoped.length} 个服务 · ${scoped.filter((s) => s.type !== 'ClusterIP').length} 个对外暴露`}
        actions={
          <Toolbar>
            <SearchInput value={q} onChange={setQ} placeholder="搜索服务名称" />
          </Toolbar>
        }
      />
      <Card className="overflow-hidden">
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(r) => `${r.namespace}/${r.name}`}
          emptyIcon={<Network size={18} />}
          emptyTitle="没有匹配的 Service"
          emptyDesc="调整搜索或命名空间后重试"
        />
      </Card>
    </div>
  )
}
