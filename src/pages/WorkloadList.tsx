import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileCode2, Maximize2, RotateCw, Trash2 } from 'lucide-react'
import { actions, toast, useCluster } from '../store'
import { cn, formatAge, formatCpu, statusText, workloadTone } from '../lib/utils'
import { Badge, IconButton, ProgressBar, StatusPill } from '../components/ui'
import { Card } from '../components/ui'
import type { Workload, WorkloadKind } from '../types'
import { DataTable } from '../components/DataTable'
import type { Column } from '../components/DataTable'
import { PageHeader, SearchInput, Toolbar } from '../components/PageHeader'
import { CreateResourceButton } from '../components/CreateResourceDrawer'
import { ConfirmDeleteModal, ScaleModal, YamlDrawer } from '../components/WorkloadDialogs'

const KIND_LABEL: Record<WorkloadKind, string> = {
  Deployment: 'Deployment',
  StatefulSet: 'StatefulSet',
  DaemonSet: 'DaemonSet',
}

export default function WorkloadList({ kind }: { kind: WorkloadKind }) {
  const state = useCluster()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [scaleTarget, setScaleTarget] = useState<Workload | null>(null)
  const [yamlTarget, setYamlTarget] = useState<Workload | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Workload | null>(null)

  const all = useMemo(() => state.workloads.filter((w) => w.kind === kind), [state.workloads, kind])
  const scoped = useMemo(
    () => (state.namespace === '__all__' ? all : all.filter((w) => w.namespace === state.namespace)),
    [all, state.namespace],
  )
  const rows = useMemo(
    () => scoped.filter((w) => w.name.includes(q.trim().toLowerCase())),
    [scoped, q],
  )

  const totalReplicas = scoped.reduce((a, w) => a + w.replicas, 0)
  const totalReady = scoped.reduce((a, w) => a + w.ready, 0)
  const abnormal = scoped.filter((w) => w.status !== 'Healthy').length

  const columns: Column<Workload>[] = [
    {
      key: 'name',
      header: '名称',
      sortValue: (r) => r.name,
      render: (r) => (
        <div className="min-w-0">
          <span className="block truncate font-mono text-[12px] font-medium text-ink">{r.name}</span>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="font-mono text-[10.5px] text-faint">{r.namespace}</span>
            <span className="text-[10px] text-faint">·</span>
            <span className="text-[10.5px] text-faint">rev {r.revision}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: '状态',
      sortValue: (r) => r.status,
      render: (r) => (
        <StatusPill tone={workloadTone(r.status)} pulse={r.status === 'Progressing'}>
          {statusText[r.status]}
        </StatusPill>
      ),
    },
    {
      key: 'replicas',
      header: kind === 'DaemonSet' ? '就绪节点' : '副本',
      sortValue: (r) => r.ready / Math.max(1, r.replicas),
      width: '160px',
      render: (r) => (
        <div className="space-y-1">
          <div className="num flex items-baseline gap-1 text-[12px]">
            <span className={cn('font-medium', r.ready === r.replicas ? 'text-ink' : 'text-warning')}>{r.ready}</span>
            <span className="text-faint">/ {r.replicas}</span>
          </div>
          <ProgressBar
            value={r.replicas ? (r.ready / r.replicas) * 100 : 0}
            tone={r.ready === r.replicas ? 'ok' : 'warn'}
            height={3}
            className="w-20"
          />
        </div>
      ),
    },
    {
      key: 'image',
      header: '镜像',
      render: (r) => (
        <span className="block max-w-[240px] truncate font-mono text-[11px] text-muted" title={r.image}>
          {r.image}
        </span>
      ),
    },
    {
      key: 'cpu',
      header: 'CPU',
      sortValue: (r) => r.cpu,
      align: 'right',
      render: (r) => <span className="num text-[11.5px] text-ink-soft">{formatCpu(r.cpu)}</span>,
    },
    {
      key: 'mem',
      header: '内存',
      sortValue: (r) => r.memory,
      align: 'right',
      render: (r) => <span className="num text-[11.5px] text-ink-soft">{r.memory} MiB</span>,
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
        title={KIND_LABEL[kind]}
        desc={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{scoped.length} 个资源</span>
            <span className="text-line">|</span>
            <span>
              副本 <span className="num text-ink-soft">{totalReady}/{totalReplicas}</span>
            </span>
            <span className="text-line">|</span>
            <span className={abnormal ? 'text-warning' : 'text-success'}>
              {abnormal ? `${abnormal} 个异常` : '全部健康'}
            </span>
            {state.namespace !== '__all__' && (
              <>
                <span className="text-line">|</span>
                <Badge>{state.namespace}</Badge>
              </>
            )}
          </span>
        }
        actions={
          <Toolbar>
            <SearchInput value={q} onChange={setQ} placeholder="搜索名称" />
            <CreateResourceButton namespace={state.namespace} />
          </Toolbar>
        }
      />

      <Card className="overflow-hidden">
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(r) => `${r.namespace}-${r.name}`}
          onRowClick={(r) => navigate(`/workloads/${kind.toLowerCase()}s/${r.name}?ns=${r.namespace}`)}
          renderActions={(r) => (
            <>
              {kind !== 'DaemonSet' && (
                <IconButton label="扩缩容" onClick={() => setScaleTarget(r)}>
                  <Maximize2 size={13} />
                </IconButton>
              )}
              <IconButton
                label="滚动重启"
                onClick={() => {
                  actions.restart(r.name, r.namespace, r.kind)
                  toast(`${r.name} 已触发滚动重启`, 'info')
                }}
              >
                <RotateCw size={13} />
              </IconButton>
              <IconButton label="查看 YAML" onClick={() => setYamlTarget(r)}>
                <FileCode2 size={13} />
              </IconButton>
              <IconButton label="删除" className="hover:bg-danger-soft hover:text-danger" onClick={() => setDeleteTarget(r)}>
                <Trash2 size={13} />
              </IconButton>
            </>
          )}
          emptyTitle={`没有 ${KIND_LABEL[kind]} 资源`}
          emptyDesc="调整搜索或命名空间，或点击右上角「创建资源」"
        />
      </Card>

      <p className="mt-2.5 px-1 text-[11px] text-muted">
        提示：扩缩容与重启会即时反映到列表与总览；YAML 编辑支持「应用」触发滚动更新（原型模拟）。
      </p>

      <ScaleModal workload={scaleTarget} onClose={() => setScaleTarget(null)} />
      <YamlDrawer workload={yamlTarget} onClose={() => setYamlTarget(null)} />
      <ConfirmDeleteModal
        target={
          deleteTarget
            ? { kind: deleteTarget.kind, name: deleteTarget.name, namespace: deleteTarget.namespace, detail: `${deleteTarget.replicas} 个副本` }
            : null
        }
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return
          actions.deleteWorkload(deleteTarget.name, deleteTarget.namespace, deleteTarget.kind)
          toast(`${deleteTarget.name} 已删除`, 'info')
        }}
      />
    </div>
  )
}
