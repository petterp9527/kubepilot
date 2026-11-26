import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Activity,
  ArrowUpRight,
  Boxes,
  Clock,
  Cpu,
  HardDrive,
  Layers,
  Server,
  TriangleAlert,
} from 'lucide-react'
import { useCluster } from '../store'
import { computeStats, formatAge, fromNow, statusText, cn } from '../lib/utils'
import { Card, Meter, Panel, ProgressBar, StatusPill, Button } from '../components/ui'
import { LineChart, Sparkline, BarRow } from '../components/charts'
import { PageHeader } from '../components/PageHeader'
import { CreateResourceButton } from '../components/CreateResourceDrawer'

const SERIES_MAP = {
  cpu: { label: 'CPU', color: '#2563eb' },
  mem: { label: '内存', color: '#7c3aed' },
  io: { label: '磁盘 IO', color: '#0d9488' },
} as const

type SeriesKey = keyof typeof SERIES_MAP

export default function Overview() {
  const state = useCluster()
  const navigate = useNavigate()
  const stats = useMemo(() => computeStats(state, state.namespace), [state])
  const [seriesKey, setSeriesKey] = useState<SeriesKey>('cpu')

  const series = seriesKey === 'cpu' ? state.cpuSeries : seriesKey === 'mem' ? state.memSeries : state.ioSeries
  const current = series[series.length - 1].v
  const prev = series[Math.max(0, series.length - 6)].v
  const delta = current - prev

  const alerts = useMemo(() => {
    const notReady = state.nodes.filter((n) => n.status !== 'Ready')
    const degraded = state.workloads.filter((w) => w.status === 'Degraded')
    const pendingPvc = state.pvcs.filter((p) => p.status !== 'Bound')
    return [
      ...notReady.map((n) => ({ id: `n-${n.name}`, text: `节点 ${n.name} 处于 NotReady`, to: `/nodes/${n.name}`, tone: 'bad' as const })),
      ...degraded.map((w) => ({ id: `w-${w.name}-${w.namespace}`, text: `${w.kind} ${w.namespace}/${w.name} 副本不足`, to: `/workloads/${w.kind.toLowerCase()}s/${w.name}`, tone: 'warn' as const })),
      ...pendingPvc.map((p) => ({ id: `p-${p.name}`, text: `PVC ${p.namespace}/${p.name} 未绑定`, to: '/storage/pvcs', tone: 'warn' as const })),
    ]
  }, [state])

  const topNodes = [...state.nodes].sort((a, b) => b.cpuUsage - a.cpuUsage).slice(0, 5)
  const events = state.events.slice(0, 6)

  return (
    <div className="space-y-4">
      <PageHeader
        title="集群总览"
        desc={`${state.cluster.name} · ${state.cluster.version} · ${state.cluster.region} · 运行 ${Math.floor(state.cluster.ageDays)} 天`}
        actions={
          <>
            <Button onClick={() => navigate('/events')}>
              <Activity size={14} />
              事件中心
            </Button>
            <CreateResourceButton namespace={state.namespace} />
          </>
        }
      />

      {alerts.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-amber-200/80 bg-warning-soft px-3 py-2">
          <span className="flex items-center gap-1.5 text-[12px] font-medium text-warning">
            <TriangleAlert size={13} />
            {alerts.length} 项需要关注
          </span>
          <span className="h-3 w-px bg-amber-200" />
          {alerts.slice(0, 3).map((a) => (
            <Link
              key={a.id}
              to={a.to}
              className="group flex items-center gap-1 text-[11.5px] text-amber-800/90 hover:text-amber-900"
            >
              {a.text}
              <ArrowUpRight size={11} className="opacity-50 group-hover:opacity-100" />
            </Link>
          ))}
          {alerts.length > 3 && (
            <button type="button" onClick={() => navigate('/events')} className="text-[11.5px] text-warning underline-offset-2 hover:underline">
              另有 {alerts.length - 3} 项
            </button>
          )}
        </div>
      )}

      {/* KPI */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icon={<Server size={13} />}
          label="节点就绪"
          value={`${stats.nodeReady}`}
          unit={`/ ${stats.nodeTotal}`}
          foot={stats.nodeReady === stats.nodeTotal ? '全部节点 Ready' : `${stats.nodeTotal - stats.nodeReady} 个节点异常`}
          tone={stats.nodeReady === stats.nodeTotal ? 'ok' : 'bad'}
          trail={<ProgressBar value={(stats.nodeReady / stats.nodeTotal) * 100} tone="ok" height={4} className="mt-3" />}
        />
        <Kpi
          icon={<Boxes size={13} />}
          label="Pod 运行中"
          value={`${stats.podRunning}`}
          unit={`/ ${stats.podTotal}`}
          foot={`${stats.podTotal - stats.podRunning} 个非 Running`}
          tone={stats.podTotal - stats.podRunning > 0 ? 'warn' : 'ok'}
          trail={<ProgressBar value={(stats.podRunning / stats.podTotal) * 100} tone="info" height={4} className="mt-3" />}
        />
        <Kpi
          icon={<Cpu size={13} />}
          label="CPU 分配率"
          value={`${stats.cpuPercent}`}
          unit="%"
          foot={`已用 ${(stats.cpuUsed / 1000).toFixed(1)} / ${(stats.cpuTotal / 1000).toFixed(0)} 核`}
          tone={stats.cpuPercent > 75 ? 'warn' : 'ok'}
          trail={<Sparkline data={state.cpuSeries} color="#2563eb" className="mt-2" />}
        />
        <Kpi
          icon={<HardDrive size={13} />}
          label="内存分配率"
          value={`${stats.memPercent}`}
          unit="%"
          foot={`已用 ${stats.memUsed} / ${stats.memTotal} GiB`}
          tone={stats.memPercent > 75 ? 'warn' : 'ok'}
          trail={<Sparkline data={state.memSeries} color="#7c3aed" className="mt-2" />}
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <Card className="p-4 xl:col-span-2">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[13px] font-semibold text-ink">资源使用趋势</h2>
              <p className="mt-0.5 text-[11.5px] text-muted">近 4 小时 · 5 分钟粒度</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="num text-[20px] font-semibold leading-none text-ink">
                  {current}
                  <span className="ml-0.5 text-[12px] font-normal text-muted">%</span>
                </div>
                <div className={cn('num mt-1 text-[11px]', delta >= 0 ? 'text-danger' : 'text-success')}>
                  {delta >= 0 ? '+' : ''}
                  {delta.toFixed(1)}% vs 30m
                </div>
              </div>
              <div className="flex rounded-lg border border-line bg-slate-50 p-0.5">
                {(Object.keys(SERIES_MAP) as SeriesKey[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setSeriesKey(k)}
                    className={cn(
                      'rounded-md px-2 py-1 text-[11.5px] transition-colors',
                      seriesKey === k ? 'bg-white font-medium text-ink shadow-sm' : 'text-muted hover:text-ink',
                    )}
                  >
                    {SERIES_MAP[k].label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <LineChart data={series} color={SERIES_MAP[seriesKey].color} unit="%" height={196} />
        </Card>

        <Card className="p-4">
          <div className="mb-3 flex items-start justify-between">
            <div>
              <h2 className="text-[13px] font-semibold text-ink">集群水位</h2>
              <p className="mt-0.5 text-[11.5px] text-muted">全部节点加权平均</p>
            </div>
            <StatusPill tone={stats.nodeReady === stats.nodeTotal ? 'ok' : 'bad'} pulse={stats.nodeReady === stats.nodeTotal}>
              {stats.nodeReady === stats.nodeTotal ? '健康' : '降级'}
            </StatusPill>
          </div>
          <div className="space-y-3.5">
            <Meter label="CPU" percent={stats.cpuPercent} detail={`${(stats.cpuTotal / 1000).toFixed(0)} 核`} />
            <Meter label="内存" percent={stats.memPercent} detail={`${stats.memTotal} GiB`} />
            <Meter label="磁盘" percent={stats.diskPercent} detail="本地盘" />
            <Meter label="Pod 容量" percent={(stats.podTotal / 6 / 250) * 100} detail={`${stats.podTotal} / 1500`} tone="info" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line-soft pt-3">
            <MiniStat label="工作负载" value={`${stats.workloadHealthy}/${stats.workloadTotal}`} hint="健康" />
            <MiniStat label="Warning" value={`${stats.warnings}`} hint="事件" tone="warn" />
          </div>
        </Card>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <Panel
          title="节点资源排行"
          desc="按 CPU 使用率排序"
          action={
            <Link to="/nodes" className="text-[11.5px] text-muted transition-colors hover:text-brand">
              全部节点
            </Link>
          }
        >
          <div className="space-y-2.5">
            {topNodes.map((n) => (
              <BarRow
                key={n.name}
                label={n.name.replace('kp-', '')}
                value={n.cpuUsage}
                max={100}
                suffix="%"
                color={n.cpuUsage >= 85 ? '#dc2626' : n.cpuUsage >= 70 ? '#d97706' : '#2563eb'}
              />
            ))}
          </div>
          <div className="mt-3 flex items-center gap-1.5 border-t border-line-soft pt-2.5 text-[11px] text-muted">
            <Clock size={11} />
            采集于 {new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </Panel>

        <Panel
          title="命名空间负载"
          desc="副本就绪情况"
          action={
            <Link to="/workloads/deployments" className="text-[11.5px] text-muted transition-colors hover:text-brand">
              工作负载
            </Link>
          }
          bodyClassName="px-0 py-0"
        >
          <table className="w-full">
            <thead>
              <tr className="border-b border-line-soft">
                <th className="h-8 pl-4 text-left text-[11px] font-medium text-muted">命名空间</th>
                <th className="h-8 text-left text-[11px] font-medium text-muted">就绪</th>
                <th className="h-8 pr-4 text-right text-[11px] font-medium text-muted">Pod</th>
              </tr>
            </thead>
            <tbody>
              {stats.namespaceRows.slice(0, 6).map((r) => (
                <tr key={r.namespace} className="border-b border-line-soft last:border-0">
                  <td className="py-2 pl-4 pr-2">
                    <span className="font-mono text-[11.5px] text-ink-soft">{r.namespace}</span>
                  </td>
                  <td className="py-2 pr-2">
                    <div className="flex items-center gap-1.5">
                      <ProgressBar
                        value={r.total ? (r.ready / r.total) * 100 : 0}
                        tone={r.ready === r.total ? 'ok' : 'warn'}
                        height={4}
                        className="w-14"
                      />
                      <span className="num text-[11px] text-muted">
                        {r.ready}/{r.total}
                      </span>
                    </div>
                  </td>
                  <td className="num py-2 pr-4 text-right text-[11.5px] text-ink-soft">{r.pods}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel
          title="近期事件"
          desc="Warning 优先展示"
          action={
            <Link to="/events" className="text-[11.5px] text-muted transition-colors hover:text-brand">
              全部事件
            </Link>
          }
          bodyClassName="px-0 py-0"
        >
          <ul className="divide-y divide-line-soft">
            {events.map((e) => (
              <li key={e.id} className="group px-4 py-2.5 hover:bg-slate-50">
                <div className="flex items-center gap-2">
                  <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', e.type === 'Warning' ? 'bg-warning' : 'bg-slate-300')} />
                  <span className="truncate font-mono text-[11.5px] text-ink">{e.reason}</span>
                  <span className="ml-auto shrink-0 text-[10.5px] text-faint">{fromNow(e.lastSeenMinutes)}</span>
                </div>
                <p className="mt-0.5 line-clamp-1 pl-3.5 text-[11px] text-muted">{e.message}</p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <Panel
          title="工作负载健康"
          desc="按类型汇总副本水位"
          className="xl:col-span-2"
          action={<span className="num text-[11px] text-muted">{stats.workloadTotal} 个工作负载</span>}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {(['Deployment', 'StatefulSet', 'DaemonSet'] as const).map((k) => {
              const list = state.workloads.filter((w) => w.kind === k)
              const ready = list.reduce((a, w) => a + w.ready, 0)
              const total = list.reduce((a, w) => a + w.replicas, 0)
              const bad = list.filter((w) => w.status !== 'Healthy').length
              const Icon = k === 'Deployment' ? Layers : k === 'StatefulSet' ? HardDrive : Boxes
              return (
                <Link
                  key={k}
                  to={`/workloads/${k.toLowerCase()}s`}
                  className="group rounded-lg border border-line p-3 transition-colors hover:border-blue-200 hover:bg-brand-soft/40"
                >
                  <div className="flex items-center gap-2 text-[11.5px] text-muted">
                    <Icon size={13} />
                    {k}
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="num text-[19px] font-semibold text-ink">{ready}</span>
                    <span className="num text-[12px] text-muted">/ {total}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-[11px] text-muted">{list.length} 个资源</span>
                    {bad > 0 ? (
                      <span className="text-[11px] text-warning">{bad} 异常</span>
                    ) : (
                      <span className="text-[11px] text-success">全部健康</span>
                    )}
                  </div>
                  <ProgressBar value={total ? (ready / total) * 100 : 0} tone={bad ? 'warn' : 'ok'} height={4} className="mt-2" />
                </Link>
              )
            })}
          </div>
          <div className="mt-3 space-y-2">
            {state.workloads
              .filter((w) => w.status !== 'Healthy')
              .slice(0, 3)
              .map((w) => (
                <Link
                  key={`${w.namespace}-${w.kind}-${w.name}`}
                  to={`/workloads/${w.kind.toLowerCase()}s/${w.name}`}
                  className="flex items-center gap-3 rounded-lg border border-line-soft bg-slate-50/60 px-3 py-2 transition-colors hover:bg-slate-50"
                >
                  <StatusPill tone={w.status === 'Degraded' ? 'bad' : w.status === 'Progressing' ? 'warn' : 'idle'}>
                    {statusText[w.status]}
                  </StatusPill>
                  <span className="font-mono text-[12px] text-ink">{w.name}</span>
                  <span className="text-[11px] text-muted">{w.namespace}</span>
                  <span className="num ml-auto text-[11px] text-muted">
                    {w.ready}/{w.replicas} 副本
                  </span>
                  <span className="text-[11px] text-faint">{formatAge(w.ageMinutes)}</span>
                </Link>
              ))}
          </div>
        </Panel>

        <Panel title="快捷操作" desc="高频运维动作">
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: '查看事件', to: '/events', icon: Activity },
              { label: 'Pod 列表', to: '/workloads/pods', icon: Boxes },
              { label: '节点状态', to: '/nodes', icon: Server },
              { label: '存储卷', to: '/storage/pvcs', icon: HardDrive },
            ].map((a) => {
              const Icon = a.icon
              return (
                <Link
                  key={a.to}
                  to={a.to}
                  className="flex flex-col gap-2 rounded-lg border border-line p-3 transition-colors hover:border-blue-200 hover:bg-brand-soft/40"
                >
                  <Icon size={15} className="text-brand" />
                  <span className="text-[12px] text-ink-soft">{a.label}</span>
                </Link>
              )
            })}
          </div>
          <div className="mt-3 rounded-lg bg-slate-50 p-3">
            <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-ink-soft">
              <Cpu size={12} />
              kube-apiserver 延迟
            </div>
            <div className="mt-1.5 flex items-end gap-2">
              <span className="num text-[18px] font-semibold text-ink">18</span>
              <span className="mb-0.5 text-[11px] text-muted">ms p99</span>
              <Sparkline data={state.ioSeries} color="#0d9488" className="ml-auto h-6 w-24" />
            </div>
          </div>
        </Panel>
      </div>
    </div>
  )
}

function Kpi({
  icon,
  label,
  value,
  unit,
  foot,
  tone,
  trail,
}: {
  icon: React.ReactNode
  label: string
  value: string
  unit?: string
  foot: string
  tone: 'ok' | 'warn' | 'bad'
  trail?: React.ReactNode
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-1.5 text-[11.5px] text-muted">
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-100 text-slate-500">{icon}</span>
        {label}
      </div>
      <div className="mt-2.5 flex items-baseline gap-1">
        <span className="num text-[26px] font-semibold leading-none tracking-[-0.02em] text-ink">{value}</span>
        {unit && <span className="text-[12px] text-muted">{unit}</span>}
      </div>
      <div
        className={cn(
          'mt-1.5 text-[11px]',
          tone === 'ok' ? 'text-muted' : tone === 'warn' ? 'text-warning' : 'text-danger',
        )}
      >
        {foot}
      </div>
      {trail}
    </div>
  )
}

function MiniStat({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: 'warn' }) {
  return (
    <div>
      <div className="text-[10.5px] text-muted">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className={cn('num text-[14px] font-semibold', tone === 'warn' ? 'text-warning' : 'text-ink')}>{value}</span>
        <span className="text-[10.5px] text-faint">{hint}</span>
      </div>
    </div>
  )
}
