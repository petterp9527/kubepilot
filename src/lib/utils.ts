import type { ClusterState, Pod, Workload } from '../types'

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

/** K8s 风格 age：3d4h / 12m / 45s */
export function formatAge(minutes: number) {
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${Math.floor(minutes)}m`
  const h = Math.floor(minutes / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  const rh = h % 24
  return rh ? `${d}d${rh}h` : `${d}d`
}

export function fromNow(minutes: number) {
  if (minutes < 1) return '几秒前'
  if (minutes < 60) return `${Math.floor(minutes)} 分钟前`
  const h = Math.floor(minutes / 60)
  if (h < 24) return `${h} 小时前`
  return `${Math.floor(h / 24)} 天前`
}

export function logTime(d: Date = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`
}

export function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatCpu(millicores: number) {
  return millicores >= 1000 ? `${(millicores / 1000).toFixed(1)} 核` : `${millicores}m`
}

export function formatMemory(mib: number) {
  return mib >= 1024 ? `${(mib / 1024).toFixed(1)} GiB` : `${mib} MiB`
}

export function usageTone(percent: number): 'ok' | 'warn' | 'bad' {
  if (percent >= 85) return 'bad'
  if (percent >= 70) return 'warn'
  return 'ok'
}

export function podTone(phase: Pod['phase']): 'ok' | 'warn' | 'bad' | 'idle' {
  switch (phase) {
    case 'Running':
      return 'ok'
    case 'Pending':
    case 'Terminating':
      return 'warn'
    case 'Failed':
    case 'Unknown':
      return 'bad'
    default:
      return 'idle'
  }
}

export function workloadTone(status: Workload['status']): 'ok' | 'warn' | 'bad' | 'idle' {
  if (status === 'Healthy') return 'ok'
  if (status === 'Progressing') return 'warn'
  if (status === 'Degraded') return 'bad'
  return 'idle'
}

export const ALL_NS = '__all__'

export function inNamespace<T extends { namespace: string }>(items: T[], ns: string) {
  return ns === ALL_NS ? items : items.filter((i) => i.namespace === ns)
}

export interface ClusterStats {
  nodeReady: number
  nodeTotal: number
  podRunning: number
  podTotal: number
  cpuPercent: number
  memPercent: number
  cpuUsed: number
  cpuTotal: number
  memUsed: number
  memTotal: number
  diskPercent: number
  warnings: number
  workloadHealthy: number
  workloadTotal: number
  namespaceRows: { namespace: string; total: number; ready: number; pods: number }[]
}

export function computeStats(s: ClusterState, ns: string): ClusterStats {
  const pods = inNamespace(s.pods, ns)
  const workloads = inNamespace(s.workloads, ns)
  const nodes = s.nodes

  const cpuTotal = nodes.reduce((a, n) => a + n.cpuCores * 1000, 0)
  const memTotal = nodes.reduce((a, n) => a + n.memoryGiB, 0)
  const cpuUsed = pods.reduce((a, p) => a + p.cpu, 0)
  const memUsed = Math.round(pods.reduce((a, p) => a + p.memory, 0) / 1024)

  const nsMap = new Map<string, { total: number; ready: number; pods: number }>()
  workloads.forEach((w) => {
    const cur = nsMap.get(w.namespace) ?? { total: 0, ready: 0, pods: 0 }
    cur.total += w.replicas
    cur.ready += w.ready
    nsMap.set(w.namespace, cur)
  })
  pods.forEach((p) => {
    const cur = nsMap.get(p.namespace) ?? { total: 0, ready: 0, pods: 0 }
    cur.pods += 1
    nsMap.set(p.namespace, cur)
  })

  return {
    nodeReady: nodes.filter((n) => n.status === 'Ready').length,
    nodeTotal: nodes.length,
    podRunning: pods.filter((p) => p.phase === 'Running').length,
    podTotal: pods.length,
    cpuPercent: cpuTotal ? Math.round((cpuUsed / cpuTotal) * 1000) / 10 : 0,
    memPercent: memTotal ? Math.round((memUsed / memTotal) * 1000) / 10 : 0,
    cpuUsed,
    cpuTotal,
    memUsed,
    memTotal,
    diskPercent: Math.round(nodes.reduce((a, n) => a + n.diskUsage, 0) / nodes.length),
    warnings: s.events.filter((e) => e.type === 'Warning' && (ns === ALL_NS || e.namespace === ns)).length,
    workloadHealthy: workloads.filter((w) => w.status === 'Healthy').length,
    workloadTotal: workloads.length,
    namespaceRows: [...nsMap.entries()]
      .map(([namespace, v]) => ({ namespace, ...v }))
      .sort((a, b) => b.total - a.total),
  }
}

/** 生成真实可读的 YAML，用于详情页展示与「查看 YAML」抽屉 */
export function workloadYaml(w: Workload) {
  const labels = Object.entries(w.selector)
    .map(([k, v]) => `    ${k}: ${v}`)
    .join('\n')
  const container = w.containers[0]
  return `apiVersion: apps/v1
kind: ${w.kind}
metadata:
  name: ${w.name}
  namespace: ${w.namespace}
  labels:
${labels}
spec:
  replicas: ${w.replicas}
  selector:
    matchLabels:
      app: ${w.name}
  template:
    metadata:
      labels:
        app: ${w.name}
    spec:
      containers:
        - name: ${container.name}
          image: ${container.image}
          ports:
            - containerPort: ${container.ports[0]}
          resources:
            requests:
              cpu: ${container.cpuRequest}
              memory: ${container.memRequest}
            limits:
              cpu: ${container.cpuLimit}
              memory: ${container.memLimit}
          readinessProbe:
            httpGet:
              path: /healthz
              port: ${container.ports[0]}
            initialDelaySeconds: 5
            periodSeconds: 10
`
}

export function podYaml(p: Pod) {
  return `apiVersion: v1
kind: Pod
metadata:
  name: ${p.name}
  namespace: ${p.namespace}
  labels:
    app: ${p.labels.app}
spec:
  nodeName: ${p.node}
  containers:
${p.containers
  .map(
    (c) => `    - name: ${c.name}
      image: ${c.image}
      ports:
        - containerPort: ${c.ports[0] ?? 8080}
      resources:
        requests:
          cpu: ${c.cpuRequest}
          memory: ${c.memRequest}`,
  )
  .join('\n')}
status:
  phase: ${p.phase}
  podIP: ${p.podIP}
  hostIP: ${p.hostIP}
  qosClass: ${p.qos}
`
}

export function deploymentTemplate(namespace: string) {
  return `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-service
  namespace: ${namespace === ALL_NS ? 'default' : namespace}
spec:
  replicas: 2
  selector:
    matchLabels:
      app: my-service
  template:
    metadata:
      labels:
        app: my-service
    spec:
      containers:
        - name: my-service
          image: registry.kubepilot.io/my-service:v0.1.0
          ports:
            - containerPort: 8080
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 512Mi
`
}

export function parseMeta(yaml: string, fallbackNs: string): { name: string; namespace: string; replicas: number; image: string } {
  const name = /metadata:[\s\S]*?\n\s{2}name:\s*([^\s#]+)/.exec(yaml)?.[1] ?? 'unnamed'
  const namespace = /\n\s{2}namespace:\s*([^\s#]+)/.exec(yaml)?.[1] ?? (fallbackNs === ALL_NS ? 'default' : fallbackNs)
  const replicas = Number(/replicas:\s*(\d+)/.exec(yaml)?.[1] ?? 1)
  const image = /image:\s*([^\s#]+)/.exec(yaml)?.[1] ?? 'registry.kubepilot.io/my-service:latest'
  return { name, namespace, replicas, image }
}

export const statusText: Record<string, string> = {
  Healthy: '健康',
  Progressing: '更新中',
  Degraded: '异常',
  Stopped: '已停止',
  Running: '运行中',
  Pending: '等待中',
  Failed: '失败',
  Succeeded: '已完成',
  Unknown: '异常',
  Terminating: '终止中',
  Ready: '就绪',
  NotReady: '未就绪',
  SchedulingDisabled: '已封锁',
  Bound: '已绑定',
  Lost: '已丢失',
  Available: '可用',
  Released: '已释放',
  Active: '生效中',
  Normal: '正常',
  Warning: '警告',
}
