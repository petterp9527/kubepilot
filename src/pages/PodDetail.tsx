import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  CircleDot,
  FileCode2,
  ScrollText,
  SquareTerminal,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import { actions, toast, useCluster } from '../store'
import { cn, formatAge, fromNow, podTone, podYaml, statusText } from '../lib/utils'
import {
  Badge,
  Button,
  Card,
  CopyButton,
  EmptyState,
  Panel,
  StatusPill,
  Tabs,
} from '../components/ui'
import { PageHeader } from '../components/PageHeader'
import { LogViewer } from '../components/LogViewer'
import { YamlView } from '../components/YamlView'
import { ConfirmDeleteModal } from '../components/WorkloadDialogs'

type TabKey = 'overview' | 'logs' | 'events' | 'yaml'

export default function PodDetail() {
  const { name } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const state = useCluster()
  const [tab, setTab] = useState<TabKey>((params.get('tab') as TabKey) || 'overview')
  const [deleteOpen, setDeleteOpen] = useState(false)

  useEffect(() => {
    const t = params.get('tab')
    if (t) setTab(t as TabKey)
  }, [params])

  const pod = useMemo(() => {
    const list = state.pods.filter((p) => p.name === name)
    const ns = params.get('ns')
    return list.find((p) => p.namespace === ns) ?? list[0]
  }, [state.pods, name, params])

  const events = useMemo(
    () => state.events.filter((e) => pod && (e.object.includes(pod.name) || (e.namespace === pod.namespace && e.kind === 'Pod'))),
    [state.events, pod],
  )

  if (!pod) {
    return (
      <Card>
        <EmptyState title="Pod 不存在" desc="该 Pod 可能已被删除或重建，请返回列表查看最新实例。" />
      </Card>
    )
  }

  const ownerPath =
    pod.ownerKind === 'Deployment'
      ? `/workloads/deployments/${pod.ownerName}?ns=${pod.namespace}`
      : pod.ownerKind === 'StatefulSet'
        ? `/workloads/statefulsets/${pod.ownerName}?ns=${pod.namespace}`
        : pod.ownerKind === 'DaemonSet'
          ? `/workloads/daemonsets/${pod.ownerName}?ns=${pod.namespace}`
          : null

  return (
    <div className="space-y-4">
      <PageHeader
        back={{ to: '/workloads/pods', label: 'Pod' }}
        title={<span className="font-mono">{pod.name}</span>}
        desc={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-mono">{pod.namespace}</span>
            <span className="text-line">|</span>
            <span className="font-mono">{pod.podIP}</span>
            <span className="text-line">|</span>
            <span>存活 {formatAge(pod.ageMinutes)}</span>
            <span className="text-line">|</span>
            <span>重启 {pod.restarts} 次</span>
          </span>
        }
        meta={
          <>
            <StatusPill tone={podTone(pod.phase)} pulse={pod.phase === 'Running'}>
              {pod.reason ?? statusText[pod.phase]}
            </StatusPill>
            <Badge>{pod.qos}</Badge>
          </>
        }
        actions={
          <>
            <Button onClick={() => setTab('logs')}>
              <ScrollText size={13} />
              日志
            </Button>
            <Button onClick={() => navigate(`/terminal?pod=${pod.name}&ns=${pod.namespace}`)}>
              <SquareTerminal size={13} />
              终端
            </Button>
            <Button variant="dangerSoft" onClick={() => setDeleteOpen(true)}>
              <Trash2 size={13} />
              删除
            </Button>
          </>
        }
      />

      {pod.phase !== 'Running' && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-warning-soft px-3 py-2 text-[12px] text-warning">
          <TriangleAlert size={14} className="mt-0.5 shrink-0" />
          <div>
            <span className="font-medium">Pod 处于 {pod.reason ?? pod.phase} 状态。</span>
            <span className="ml-1 text-amber-800/80">
              {pod.reason === 'CrashLoopBackOff'
                ? '容器反复退出，建议查看日志定位启动失败原因。'
                : pod.reason === 'ContainerCreating'
                  ? '容器正在创建，可能正在拉取镜像或挂载卷。'
                  : '调度或运行时异常，请结合事件排查。'}
            </span>
          </div>
        </div>
      )}

      <Tabs
        tabs={[
          { key: 'overview', label: '概览' },
          { key: 'logs', label: '日志' },
          { key: 'events', label: '事件', count: events.length },
          { key: 'yaml', label: 'YAML' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'overview' && (
        <div className="grid gap-3 xl:grid-cols-3">
          <Card className="overflow-hidden xl:col-span-2">
            <div className="border-b border-line-soft px-4 py-3">
              <h2 className="text-[13px] font-semibold text-ink">容器</h2>
              <p className="mt-0.5 text-[11.5px] text-muted">{pod.containers.length} 个容器</p>
            </div>
            <div className="divide-y divide-line-soft">
              {pod.containers.map((c) => (
                <div key={c.name} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <CircleDot size={13} className={c.ready ? 'text-success' : 'text-warning'} />
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
                      <span className="num text-ink-soft">{c.ports.join(', ') || '—'}</span>
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
                </div>
              ))}
            </div>
            <div className="border-t border-line-soft bg-slate-50/60 px-4 py-2.5">
              <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-[11.5px]">
                <span className="text-muted">
                  所属控制器{' '}
                  {ownerPath ? (
                    <button
                      type="button"
                      onClick={() => navigate(ownerPath)}
                      className="font-mono text-brand hover:underline"
                    >
                      {pod.ownerKind}/{pod.ownerName}
                    </button>
                  ) : (
                    <span className="font-mono text-ink-soft">{pod.ownerKind}/{pod.ownerName}</span>
                  )}
                </span>
                <span className="text-muted">
                  标签{' '}
                  <span className="font-mono text-[11px] text-ink-soft">app={pod.labels.app}</span>
                </span>
              </div>
            </div>
          </Card>

          <div className="space-y-3">
            <Panel title="详情" desc="Runtime" bodyClassName="space-y-2.5 text-[11.5px]">
              <Row label="状态" value={<StatusPill tone={podTone(pod.phase)}>{statusText[pod.phase]}</StatusPill>} />
              <Row
                label="节点"
                value={
                  <button type="button" onClick={() => navigate(`/nodes/${pod.node}`)} className="font-mono text-brand hover:underline">
                    {pod.node}
                  </button>
                }
              />
              <Row label="Pod IP" value={<span className="font-mono">{pod.podIP}</span>} />
              <Row label="Host IP" value={<span className="font-mono">{pod.hostIP}</span>} />
              <Row label="QoS" value={pod.qos} />
              <Row label="创建时间" value={`${formatAge(pod.ageMinutes)} 前`} />
              <Row label="CPU" value={<span className="num">{pod.cpu}m</span>} />
              <Row label="内存" value={<span className="num">{pod.memory} MiB</span>} />
            </Panel>

            <Panel
              title="快捷"
              desc="日志与终端"
              bodyClassName="grid grid-cols-2 gap-2"
            >
              <button
                type="button"
                onClick={() => setTab('logs')}
                className="flex flex-col gap-2 rounded-lg border border-line p-2.5 text-left transition-colors hover:border-blue-200 hover:bg-brand-soft/40"
              >
                <ScrollText size={15} className="text-brand" />
                <span className="text-[11.5px] text-ink-soft">实时日志</span>
              </button>
              <button
                type="button"
                onClick={() => navigate(`/terminal?pod=${pod.name}&ns=${pod.namespace}`)}
                className="flex flex-col gap-2 rounded-lg border border-line p-2.5 text-left transition-colors hover:border-blue-200 hover:bg-brand-soft/40"
              >
                <SquareTerminal size={15} className="text-brand" />
                <span className="text-[11.5px] text-ink-soft">容器终端</span>
              </button>
            </Panel>
          </div>
        </div>
      )}

      {tab === 'logs' && (
        <div className="space-y-2">
          <LogViewer pod={pod} />
          <p className="px-1 text-[11px] text-muted">原型为模拟日志流；接入后端后将通过 WebSocket 拉取真实容器 stdout。</p>
        </div>
      )}

      {tab === 'events' && (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line-soft">
            {events.map((e) => (
              <li key={e.id} className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <StatusPill tone={e.type === 'Warning' ? 'warn' : 'idle'}>{e.type}</StatusPill>
                  <span className="font-mono text-[12px] font-medium text-ink">{e.reason}</span>
                  <span className="ml-auto text-[10.5px] text-faint">{fromNow(e.lastSeenMinutes)} · ×{e.count}</span>
                </div>
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-soft">{e.message}</p>
                <p className="mt-1 font-mono text-[10.5px] text-faint">from {e.source}</p>
              </li>
            ))}
            {events.length === 0 && <EmptyState title="暂无事件" desc="该 Pod 近期没有产生事件" />}
          </ul>
        </Card>
      )}

      {tab === 'yaml' && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line-soft px-4 py-2.5">
            <div className="flex items-center gap-2 text-[11.5px] text-muted">
              <FileCode2 size={13} />
              Pod 清单（只读）
            </div>
            <CopyButton text={podYaml(pod)} label="复制 YAML" />
          </div>
          <div className="p-3">
            <YamlView yaml={podYaml(pod)} maxHeight="560px" />
          </div>
        </Card>
      )}

      <ConfirmDeleteModal
        target={deleteOpen ? { kind: 'Pod', name: pod.name, namespace: pod.namespace, detail: pod.node } : null}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => {
          actions.deletePod(pod.name, pod.namespace)
          toast(`${pod.name} 已删除，控制器将重建`, 'info')
          navigate('/workloads/pods')
        }}
      />
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="shrink-0 text-muted">{label}</span>
      <span className={cn('min-w-0 truncate text-right text-ink-soft')}>{value}</span>
    </div>
  )
}
