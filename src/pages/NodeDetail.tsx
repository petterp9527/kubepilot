import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Ban, Copy, Play, Server, ShieldAlert } from 'lucide-react'
import { useCluster, toast } from '../store'
import { formatAge, statusText, usageTone } from '../lib/utils'
import { Badge, Button, Card, EmptyState, Meter, Panel, ProgressBar, StatusPill } from '../components/ui'
import type { Pod } from '../types'
import { DataTable } from '../components/DataTable'
import type { Column } from '../components/DataTable'
import { PageHeader } from '../components/PageHeader'

export default function NodeDetail() {
  const { name } = useParams()
  const state = useCluster()
  const navigate = useNavigate()
  const [cordoned, setCordoned] = useState(false)

  const node = state.nodes.find((n) => n.name === name)
  const pods = useMemo(() => state.pods.filter((p) => p.node === name), [state.pods, name])

  if (!node) {
    return (
      <Card>
        <EmptyState icon={<Server size={18} />} title="节点不存在" desc="该节点可能已被移除，返回列表重新选择。" />
      </Card>
    )
  }

  const podColumns: Column<Pod>[] = [
    {
      key: 'name',
      header: 'Pod',
      sortValue: (r) => r.name,
      render: (r) => <span className="font-mono text-[11.5px] text-ink">{r.name}</span>,
    },
    { key: 'ns', header: '命名空间', render: (r) => <span className="font-mono text-[11px] text-muted">{r.namespace}</span> },
    {
      key: 'phase',
      header: '状态',
      render: (r) => (
        <StatusPill tone={r.phase === 'Running' ? 'ok' : r.phase === 'Pending' ? 'warn' : 'bad'}>
          {r.reason ?? statusText[r.phase]}
        </StatusPill>
      ),
    },
    {
      key: 'cpu',
      header: 'CPU',
      sortValue: (r) => r.cpu,
      render: (r) => (
        <div className="flex items-center gap-2">
          <ProgressBar value={(r.cpu / 1000) * 100} tone={usageTone((r.cpu / 1000) * 100)} height={4} className="w-12" />
          <span className="num text-[11px] text-muted">{r.cpu}m</span>
        </div>
      ),
    },
    {
      key: 'mem',
      header: '内存',
      sortValue: (r) => r.memory,
      render: (r) => <span className="num text-[11.5px] text-muted">{r.memory} MiB</span>,
    },
    {
      key: 'restarts',
      header: '重启',
      sortValue: (r) => r.restarts,
      align: 'right',
      render: (r) => <span className={r.restarts > 3 ? 'num text-[11.5px] text-danger' : 'num text-[11.5px] text-muted'}>{r.restarts}</span>,
    },
    { key: 'age', header: '存活', align: 'right', sortValue: (r) => r.ageMinutes, render: (r) => <span className="num text-[11px] text-muted">{formatAge(r.ageMinutes)}</span> },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        back={{ to: '/nodes', label: '节点' }}
        title={<span className="font-mono">{node.name}</span>}
        desc={`${node.internalIP} · ${node.os} · ${node.nodePool} 资源池`}
        meta={
          <>
            <StatusPill tone={node.status === 'Ready' ? (cordoned ? 'warn' : 'ok') : 'bad'} pulse={node.status === 'Ready' && !cordoned}>
              {cordoned ? '已封锁' : statusText[node.status]}
            </StatusPill>
            {node.roles.map((r) => (
              <Badge key={r} className={r === 'worker' ? '' : 'border-indigo-200 bg-indigo-50 text-indigo-600'}>
                {r}
              </Badge>
            ))}
          </>
        }
        actions={
          <>
            <Button onClick={() => { navigator.clipboard?.writeText(node.internalIP); toast('已复制节点 IP') }}>
              <Copy size={14} />
              IP
            </Button>
            <Button onClick={() => navigate('/events')}>
              <ShieldAlert size={14} />
              事件
            </Button>
            <Button
              variant={cordoned ? 'primary' : 'dangerSoft'}
              onClick={() => {
                setCordoned((v) => !v)
                toast(cordoned ? `已解除 ${node.name} 封锁` : `已封锁 ${node.name}（不再调度新 Pod）`, cordoned ? 'success' : 'info')
              }}
            >
              {cordoned ? <Play size={14} /> : <Ban size={14} />}
              {cordoned ? '解除封锁' : '封锁节点'}
            </Button>
          </>
        }
      />

      {node.status !== 'Ready' && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-danger-soft px-3 py-2 text-[12px] text-danger">
          <ShieldAlert size={14} />
          节点 NotReady：kubelet 心跳超时，节点上 {pods.length} 个 Pod 状态可能异常，请检查节点网络与 kubelet 服务。
        </div>
      )}

      <div className="grid gap-3 xl:grid-cols-3">
        <Card className="p-4 xl:col-span-2">
          <h2 className="text-[13px] font-semibold text-ink">资源使用</h2>
          <p className="mt-0.5 text-[11.5px] text-muted">以 kubelet 上报的可分配资源为基准</p>
          <div className="mt-4 space-y-4">
            <Meter label="CPU" percent={node.cpuUsage} detail={`${node.cpuCores} 核`} />
            <Meter label="内存" percent={node.memoryUsage} detail={`${node.memoryGiB} GiB`} />
            <Meter label="磁盘" percent={node.diskUsage} detail="本地盘 /var/lib" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 border-t border-line-soft pt-4 sm:grid-cols-4">
            <Fact label="Pod 数量" value={`${node.pods}`} hint={`/ ${node.podCapacity} 容量`} />
            <Fact label="内核" value={node.kernel.split('-')[0]} hint={node.kernel.split('-').slice(1).join('-')} />
            <Fact label="容器运行时" value={node.runtime.split('://')[0]} hint={node.runtime.split('://')[1]} />
            <Fact label="存活时间" value={formatAge(node.ageMinutes)} hint="自加入集群" />
          </div>
        </Card>

        <div className="space-y-3">
          <Panel title="节点条件" desc="Conditions" bodyClassName="space-y-2">
            {node.conditions.map((c) => (
              <div key={c.type} className="flex items-center justify-between gap-2">
                <span className="text-[12px] text-ink-soft">{c.type}</span>
                <div className="flex items-center gap-2">
                  <span className="truncate text-[10.5px] text-faint">{c.reason}</span>
                  <StatusPill tone={c.status === 'True' ? (c.type === 'Ready' ? 'ok' : 'warn') : 'idle'}>
                    {c.status}
                  </StatusPill>
                </div>
              </div>
            ))}
          </Panel>

          <Panel title="污点与标签" desc="Taints / Labels">
            <div className="space-y-2">
              <div>
                <div className="mb-1 text-[10.5px] font-medium tracking-wide text-faint">TAINTS</div>
                {node.taints.length ? (
                  node.taints.map((t) => <Badge key={t} className="mr-1 border-amber-200 bg-warning-soft text-warning">{t}</Badge>)
                ) : (
                  <span className="text-[11.5px] text-muted">无污点，可正常调度</span>
                )}
              </div>
              <div className="border-t border-line-soft pt-2">
                <div className="mb-1 text-[10.5px] font-medium tracking-wide text-faint">LABELS</div>
                <div className="flex flex-wrap gap-1">
                  <Badge>kubernetes.io/hostname={node.name}</Badge>
                  <Badge>node-pool={node.nodePool}</Badge>
                  <Badge>topology.kubernetes.io/zone=cn-east-2a</Badge>
                </div>
              </div>
            </div>
          </Panel>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
          <div>
            <h2 className="text-[13px] font-semibold text-ink">节点上的 Pod</h2>
            <p className="mt-0.5 text-[11.5px] text-muted">{pods.length} 个 Pod 调度到此节点</p>
          </div>
        </div>
        <DataTable
          rows={pods}
          columns={podColumns}
          rowKey={(r) => `${r.namespace}/${r.name}`}
          onRowClick={(r) => navigate(`/workloads/pods/${r.name}`)}
          emptyTitle="该节点暂无 Pod"
          emptyDesc="调度到该节点的 Pod 会显示在这里"
        />
      </Card>
    </div>
  )
}

function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <div className="text-[10.5px] text-muted">{label}</div>
      <div className="num mt-0.5 text-[13px] font-medium text-ink">{value}</div>
      {hint && <div className="truncate text-[10px] text-faint">{hint}</div>}
    </div>
  )
}
