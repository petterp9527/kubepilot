import { useMemo, useState } from 'react'
import { ArrowRight, Globe, Lock } from 'lucide-react'
import { useCluster } from '../store'
import { formatAge, inNamespace } from '../lib/utils'
import { Badge, Card, StatusPill } from '../components/ui'
import type { IngressItem } from '../types'
import { DataTable } from '../components/DataTable'
import type { Column } from '../components/DataTable'
import { PageHeader, SearchInput, Toolbar } from '../components/PageHeader'

export default function IngressList() {
  const state = useCluster()
  const [q, setQ] = useState('')
  const scoped = useMemo(() => inNamespace(state.ingresses, state.namespace), [state.ingresses, state.namespace])
  const rows = scoped.filter((i) => i.name.includes(q.trim().toLowerCase()))

  const columns: Column<IngressItem>[] = [
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
    { key: 'class', header: 'Class', render: (r) => <Badge>{r.className}</Badge> },
    {
      key: 'hosts',
      header: '路由规则',
      render: (r) => (
        <div className="space-y-0.5">
          {r.hosts.map((h) => (
            <div key={`${h.host}${h.path}`} className="flex items-center gap-1 text-[11px]">
              <Globe size={10} className="text-faint" />
              <span className="font-mono text-ink-soft">{h.host}</span>
              <span className="text-faint">{h.path}</span>
              <ArrowRight size={9} className="text-faint" />
              <span className="font-mono text-muted">
                {h.service}:{h.port}
              </span>
            </div>
          ))}
        </div>
      ),
    },
    {
      key: 'tls',
      header: 'TLS',
      render: (r) =>
        r.tls ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-success">
            <Lock size={10} />
            已启用
          </span>
        ) : (
          <span className="text-[11px] text-faint">未启用</span>
        ),
    },
    {
      key: 'status',
      header: '状态',
      render: (r) => <StatusPill tone={r.status === 'Active' ? 'ok' : 'warn'}>{r.status === 'Active' ? '生效中' : '等待中'}</StatusPill>,
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
        title="Ingress"
        desc={`${scoped.length} 条七层路由 · ${scoped.filter((i) => i.tls).length} 条启用 TLS`}
        actions={
          <Toolbar>
            <SearchInput value={q} onChange={setQ} placeholder="搜索 Ingress 名称" />
          </Toolbar>
        }
      />
      <Card className="overflow-hidden">
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(r) => `${r.namespace}/${r.name}`}
          emptyIcon={<Globe size={18} />}
          emptyTitle="没有匹配的 Ingress"
          emptyDesc="调整搜索或命名空间后重试"
        />
      </Card>
      <p className="mt-2.5 px-1 text-[11px] text-muted">
        提示：Ingress 依赖 ingress-controller（当前集群为 nginx）实际生效，状态 Pending 通常表示后端 Service 不可用。
      </p>
    </div>
  )
}
