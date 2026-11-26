import { useMemo, useState } from 'react'
import { HardDrive } from 'lucide-react'
import { useCluster } from '../store'
import { formatAge, inNamespace, usageTone } from '../lib/utils'
import { Badge, Card, ProgressBar, StatusPill } from '../components/ui'
import type { PVCItem, PVItem } from '../types'
import { DataTable } from '../components/DataTable'
import type { Column } from '../components/DataTable'
import { PageHeader, SearchInput, Toolbar } from '../components/PageHeader'

type Mode = 'pvcs' | 'pvs'

export default function StorageList({ mode }: { mode: Mode }) {
  const state = useCluster()
  const [q, setQ] = useState('')
  const isPvc = mode === 'pvcs'

  const pvcRows = useMemo(
    () => inNamespace(state.pvcs, state.namespace).filter((p) => p.name.includes(q.trim().toLowerCase())),
    [state.pvcs, state.namespace, q],
  )
  const pvRows = useMemo(
    () => state.pvs.filter((p) => p.name.includes(q.trim().toLowerCase())),
    [state.pvs, q],
  )

  const pvcColumns: Column<PVCItem>[] = [
    {
      key: 'name',
      header: '名称',
      sortValue: (r) => r.name,
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-slate-500">
            <HardDrive size={12} />
          </span>
          <div>
            <div className="font-mono text-[12px] font-medium text-ink">{r.name}</div>
            <div className="text-[10.5px] text-faint">{r.namespace}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: '状态',
      sortValue: (r) => r.status,
      render: (r) => <StatusPill tone={r.status === 'Bound' ? 'ok' : r.status === 'Lost' ? 'bad' : 'warn'}>{r.status === 'Bound' ? '已绑定' : r.status === 'Lost' ? '已丢失' : '等待中'}</StatusPill>,
    },
    { key: 'capacity', header: '容量', align: 'right', render: (r) => <span className="num text-[11.5px]">{r.capacity}</span> },
    { key: 'sc', header: '存储类', render: (r) => <Badge>{r.storageClass}</Badge> },
    { key: 'mode', header: '访问模式', render: (r) => <span className="font-mono text-[11px] text-muted">{r.accessModes}</span> },
    {
      key: 'usage',
      header: '使用率',
      width: '150px',
      sortValue: (r) => r.usedPercent,
      render: (r) => (
        <div className="flex items-center gap-2">
          <ProgressBar value={r.usedPercent} tone={usageTone(r.usedPercent)} height={4} className="w-14" />
          <span className="num text-[11px] text-muted">{r.usedPercent}%</span>
        </div>
      ),
    },
    { key: 'volume', header: '绑定卷', render: (r) => <span className="font-mono text-[11px] text-muted">{r.volume}</span> },
    {
      key: 'age',
      header: '存活',
      align: 'right',
      sortValue: (r) => r.ageMinutes,
      render: (r) => <span className="num text-[11.5px] text-muted">{formatAge(r.ageMinutes)}</span>,
    },
  ]

  const pvColumns: Column<PVItem>[] = [
    {
      key: 'name',
      header: '卷名称',
      sortValue: (r) => r.name,
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-slate-500">
            <HardDrive size={12} />
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
        <StatusPill tone={r.status === 'Bound' ? 'ok' : r.status === 'Available' ? 'info' : 'warn'}>
          {r.status === 'Bound' ? '已绑定' : r.status === 'Available' ? '可用' : '已释放'}
        </StatusPill>
      ),
    },
    { key: 'capacity', header: '容量', align: 'right', render: (r) => <span className="num text-[11.5px]">{r.capacity}</span> },
    { key: 'sc', header: '存储类', render: (r) => <Badge>{r.storageClass}</Badge> },
    { key: 'mode', header: '访问模式', render: (r) => <span className="font-mono text-[11px] text-muted">{r.accessModes}</span> },
    {
      key: 'reclaim',
      header: '回收策略',
      render: (r) => (
        <Badge className={r.reclaimPolicy === 'Delete' ? 'border-red-200 bg-danger-soft text-danger' : ''}>{r.reclaimPolicy}</Badge>
      ),
    },
    { key: 'claim', header: 'Claim', render: (r) => <span className="font-mono text-[11px] text-muted">{r.claim}</span> },
    {
      key: 'age',
      header: '存活',
      align: 'right',
      sortValue: (r) => r.ageMinutes,
      render: (r) => <span className="num text-[11.5px] text-muted">{formatAge(r.ageMinutes)}</span>,
    },
  ]

  const total = isPvc
    ? pvcRows.reduce((a, p) => a + Number(p.capacity.replace(/[^\d.]/g, '')) * (p.capacity.includes('Ti') ? 1024 : 1), 0)
    : 0

  return (
    <div>
      <PageHeader
        title={isPvc ? 'PersistentVolumeClaim' : 'PersistentVolume'}
        desc={
          isPvc
            ? `${pvcRows.length} 个 PVC · 合计申请 ${total.toFixed(0)} GiB · ${pvcRows.filter((p) => p.status !== 'Bound').length} 个未绑定`
            : `${pvRows.length} 个 PV · ${pvRows.filter((p) => p.status === 'Available').length} 个可分配`
        }
        actions={
          <Toolbar>
            <SearchInput value={q} onChange={setQ} placeholder="搜索卷名称" />
          </Toolbar>
        }
      />
      <Card className="overflow-hidden">
        {isPvc ? (
          <DataTable
            rows={pvcRows}
            columns={pvcColumns}
            rowKey={(r) => `${r.namespace}/${r.name}`}
            emptyTitle="没有匹配的 PVC"
            emptyDesc="调整搜索或命名空间后重试"
          />
        ) : (
          <DataTable
            rows={pvRows}
            columns={pvColumns}
            rowKey={(r) => r.name}
            emptyTitle="没有匹配的 PV"
            emptyDesc="清空搜索条件后重试"
          />
        )}
      </Card>
      <p className="mt-2.5 px-1 text-[11px] text-muted">
        提示：PVC 未绑定通常由 StorageClass 供应失败或容量不足导致，可在事件页查看 provisioner 报错。
      </p>
    </div>
  )
}
