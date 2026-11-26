import { useEffect, useState } from 'react'
import { AlertTriangle, Minus, Pencil, Plus, Trash2 } from 'lucide-react'
import type { Workload } from '../types'
import { actions, toast } from '../store'
import { Button, CopyButton, Drawer, Modal } from './ui'
import { YamlView } from './YamlView'
import { cn, workloadYaml } from '../lib/utils'

export function ScaleModal({
  workload,
  onClose,
}: {
  workload: Workload | null
  onClose: () => void
}) {
  const [value, setValue] = useState(workload?.replicas ?? 1)

  useEffect(() => {
    if (workload) setValue(workload.replicas)
  }, [workload])

  if (!workload) return null
  const diff = value - workload.replicas

  return (
    <Modal
      open
      onClose={onClose}
      title="调整副本数"
      desc={`${workload.kind} · ${workload.namespace}/${workload.name}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              actions.scale(workload.name, workload.namespace, workload.kind, value)
              toast(`${workload.name} 副本数已调整为 ${value}`)
              onClose()
            }}
          >
            确认调整
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-line bg-slate-50 px-3 py-2.5">
          <span className="text-[12px] text-muted">当前副本</span>
          <span className="num text-[16px] font-semibold text-ink">{workload.replicas}</span>
        </div>

        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setValue((v) => Math.max(0, v - 1))}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white text-muted hover:bg-slate-50"
          >
            <Minus size={14} />
          </button>
          <input
            type="number"
            min={0}
            max={100}
            value={value}
            onChange={(e) => setValue(Math.max(0, Math.min(100, Number(e.target.value))))}
            className="num h-11 w-24 rounded-lg border border-line bg-white text-center text-[20px] font-semibold text-ink focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          <button
            type="button"
            onClick={() => setValue((v) => Math.min(100, v + 1))}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white text-muted hover:bg-slate-50"
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="flex items-center justify-between text-[11.5px]">
          <span className="text-muted">
            {diff === 0 ? '未发生变化' : diff > 0 ? `将新增 ${diff} 个 Pod` : `将终止 ${Math.abs(diff)} 个 Pod`}
          </span>
          <div className="flex gap-1">
            {[1, 3, 5, 10].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setValue(n)}
                className={cn(
                  'rounded border px-1.5 py-0.5 text-[11px]',
                  value === n ? 'border-brand bg-brand-soft text-brand-ink' : 'border-line bg-white text-muted hover:bg-slate-50',
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {value === 0 && (
          <p className="rounded-md bg-warning-soft px-2.5 py-2 text-[11.5px] text-warning">
            副本数设为 0 后，该工作负载所有 Pod 将被终止，服务不可用。
          </p>
        )}
      </div>
    </Modal>
  )
}

export function ConfirmDeleteModal({
  target,
  onClose,
  onConfirm,
}: {
  target: { kind: string; name: string; namespace: string; detail?: string } | null
  onClose: () => void
  onConfirm: () => void
}) {
  const [text, setText] = useState('')

  useEffect(() => {
    if (target) setText('')
  }, [target])

  if (!target) return null

  return (
    <Modal
      open
      onClose={onClose}
      title={
        <span className="flex items-center gap-2 text-danger">
          <AlertTriangle size={15} />
          删除 {target.kind}
        </span>
      }
      desc={`${target.namespace}/${target.name}${target.detail ? ` · ${target.detail}` : ''}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="danger"
            disabled={text !== target.name}
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            <Trash2 size={13} />
            确认删除
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-[12.5px] leading-relaxed text-ink-soft">
          删除后该资源及其关联的 Pod 将被终止，且无法恢复。与之绑定的 Service 将失去后端。
        </p>
        <div>
          <label className="mb-1.5 block text-[11.5px] text-muted">
            请输入 <span className="font-mono font-medium text-ink">{target.name}</span> 以确认：
          </label>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={target.name}
            className="h-8 w-full rounded-lg border border-line bg-white px-2.5 font-mono text-[12.5px] outline-none focus:border-red-300 focus:ring-2 focus:ring-red-100"
          />
        </div>
      </div>
    </Modal>
  )
}

export function YamlDrawer({
  workload,
  onClose,
}: {
  workload: Workload | null
  onClose: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')

  useEffect(() => {
    if (workload) {
      setText(workloadYaml(workload))
      setEditing(false)
    }
  }, [workload])

  if (!workload) return null

  return (
    <Drawer
      open
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <span className="font-mono">{workload.name}</span>
          <span className="rounded border border-line bg-slate-50 px-1.5 py-px text-[10.5px] text-muted">YAML</span>
        </span>
      }
      desc={`${workload.kind} · ${workload.namespace} · revision ${workload.revision}`}
      width="w-[720px]"
      footer={
        <>
          <span className="mr-auto text-[11px] text-muted">
            {editing ? '编辑模式：应用后将触发一次滚动更新（原型模拟）' : '只读模式'}
          </span>
          {!editing ? (
            <>
              <CopyButton text={text} label="复制 YAML" />
              <Button variant="primary" onClick={() => setEditing(true)}>
                <Pencil size={13} />
                编辑
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => { setText(workloadYaml(workload)); setEditing(false) }}>
                取消
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  actions.applyWorkload(workload.name, workload.namespace, workload.kind, text)
                  toast(`${workload.name} 已应用，正在滚动更新`)
                  onClose()
                }}
              >
                应用
              </Button>
            </>
          )}
        </>
      }
    >
      <div className="p-5">
        <YamlView yaml={text} editing={editing} onChange={setText} maxHeight="calc(100vh - 220px)" />
      </div>
    </Drawer>
  )
}
