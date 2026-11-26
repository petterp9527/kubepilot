import { useMemo, useState } from 'react'
import { Eye, EyeOff, FileCode2, KeyRound, Lock } from 'lucide-react'
import { useCluster } from '../store'
import { formatAge, inNamespace } from '../lib/utils'
import { Badge, Button, Card, CopyButton, Drawer, IconButton, StatusPill } from '../components/ui'
import { DataTable } from '../components/DataTable'
import type { Column } from '../components/DataTable'
import { PageHeader, SearchInput, Toolbar } from '../components/PageHeader'

type Mode = 'configmaps' | 'secrets'

interface RowData {
  name: string
  namespace: string
  typeLabel: string
  keys: { key: string; value: string }[]
  ageMinutes: number
  immutable?: boolean
}

export default function ConfigList({ mode }: { mode: Mode }) {
  const state = useCluster()
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<RowData | null>(null)
  const [reveal, setReveal] = useState(false)

  const isSecret = mode === 'secrets'

  const all: RowData[] = useMemo(() => {
    if (isSecret) {
      return state.secrets.map((s) => ({
        name: s.name,
        namespace: s.namespace,
        typeLabel: s.type,
        keys: s.keys,
        ageMinutes: s.ageMinutes,
      }))
    }
    return state.configmaps.map((c) => ({
      name: c.name,
      namespace: c.namespace,
      typeLabel: 'Opaque',
      keys: c.keys,
      ageMinutes: c.ageMinutes,
      immutable: c.immutable,
    }))
  }, [state.secrets, state.configmaps, isSecret])

  const scoped = useMemo(() => inNamespace(all, state.namespace), [all, state.namespace])
  const rows = scoped.filter((r) => r.name.includes(q.trim().toLowerCase()))

  const columns: Column<RowData>[] = [
    {
      key: 'name',
      header: '名称',
      sortValue: (r) => r.name,
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-slate-500">
            {isSecret ? <Lock size={12} /> : <FileCode2 size={12} />}
          </span>
          <div>
            <div className="font-mono text-[12px] font-medium text-ink">{r.name}</div>
            <div className="text-[10.5px] text-faint">{r.namespace}</div>
          </div>
        </div>
      ),
    },
    ...(isSecret
      ? ([
          {
            key: 'type',
            header: '类型',
            render: (r: RowData) => <Badge className="border-purple-200 bg-purple-50 text-purple-600">{r.typeLabel}</Badge>,
          },
        ] as Column<RowData>[])
      : ([
          {
            key: 'immutable',
            header: '不可变',
            render: (r: RowData) =>
              r.immutable ? <StatusPill tone="info">immutable</StatusPill> : <span className="text-[11px] text-faint">否</span>,
          },
        ] as Column<RowData>[])),
    {
      key: 'keys',
      header: '键',
      align: 'right',
      sortValue: (r) => r.keys.length,
      render: (r) => <span className="num text-[11.5px] text-ink-soft">{r.keys.length}</span>,
    },
    {
      key: 'preview',
      header: '内容预览',
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.keys.slice(0, 3).map((k) => (
            <span key={k.key} className="rounded border border-line bg-slate-50 px-1 py-px font-mono text-[10.5px] text-muted">
              {k.key}
            </span>
          ))}
          {r.keys.length > 3 && <span className="text-[10.5px] text-faint">+{r.keys.length - 3}</span>}
        </div>
      ),
    },
    {
      key: 'age',
      header: '更新时间',
      align: 'right',
      sortValue: (r) => r.ageMinutes,
      render: (r) => <span className="num text-[11.5px] text-muted">{formatAge(r.ageMinutes)} 前</span>,
    },
  ]

  return (
    <div>
      <PageHeader
        title={isSecret ? 'Secret' : 'ConfigMap'}
        desc={
          isSecret
            ? `${scoped.length} 个 Secret · 值默认遮蔽，需显式确认后查看`
            : `${scoped.length} 个 ConfigMap · ${scoped.filter((c) => c.immutable).length} 个不可变`
        }
        actions={
          <Toolbar>
            <SearchInput value={q} onChange={setQ} placeholder="搜索名称" />
          </Toolbar>
        }
      />

      {isSecret && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-200/70 bg-warning-soft px-3 py-2 text-[11.5px] text-warning">
          <KeyRound size={13} />
          出于安全考虑，Secret 的 value 默认脱敏展示；点击「查看」后需再次切换才显示明文。
        </div>
      )}

      <Card className="overflow-hidden">
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(r) => `${r.namespace}/${r.name}`}
          onRowClick={(r) => {
            setSelected(r)
            setReveal(false)
          }}
          renderActions={(r) => (
            <IconButton label="查看内容" onClick={() => { setSelected(r); setReveal(false) }}>
              <Eye size={13} />
            </IconButton>
          )}
          emptyTitle={`没有匹配的 ${isSecret ? 'Secret' : 'ConfigMap'}`}
          emptyDesc="调整搜索或命名空间后重试"
        />
      </Card>

      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={
          <span className="flex items-center gap-2">
            <span className="font-mono">{selected?.name}</span>
            <Badge>{isSecret ? 'Secret' : 'ConfigMap'}</Badge>
          </span>
        }
        desc={selected ? `${selected.namespace} · ${selected.keys.length} 个键 · 更新于 ${formatAge(selected.ageMinutes)} 前` : ''}
        width="w-[600px]"
        footer={
          <>
            {isSecret && (
              <Button variant="ghost" onClick={() => setReveal((v) => !v)}>
                {reveal ? <EyeOff size={13} /> : <Eye size={13} />}
                {reveal ? '隐藏明文' : '显示明文'}
              </Button>
            )}
            <CopyButton text={selected?.keys.map((k) => `${k.key}=${k.value}`).join('\n') ?? ''} label="复制全部" />
          </>
        }
      >
        <div className="space-y-2.5 p-5">
          {selected?.keys.map((k) => (
            <div key={k.key} className="overflow-hidden rounded-lg border border-line">
              <div className="flex items-center justify-between border-b border-line-soft bg-slate-50 px-3 py-1.5">
                <span className="font-mono text-[11.5px] font-medium text-ink">{k.key}</span>
                <CopyButton text={k.value} label="复制" />
              </div>
              <pre className="max-h-[200px] overflow-auto whitespace-pre-wrap break-all px-3 py-2 font-mono text-[11.5px] leading-relaxed text-ink-soft">
                {isSecret && !reveal ? '••••••••••••••••••••••••' : k.value}
              </pre>
            </div>
          ))}
        </div>
      </Drawer>
    </div>
  )
}
