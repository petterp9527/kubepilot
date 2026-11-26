import { NavLink, useLocation } from 'react-router-dom'
import { ChevronLeft, ChevronRight, CircleHelp } from 'lucide-react'
import { navGroups } from '../../nav'
import { useCluster, ALL_NS } from '../../store'
import { cn, inNamespace } from '../../lib/utils'

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-gradient-to-br from-blue-500 to-indigo-600 shadow-[0_4px_12px_rgba(37,99,235,.45)]">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="3.1" stroke="white" strokeWidth="1.7" />
          <path d="M12 2.6v5.1M12 16.3v5.1M2.6 12h5.1M16.3 12h5.1M5.4 5.4l3.4 3.4M15.2 15.2l3.4 3.4M18.6 5.4l-3.4 3.4M8.8 15.2l-3.4 3.4" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity=".9" />
        </svg>
      </div>
      {!compact && (
        <div className="min-w-0 leading-none">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[14.5px] font-semibold tracking-tight text-white">KubePilot</span>
            <span className="rounded bg-white/10 px-1 py-px font-mono text-[9.5px] text-slate-300">v0.1</span>
          </div>
          <div className="mt-1 text-[10.5px] tracking-wide text-slate-400">Kubernetes 控制台</div>
        </div>
      )}
    </div>
  )
}

export default function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean
  onToggle: () => void
}) {
  const state = useCluster()
  const location = useLocation()
  const ns = state.namespace

  const counts = {
    nodes: state.nodes.length,
    deployments: inNamespace(state.workloads, ns).filter((w) => w.kind === 'Deployment').length,
    statefulsets: inNamespace(state.workloads, ns).filter((w) => w.kind === 'StatefulSet').length,
    daemonsets: inNamespace(state.workloads, ns).filter((w) => w.kind === 'DaemonSet').length,
    pods: inNamespace(state.pods, ns).length,
    services: inNamespace(state.services, ns).length,
    ingresses: inNamespace(state.ingresses, ns).length,
    configmaps: inNamespace(state.configmaps, ns).length,
    secrets: inNamespace(state.secrets, ns).length,
    pvcs: inNamespace(state.pvcs, ns).length,
    pvs: state.pvs.length,
    events: state.events.filter((e) => ns === ALL_NS || e.namespace === ns).length,
  }

  return (
    <aside
      className={cn(
        'sidebar-grain relative z-30 flex h-full shrink-0 flex-col bg-sidebar transition-[width] duration-200',
        collapsed ? 'w-[68px]' : 'w-[228px]',
      )}
    >
      <div className={cn('flex h-[56px] items-center border-b border-white/[0.06]', collapsed ? 'justify-center px-0' : 'justify-between px-4')}>
        <Logo compact={collapsed} />
        {!collapsed && (
          <button
            type="button"
            onClick={onToggle}
            className="flex h-6 w-6 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-white/10 hover:text-white"
            title="收起导航"
          >
            <ChevronLeft size={15} />
          </button>
        )}
      </div>

      {collapsed && (
        <button
          type="button"
          onClick={onToggle}
          className="mx-auto mt-2 flex h-6 w-6 items-center justify-center rounded-md text-slate-500 hover:bg-white/10 hover:text-white"
          title="展开导航"
        >
          <ChevronRight size={15} />
        </button>
      )}

      {/* 集群卡片 */}
      <div className={cn('mt-3', collapsed ? 'px-2' : 'px-3')}>
        <div
          className={cn(
            'rounded-lg border border-white/[0.07] bg-white/[0.04] transition-colors hover:bg-white/[0.07]',
            collapsed ? 'flex items-center justify-center py-2' : 'px-2.5 py-2',
          )}
          title={`${state.cluster.name} · ${state.cluster.version}`}
        >
          {collapsed ? (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 live-dot" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 live-dot" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-medium text-slate-100">{state.cluster.name}</div>
                <div className="truncate text-[10.5px] text-slate-400">{state.cluster.version} · 6 节点</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <nav className="mt-3 min-h-0 flex-1 overflow-y-auto pb-3">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-1">
            {!collapsed && (
              <div className="px-4 pb-1 pt-2.5 text-[10px] font-medium tracking-[0.12em] text-slate-500">
                {group.label}
              </div>
            )}
            {collapsed && <div className="mx-3 my-2 h-px bg-white/[0.06]" />}
            <ul className={cn('space-y-0.5', collapsed ? 'px-2' : 'px-2')}>
              {group.items.map((item) => {
                const Icon = item.icon
                const active =
                  location.pathname === item.to ||
                  (item.to !== '/overview' && location.pathname.startsWith(`${item.to}/`))
                const count = item.countKey ? counts[item.countKey] : undefined
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        'group relative flex items-center rounded-md text-[12.5px] transition-colors',
                        collapsed ? 'h-9 justify-center' : 'h-8 gap-2.5 px-2',
                        active
                          ? 'bg-white/[0.1] font-medium text-white'
                          : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-100',
                      )}
                    >
                      {active && !collapsed && (
                        <span className="absolute -left-2 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-r bg-blue-400" />
                      )}
                      <Icon size={15} className={active ? 'text-blue-300' : 'text-slate-500 group-hover:text-slate-300'} />
                      {!collapsed && (
                        <>
                          <span className="flex-1 truncate">{item.label}</span>
                          {typeof count === 'number' && (
                            <span
                              className={cn(
                                'num rounded px-1.5 py-px text-[10px] leading-4',
                                active ? 'bg-white/15 text-slate-100' : 'bg-white/[0.06] text-slate-500',
                              )}
                            >
                              {count}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className={cn('border-t border-white/[0.06] py-2.5', collapsed ? 'px-2' : 'px-3')}>
        <div className={cn('flex items-center gap-2 rounded-lg px-1.5 py-1.5 text-slate-400', collapsed && 'justify-center px-0')}>
          <CircleHelp size={14} className="shrink-0" />
          {!collapsed && <span className="text-[11.5px]">文档与快捷键</span>}
          {!collapsed && <span className="ml-auto rounded border border-white/10 bg-white/[0.04] px-1 font-mono text-[10px] text-slate-500">?</span>}
        </div>
      </div>
    </aside>
  )
}
