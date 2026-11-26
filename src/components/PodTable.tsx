import { useNavigate } from 'react-router-dom'
import { ScrollText, Trash2 } from 'lucide-react'
import type { Pod } from '../types'
import { actions, toast } from '../store'
import { formatAge, formatCpu, podTone, statusText } from '../lib/utils'
import { IconButton, ProgressBar, StatusPill } from './ui'
import { DataTable } from './DataTable'
import type { Column } from './DataTable'

export function PodTable({
  pods,
  showNode = true,
  showOwner = false,
  onDelete,
  emptyTitle = '没有 Pod',
  emptyDesc = '当前筛选条件下没有匹配的 Pod',
}: {
  pods: Pod[]
  showNode?: boolean
  showOwner?: boolean
  onDelete?: (pod: Pod) => void
  emptyTitle?: string
  emptyDesc?: string
}) {
  const navigate = useNavigate()

  const columns: Column<Pod>[] = [
    {
      key: 'name',
      header: '名称',
      sortValue: (r) => r.name,
      render: (r) => (
        <div className="min-w-0">
          <span className="block truncate font-mono text-[12px] font-medium text-ink">{r.name}</span>
          <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-faint">
            <span className="font-mono">{r.namespace}</span>
            <span>·</span>
            <span>{r.containers.filter((c) => c.ready).length}/{r.containers.length} 容器就绪</span>
          </div>
        </div>
      ),
    },
    {
      key: 'phase',
      header: '状态',
      sortValue: (r) => r.phase,
      render: (r) => (
        <StatusPill tone={podTone(r.phase)} pulse={r.phase === 'Running'}>
          {r.reason ?? statusText[r.phase]}
        </StatusPill>
      ),
    },
    {
      key: 'restarts',
      header: '重启',
      sortValue: (r) => r.restarts,
      align: 'right',
      render: (r) => (
        <span className={r.restarts > 3 ? 'num text-[11.5px] font-medium text-danger' : 'num text-[11.5px] text-muted'}>
          {r.restarts}
        </span>
      ),
    },
    ...(showOwner
      ? [
          {
            key: 'owner',
            header: '所属',
            render: (r: Pod) => <span className="font-mono text-[11px] text-muted">{r.ownerName}</span>,
          } as Column<Pod>,
        ]
      : []),
    ...(showNode
      ? [
          {
            key: 'node',
            header: '节点',
            sortValue: (r: Pod) => r.node,
            render: (r: Pod) => (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  navigate(`/nodes/${r.node}`)
                }}
                className="font-mono text-[11px] text-muted transition-colors hover:text-brand"
              >
                {r.node.replace('kp-', '')}
              </button>
            ),
          } as Column<Pod>,
        ]
      : []),
    {
      key: 'cpu',
      header: 'CPU',
      sortValue: (r) => r.cpu,
      render: (r) => (
        <div className="flex items-center gap-2">
          <ProgressBar value={(r.cpu / 1000) * 100} tone={r.cpu > 700 ? 'warn' : 'info'} height={3} className="w-10" />
          <span className="num text-[11px] text-muted">{formatCpu(r.cpu)}</span>
        </div>
      ),
    },
    {
      key: 'mem',
      header: '内存',
      sortValue: (r) => r.memory,
      align: 'right',
      render: (r) => <span className="num text-[11px] text-muted">{r.memory} MiB</span>,
    },
    {
      key: 'age',
      header: '存活',
      sortValue: (r) => r.ageMinutes,
      align: 'right',
      render: (r) => <span className="num text-[11px] text-muted">{formatAge(r.ageMinutes)}</span>,
    },
  ]

  return (
    <DataTable
      rows={pods}
      columns={columns}
      rowKey={(r) => `${r.namespace}/${r.name}`}
      onRowClick={(r) => navigate(`/workloads/pods/${r.name}?ns=${r.namespace}`)}
      renderActions={(r) => (
        <>
          <IconButton
            label="查看日志"
            onClick={() => navigate(`/workloads/pods/${r.name}?ns=${r.namespace}&tab=logs`)}
          >
            <ScrollText size={13} />
          </IconButton>
          <IconButton
            label="删除 Pod"
            className="hover:bg-danger-soft hover:text-danger"
            onClick={() => {
              if (onDelete) onDelete(r)
              else {
                actions.deletePod(r.name, r.namespace)
                toast(`${r.name} 已删除，控制器将重建`, 'info')
              }
            }}
          >
            <Trash2 size={13} />
          </IconButton>
        </>
      )}
      emptyTitle={emptyTitle}
      emptyDesc={emptyDesc}
    />
  )
}
