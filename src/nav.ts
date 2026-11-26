import {
  Activity,
  Boxes,
  Container,
  Database,
  FileCode2,
  Globe,
  HardDrive,
  Layers,
  LayoutDashboard,
  Lock,
  Network,
  Server,
  SquareTerminal,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  countKey?: 'deployments' | 'statefulsets' | 'daemonsets' | 'pods' | 'services' | 'ingresses' | 'configmaps' | 'secrets' | 'pvcs' | 'pvs' | 'nodes' | 'events'
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const navGroups: NavGroup[] = [
  {
    label: '集群',
    items: [
      { to: '/overview', label: '集群总览', icon: LayoutDashboard },
      { to: '/nodes', label: '节点', icon: Server, countKey: 'nodes' },
    ],
  },
  {
    label: '工作负载',
    items: [
      { to: '/workloads/deployments', label: 'Deployment', icon: Layers, countKey: 'deployments' },
      { to: '/workloads/statefulsets', label: 'StatefulSet', icon: Database, countKey: 'statefulsets' },
      { to: '/workloads/daemonsets', label: 'DaemonSet', icon: Boxes, countKey: 'daemonsets' },
      { to: '/workloads/pods', label: 'Pod', icon: Container, countKey: 'pods' },
    ],
  },
  {
    label: '网络',
    items: [
      { to: '/network/services', label: 'Service', icon: Network, countKey: 'services' },
      { to: '/network/ingresses', label: 'Ingress', icon: Globe, countKey: 'ingresses' },
    ],
  },
  {
    label: '配置',
    items: [
      { to: '/config/configmaps', label: 'ConfigMap', icon: FileCode2, countKey: 'configmaps' },
      { to: '/config/secrets', label: 'Secret', icon: Lock, countKey: 'secrets' },
    ],
  },
  {
    label: '存储',
    items: [
      { to: '/storage/pvcs', label: 'PVC', icon: HardDrive, countKey: 'pvcs' },
      { to: '/storage/pvs', label: 'PV', icon: Database, countKey: 'pvs' },
    ],
  },
  {
    label: '运维',
    items: [
      { to: '/events', label: '事件', icon: Activity, countKey: 'events' },
      { to: '/terminal', label: 'Web 终端', icon: SquareTerminal },
    ],
  },
]

export const pageTitles: Record<string, { title: string; desc: string }> = {
  '/overview': { title: '集群总览', desc: '集群健康、资源水位与近期事件的统一视图' },
  '/nodes': { title: '节点', desc: '集群计算节点的状态、资源与调度信息' },
  '/workloads/deployments': { title: 'Deployment', desc: '无状态工作负载的副本、镜像与发布状态' },
  '/workloads/statefulsets': { title: 'StatefulSet', desc: '有状态工作负载与稳定网络标识' },
  '/workloads/daemonsets': { title: 'DaemonSet', desc: '每个节点上常驻的系统级守护进程' },
  '/workloads/pods': { title: 'Pod', desc: '最小调度单元，含容器状态与日志入口' },
  '/network/services': { title: 'Service', desc: '服务发现与负载均衡入口' },
  '/network/ingresses': { title: 'Ingress', desc: '七层流量入口与域名路由规则' },
  '/config/configmaps': { title: 'ConfigMap', desc: '非敏感配置的键值注入' },
  '/config/secrets': { title: 'Secret', desc: '凭据与证书，默认遮蔽显示' },
  '/storage/pvcs': { title: 'PersistentVolumeClaim', desc: '命名空间级存储申请与绑定状态' },
  '/storage/pvs': { title: 'PersistentVolume', desc: '集群级持久卷与回收策略' },
  '/events': { title: '事件', desc: '按时间倒序的集群事件流，Warning 优先' },
  '/terminal': { title: 'Web 终端', desc: '无需本地 kubectl 的在线命令行' },
}
