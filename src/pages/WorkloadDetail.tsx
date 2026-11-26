import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  CircleDot,
  FileCode2,
  Maximize2,
  Pencil,
  RotateCw,
  Trash2,
} from 'lucide-react'
import type { WorkloadKind } from '../types'
import { actions, toast, useCluster } from '../store'
import {
  cn,
  formatAge,
  fromNow,
  statusText,
  workloadTone,
  workloadYaml,
} from '../lib/utils'
import {
  Badge,
  Button,
  Card,
  CopyButton,
  EmptyState,
  Panel,
  ProgressBar,
  StatusPill,
  Tabs,
} from '../components/ui'
import { PageHeader } from '../components/PageHeader'
import { PodTable } from '../components/PodTable'
import { YamlView } from '../components/YamlView'
import { ConfirmDeleteModal, ScaleModal, YamlDrawer } from '../components/WorkloadDialogs'

type TabKey = 'overview' | 'pods' | 'events' | 'yaml'

export default function WorkloadDetail({ kind }: { kind: WorkloadKind }) {
  const { name } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const state = useCluster()
  const [tab, setTab] = useState<TabKey>('overview')
  const [scaleOpen, setScaleOpen] = useState(false)
  const [yamlOpen, setYamlOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [yamlText, setYamlText] = useState('')

  const nsParam = params.get('ns')

  const workload = useMemo(() => {
    const list = state.workloads.filter((w) => w.kind === kind && w.name === name)
    return list.find((w) => w.namespace === nsParam) ?? list[0]
  }, [state.workloads, kind, name, nsParam])

  const pods = useMemo(
    () => state.pods.filter((p) => p.ownerName === name && (!workload || p.namespace === workload.namespace)),
    [state.pods, name, workload],
  )

  const events = useMemo(
    () =>
      state.events.filter(
        (e) => workload && (e.object === workload.name || e.object.startsWith(`${workload.name}-`)),
      ),
    [state.events, workload],
  )

  if (!workload) {
    return (
      <Card>
        <EmptyState title="工作负载不存在" desc="可能已被删除，请返回列表重新选择。" />
      </Card>
    )
  }

  const listPath = `/workloads/${kind.toLowerCase()}s`
  const readyPct = workload.replicas ? (workload.ready / workload.replicas) * 100 : 0

  return (
    <div className="space-y-4">
      <PageHeader
        back={{ to: listPath, label: kind }}
        title={<span className="font-mono">{workload.name}</span>}
        desc={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{kind}</span>
            <span className="text-line">|</span>
            <span className="font-mono">{workload.namespace}</span>
            <span className="text-line">|</span>
            <span>创建于 {formatAge(workload.ageMinutes)} 前</span>
            <span className="text-line">|</span>
            <span className="num">revision {workload.revision}</span>
          </span>
        }
        meta={
          <>
            <StatusPill tone={workloadTone(workload.status)} pulse={workload.status === 'Progressing'}>
              {statusText[workload.status]}
            </StatusPill>
            <Badge className="border-blue-200 bg-brand-soft text-brand-ink">
              {workload.ready}/{workload.replicas} 就绪
            </Badge>
          </>
        }
        actions={
          <>
            {kind !== 'DaemonSet' && (
              <Button onClick={() => setScaleOpen(true)}>
                <Maximize2 size={13} />
                扩缩容
              </Button>
            )}
            <Button
              onClick={() => {
                actions.restart(workload.name, workload.namespace, workload.kind)
                toast(`${workload.name} 已触发滚动重启`, 'info')
              }}
            >
              <RotateCw size={13} />
              重启
            </Button>
            <Button onClick={() => setYamlOpen(true)}>
              <FileCode2 size={13} />
              YAML
            </Button>
            <Button variant="dangerSoft" onClick={() => setDeleteOpen(true)}>
              <Trash2 size={13} />
              删除
            </Button>
          </>
        }
      />

      <Tabs
        tabs={[
          { key: 'overview', label: '概览' },
          { key: 'pods', label: '实例', count: pods.length },
          { key: 'events', label: '事件', count: events.length },
          { key: 'yaml', label: 'YAML' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'overview' && (
        <div className="space-y-3">
          <div className="grid gap-3 xl:grid-cols-3">
            <Card className="p-4 xl:col-span-2">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-[13px] font-semibold text-ink">副本状态</h2>
                  <p className="mt-0.5 text-[11.5px] text-muted">{workload.strategy}</p>
                </div>
                <div className="text-right">
                  <div className="num text-[26px] font-semibold leading-none text-ink">
                    {workload.ready}
                    <span className="text-[13px] font-normal text-faint"> / {workload.replicas}</span>
                  </div>
                  <div className="mt-1 text-[10.5px] text-muted">就绪 / 期望</div>
                </div>
              </div>

              <div className="mt-4 flex gap-1">
                <div className="h-2 rounded-l-full bg-success" style={{ width: `${Math.max(readyPct, 1)}%` }} />
                {workload.replicas - workload.ready > 0 && (
                  <div
                    className="h-2 rounded-r-full bg-danger/70"
                    style={{ width: `${(1 - readyPct) * 100}%` }}
                  />
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-muted">
                <Legend color="bg-success" label={`已就绪 ${workload.ready}`} />
                <Legend color="bg-warning" label={`已更新 ${workload.updated}`} />
                <Legend color="bg-slate-300" label={`可用 ${workload.available}`} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4 border-t border-line-soft pt-3 sm:grid-cols-4">
                <Fact label="发布策略" value={workload.kind === 'DaemonSet' ? 'OnDelete' : 'RollingUpdate'} />
                <Fact label="revision" value={`#${workload.revision}`} />
                <Fact label="CPU" value={`${workload.cpu}m`} />
                <Fact label="内存" value={`${workload.memory} MiB`} />
              </div>
            </Card>

            <Panel title="元数据" desc="Metadata" bodyClassName="space-y-2.5 text-[12px]">
              <Row label="命名空间" value={<span className="font-mono">{workload.namespace}</span>} />
              <Row label="创建时间" value={`${formatAge(workload.ageMinutes)} 前`} />
              <Row label="选择器" value={<span className="font-mono text-[11px]">app={workload.name}</span>} />
              <Row label="标签" value={<span className="font-mono text-[11px]">app.kubernetes.io/name={workload.name}</span>} />
              <div className="border-t border-line-soft pt-2">
                <div className="mb-1.5 text-[10.5px] font-medium tracking-wide text-faint">CONDITIONS</div>
                <div className="space-y-1.5">
                  {workload.conditions.map((c) => (
                    <div key={c.type} className="flex items-center justify-between gap-2">
                      <span className="text-[11.5px] text-ink-soft">{c.type}</span>
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[10.5px] text-faint">{c.reason}</span>
                        <StatusPill tone={c.status === 'True' ? 'ok' : 'idle'}>{c.status}</StatusPill>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
          </div>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
              <div>
                <h2 className="text-[13px] font-semibold text-ink">容器</h2>
                <p className="mt-0.5 text-[11.5px] text-muted">{workload.containers.length} 个容器 · 镜像与资源配额</p>
              </div>
            </div>
            <div className="divide-y divide-line-soft">
              {workload.containers.map((c) => (
                <div key={c.name} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <CircleDot size={13} className="text-brand" />
                    <span className="font-mono text-[12px] font-medium text-ink">{c.name}</span>
                    <StatusPill tone={c.ready ? 'ok' : 'warn'}>{c.state}</StatusPill>
                    <span className="ml-auto text-[10.5px] text-faint">重启 {c.restarts} 次</span>
                  </div>
                  <div className="mt-2 grid gap-x-4 gap-y-1.5 pl-[21px] text-[11.5px] sm:grid-cols-2 lg:grid-cols-4">
                    <div className="min-w-0">
                      <span className="text-faint">镜像 </span>
                      <span className="block truncate font-mono text-[11px] text-ink-soft" title={c.image}>
                        {c.image}
                      </span>
                    </div>
                    <div>
                      <span className="text-faint">端口 </span>
                      <span className="num text-ink-soft">{c.ports.join(', ')}</span>
                    </div>
                    <div>
                      <span className="text-faint">Requests </span>
                      <span className="num text-ink-soft">
                        {c.cpuRequest} / {c.memRequest}
                      </span>
                    </div>
                    <div>
                      <span className="text-faint">Limits </span>
                      <span className="num text-ink-soft">
                        {c.cpuLimit} / {c.memLimit}
                      </span>
                    </div>
                  </div>
                  {c.probe && (
                    <div className="mt-1.5 pl-[21px] font-mono text-[10.5px] text-faint">readinessProbe: {c.probe}</div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <Panel
            title="关联事件"
            desc="按资源名匹配，Warning 高亮"
            action={
              <Button size="sm" variant="ghost" onClick={() => setTab('events')}>
                查看全部
              </Button>
            }
            bodyClassName="px-0 py-0"
          >
            <ul className="divide-y divide-line-soft">
              {events.slice(0, 4).map((e) => (
                <li key={e.id} className="flex items-start gap-2.5 px-4 py-2.5">
                  <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', e.type === 'Warning' ? 'bg-warning' : 'bg-slate-300')} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11.5px] font-medium text-ink">{e.reason}</span>
                      <span className="text-[10.5px] text-faint">{e.source}</span>
                      <span className="ml-auto shrink-0 text-[10.5px] text-faint">{fromNow(e.lastSeenMinutes)}</span>
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-muted">{e.message}</p>
                  </div>
                </li>
              ))}
              {events.length === 0 && <li className="px-4 py-6 text-center text-[12px] text-muted">暂无事件</li>}
            </ul>
          </Panel>
        </div>
      )}

      {tab === 'pods' && (
        <Card className="overflow-hidden">
          <PodTable pods={pods} showOwner={false} emptyTitle="该工作负载暂未创建 Pod" />
        </Card>
      )}

      {tab === 'events' && (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line-soft">
            {events.map((e) => (
              <li key={e.id} className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <StatusPill tone={e.type === 'Warning' ? 'warn' : 'idle'}>{e.type}</StatusPill>
                  <span className="font-mono text-[12px] font-medium text-ink">{e.reason}</span>
                  <Badge>{e.kind}</Badge>
                  <span className="ml-auto text-[10.5px] text-faint">{fromNow(e.lastSeenMinutes)} · ×{e.count}</span>
                </div>
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-soft">{e.message}</p>
                <p className="mt-1 font-mono text-[10.5px] text-faint">
                  {e.namespace}/{e.object} · from {e.source}
                </p>
              </li>
            ))}
            {events.length === 0 && <EmptyState title="暂无事件" desc="该资源在近期没有产生事件记录" />}
          </ul>
        </Card>
      )}

      {tab === 'yaml' && (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft px-4 py-2.5">
            <div className="flex items-center gap-2 text-[11.5px] text-muted">
              <FileCode2 size={13} />
              {editing ? '编辑模式 · 应用后将触发滚动更新' : '只读模式'}
            </div>
            <div className="flex items-center gap-1.5">
              <CopyButton text={editing ? yamlText : workloadYaml(workload)} />
              {editing ? (
                <>
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setYamlText(workloadYaml(workload)) }}>
                    取消
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      actions.applyWorkload(workload.name, workload.namespace, workload.kind, yamlText)
                      setEditing(false)
                      toast(`${workload.name} 已应用，正在滚动更新`)
                    }}
                  >
                    应用
                  </Button>
                </>
              ) : (
                <Button size="sm" onClick={() => { setYamlText(workloadYaml(workload)); setEditing(true) }}>
                  <Pencil size={12} />
                  编辑
                </Button>
              )}
            </div>
          </div>
          <div className="p-3">
            <YamlView
              yaml={editing ? yamlText : workloadYaml(workload)}
              editing={editing}
              onChange={setYamlText}
              maxHeight="560px"
            />
          </div>
        </Card>
      )}

      {scaleOpen && <ScaleModal workload={workload} onClose={() => setScaleOpen(false)} />}
      {yamlOpen && <YamlDrawer workload={workload} onClose={() => setYamlOpen(false)} />}
      <ConfirmDeleteModal
        target={deleteOpen ? { kind: workload.kind, name: workload.name, namespace: workload.namespace, detail: `${workload.replicas} 个副本` } : null}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => {
          actions.deleteWorkload(workload.name, workload.namespace, workload.kind)
          toast(`${workload.name} 已删除`, 'info')
          navigate(listPath)
        }}
      />
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn('h-2 w-2 rounded-sm', color)} />
      {label}
    </span>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10.5px] text-muted">{label}</div>
      <div className="num mt-0.5 text-[12.5px] font-medium text-ink">{value}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-[11.5px] text-muted">{label}</span>
      <span className="min-w-0 truncate text-right text-[11.5px] text-ink-soft">{value}</span>
    </div>
  )
}
