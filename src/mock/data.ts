import type {
  ClusterInfo,
  ClusterState,
  ConfigItem,
  Container,
  EventItem,
  IngressItem,
  NodeItem,
  PVCItem,
  PVItem,
  Pod,
  SecretItem,
  SeriesPoint,
  ServiceItem,
  Workload,
  WorkloadKind,
} from '../types'

/** 确定性随机：同一份种子永远产出同一套集群，便于演示与回归 */
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rnd = mulberry32(20261126)
const int = (min: number, max: number) => Math.floor(rnd() * (max - min + 1)) + min
const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)]

const HEX = '0123456789abcdefghijklmnopqrstuvwxyz'
const hash = (n: number) => Array.from({ length: n }, () => HEX[int(0, HEX.length - 1)]).join('')

export const cluster: ClusterInfo = {
  name: 'prod-shanghai-01',
  version: 'v1.29.3',
  provider: '自建 · kubeadm',
  region: 'cn-east-2 / 上海',
  apiServer: 'https://10.12.0.4:6443',
  ageDays: 412,
}

export const namespaces = [
  'production',
  'staging',
  'dev',
  'monitoring',
  'kube-system',
  'default',
]

// ---------------------------------------------------------------- Nodes
const nodeSeed: {
  name: string
  roles: string[]
  pool: string
  cpuCores: number
  memoryGiB: number
  status: NodeItem['status']
  cpuUsage: number
  memoryUsage: number
  diskUsage: number
}[] = [
  { name: 'kp-master-01', roles: ['control-plane', 'master'], pool: 'system', cpuCores: 16, memoryGiB: 64, status: 'Ready', cpuUsage: 23, memoryUsage: 41, diskUsage: 38 },
  { name: 'kp-node-01', roles: ['worker'], pool: 'general', cpuCores: 32, memoryGiB: 128, status: 'Ready', cpuUsage: 64, memoryUsage: 71, diskUsage: 52 },
  { name: 'kp-node-02', roles: ['worker'], pool: 'general', cpuCores: 32, memoryGiB: 128, status: 'Ready', cpuUsage: 48, memoryUsage: 59, diskUsage: 44 },
  { name: 'kp-node-03', roles: ['worker'], pool: 'compute', cpuCores: 16, memoryGiB: 64, status: 'Ready', cpuUsage: 78, memoryUsage: 82, diskUsage: 67 },
  { name: 'kp-node-04', roles: ['worker'], pool: 'compute', cpuCores: 16, memoryGiB: 64, status: 'Ready', cpuUsage: 31, memoryUsage: 46, diskUsage: 35 },
  { name: 'kp-node-05', roles: ['worker'], pool: 'general', cpuCores: 8, memoryGiB: 32, status: 'NotReady', cpuUsage: 12, memoryUsage: 28, diskUsage: 61 },
]

const nodes: NodeItem[] = nodeSeed.map((n, i) => ({
  ...n,
  nodePool: n.pool,
  version: `v1.29.${3 - (i % 2)}`,
  internalIP: `10.12.0.${11 + i}`,
  os: 'Ubuntu 22.04.4 LTS',
  kernel: '5.15.0-105-generic',
  runtime: 'containerd://1.7.13',
  pods: 0,
  podCapacity: n.roles.includes('master') ? 110 : 250,
  ageMinutes: 412 * 24 * 60 - i * 60 * 37,
  conditions: [
    { type: 'MemoryPressure', status: n.memoryUsage > 80 ? 'True' : 'False', reason: n.memoryUsage > 80 ? 'KubeletHasInsufficientMemory' : 'KubeletHasSufficientMemory' },
    { type: 'DiskPressure', status: n.diskUsage > 85 ? 'True' : 'False', reason: 'KubeletHasNoDiskPressure' },
    { type: 'PIDPressure', status: 'False', reason: 'KubeletHasSufficientPID' },
    { type: 'Ready', status: n.status === 'Ready' ? 'True' : 'Unknown', reason: n.status === 'Ready' ? 'KubeletReady' : 'NodeStatusUnknown' },
  ],
  taints: n.roles.includes('master') ? ['node-role.kubernetes.io/control-plane:NoSchedule'] : [],
}))

// ---------------------------------------------------------------- Workloads
const repository = 'registry.kubepilot.io'

const wl = (
  namespace: string,
  name: string,
  kind: WorkloadKind,
  image: string,
  replicas: number,
  opts: Partial<Workload> = {},
): Workload => {
  const status = opts.status ?? 'Healthy'
  const ready = opts.ready ?? (status === 'Degraded' ? Math.max(replicas - 1, 0) : status === 'Progressing' ? Math.max(replicas - 2, 0) : replicas)
  const container: Container = {
    name: name.replace(/-service$/, '').replace(/-/g, '-'),
    image,
    ready: status !== 'Degraded',
    restarts: status === 'Degraded' ? 7 : 0,
    state: status === 'Degraded' ? 'CrashLoopBackOff' : 'Running',
    ports: [int(8000, 9090)],
    cpuRequest: pick(['100m', '250m', '500m', '1']),
    memRequest: pick(['128Mi', '256Mi', '512Mi']),
    cpuLimit: pick(['500m', '1', '2']),
    memLimit: pick(['512Mi', '1Gi', '2Gi']),
    probe: 'httpGet /healthz :8080',
  }
  return {
    namespace,
    name,
    kind,
    replicas,
    ready,
    updated: replicas,
    available: ready,
    image,
    strategy:
      kind === 'Deployment'
        ? 'RollingUpdate (maxSurge 25% / maxUnavailable 25%)'
        : kind === 'StatefulSet'
          ? 'RollingUpdate (partition 0)'
          : 'OnDelete',
    revision: kind === 'Deployment' ? int(2, 46) : 1,
    status,
    cpu: Math.round(replicas * (120 + rnd() * 380)),
    memory: Math.round(replicas * (180 + rnd() * 420)),
    ageMinutes: int(2, 300) * 24 * 60 + int(0, 600),
    selector: { app: name, 'app.kubernetes.io/name': name },
    containers: [container],
    conditions: [
      { type: 'Available', status: ready > 0 ? 'True' : 'False', reason: 'MinimumReplicasAvailable', updated: '2m ago' },
      { type: 'Progressing', status: 'True', reason: status === 'Progressing' ? 'ReplicaSetUpdated' : 'NewReplicaSetAvailable', updated: '2m ago' },
    ],
    ...opts,
  }
}

const workloads: Workload[] = [
  wl('production', 'api-gateway', 'Deployment', `${repository}/api-gateway:v2.14.3`, 6),
  wl('production', 'user-service', 'Deployment', `${repository}/user-service:v1.8.0`, 4),
  wl('production', 'order-service', 'Deployment', `${repository}/order-service:v3.2.1`, 5),
  wl('production', 'payment-service', 'Deployment', `${repository}/payment-service:v1.2.9`, 3),
  wl('production', 'frontend-web', 'Deployment', `${repository}/frontend-web:v4.0.2`, 4),
  wl('production', 'recommend-engine', 'Deployment', `${repository}/recommend-engine:v0.9.4`, 2, { status: 'Progressing', ready: 1 }),
  wl('staging', 'api-gateway', 'Deployment', `${repository}/api-gateway:v2.15.0-rc.1`, 2),
  wl('staging', 'order-service', 'Deployment', `${repository}/order-service:v3.2.0`, 2, { status: 'Degraded', ready: 1 }),
  wl('dev', 'user-service', 'Deployment', `${repository}/user-service:v1.9.0-dev`, 1),
  wl('monitoring', 'prometheus', 'Deployment', 'prom/prometheus:v2.51.1', 1),
  wl('monitoring', 'grafana', 'Deployment', 'grafana/grafana:10.4.1', 1),
  wl('kube-system', 'coredns', 'Deployment', 'registry.k8s.io/coredns/coredns:v1.11.1', 2),
  wl('kube-system', 'metrics-server', 'Deployment', 'registry.k8s.io/metrics-server/metrics-server:v0.7.0', 1),
  wl('production', 'redis-cluster', 'StatefulSet', 'redis:7.2.4-alpine', 3),
  wl('production', 'kafka', 'StatefulSet', 'bitnami/kafka:3.6.1', 3),
  wl('production', 'elasticsearch', 'StatefulSet', 'docker.elastic.co/elasticsearch/elasticsearch:8.12.2', 3),
  wl('dev', 'mysql-primary', 'StatefulSet', 'mysql:8.0.36', 1, { status: 'Stopped', replicas: 1, ready: 0 }),
  wl('kube-system', 'node-exporter', 'DaemonSet', 'prom/node-exporter:v1.7.0', 6),
  wl('monitoring', 'fluent-bit', 'DaemonSet', 'cr.fluentbit.io/fluent/fluent-bit:1.9.10', 6),
  wl('kube-system', 'kube-proxy', 'DaemonSet', 'registry.k8s.io/kube-proxy:v1.29.3', 6),
]

// ---------------------------------------------------------------- Pods
const podName = (w: Workload, i: number) =>
  w.kind === 'StatefulSet' ? `${w.name}-${i}` : `${w.name}-${hash(6)}-${hash(5)}`

const pods: Pod[] = []

workloads.forEach((w) => {
  const count = w.kind === 'DaemonSet' ? nodes.length : w.replicas
  for (let i = 0; i < count; i++) {
    const isBroken = w.status === 'Degraded' && i === count - 1
    const isPending = w.status === 'Progressing' && i === count - 1
    const node = w.kind === 'DaemonSet' ? nodes[i].name : pick(nodes.slice(0, 5)).name
    pods.push({
      name: podName(w, i),
      namespace: w.namespace,
      phase: w.status === 'Stopped' ? 'Terminating' : isBroken ? 'Unknown' : isPending ? 'Pending' : 'Running',
      reason: isBroken ? 'CrashLoopBackOff' : isPending ? 'ContainerCreating' : undefined,
      node,
      podIP: `10.244.${int(1, 12)}.${int(4, 250)}`,
      hostIP: nodes.find((n) => n.name === node)?.internalIP ?? '10.12.0.11',
      ownerKind: w.kind,
      ownerName: w.name,
      qos: pick(['Burstable', 'Guaranteed', 'Burstable']),
      restarts: isBroken ? int(5, 24) : rnd() > 0.82 ? int(1, 3) : 0,
      cpu: Math.round(40 + rnd() * 420),
      memory: Math.round(80 + rnd() * 620),
      // Pod 生命周期通常远短于控制器：控制在 3 天内，异常 Pod 更“年轻”
      ageMinutes: isBroken ? int(3, 90) : int(2, 60 * 24 * 3),
      containers: w.containers.map((c) => ({ ...c, ready: !isBroken && !isPending })),
      labels: { app: w.name, 'pod-template-hash': hash(9) },
    })
  }
})

// 静态 Pod（控制面）
;['kube-apiserver', 'etcd', 'kube-scheduler', 'kube-controller-manager'].forEach((n, i) => {
  pods.push({
    name: `${n}-kp-master-01`,
    namespace: 'kube-system',
    phase: 'Running',
    node: 'kp-master-01',
    podIP: `10.244.0.${10 + i}`,
    hostIP: '10.12.0.11',
    ownerKind: 'Static',
    ownerName: 'kubelet',
    qos: 'Guaranteed',
    restarts: 0,
    cpu: int(60, 240),
    memory: int(120, 900),
    ageMinutes: 412 * 24 * 60,
    containers: [
      {
        name: n,
        image: `registry.k8s.io/${n}:v1.29.3`,
        ready: true,
        restarts: 0,
        state: 'Running',
        ports: [6443],
        cpuRequest: '250m',
        memRequest: '512Mi',
        cpuLimit: '1',
        memLimit: '2Gi',
      },
    ],
    labels: { component: n, tier: 'control-plane' },
  })
})

nodes.forEach((n) => {
  n.pods = pods.filter((p) => p.node === n.name).length
})

// ---------------------------------------------------------------- Services
const services: ServiceItem[] = workloads
  .filter((w) => w.kind !== 'DaemonSet')
  .map((w) => {
    const isPublic = w.name === 'frontend-web' || w.name === 'api-gateway'
    return {
      name: w.name,
      namespace: w.namespace,
      type: w.name === 'api-gateway' && w.namespace === 'production' ? 'LoadBalancer' : isPublic ? 'NodePort' : 'ClusterIP',
      clusterIP: `10.96.${int(1, 250)}.${int(2, 250)}`,
      externalIP:
        w.name === 'api-gateway' && w.namespace === 'production'
          ? '47.100.32.18'
          : w.name === 'frontend-web'
            ? '<none>'
            : '<none>',
      ports: [
        {
          name: 'http',
          port: 80,
          targetPort: w.containers[0].ports[0],
          protocol: 'TCP',
        },
      ],
      selector: { app: w.name },
      ageMinutes: w.ageMinutes,
      endpoints: w.ready,
    }
  })

services.push({
  name: 'kubernetes',
  namespace: 'default',
  type: 'ClusterIP',
  clusterIP: '10.96.0.1',
  externalIP: '<none>',
  ports: [{ name: 'https', port: 443, targetPort: 6443, protocol: 'TCP' }],
  selector: {},
  ageMinutes: 412 * 24 * 60,
  endpoints: 1,
})

services.push({
  name: 'kube-dns',
  namespace: 'kube-system',
  type: 'ClusterIP',
  clusterIP: '10.96.0.10',
  externalIP: '<none>',
  ports: [
    { name: 'dns', port: 53, targetPort: 53, protocol: 'UDP' },
    { name: 'dns-tcp', port: 53, targetPort: 53, protocol: 'TCP' },
  ],
  selector: { 'k8s-app': 'kube-dns' },
  ageMinutes: 412 * 24 * 60,
  endpoints: 2,
})

// ---------------------------------------------------------------- Ingress
const ingresses: IngressItem[] = [
  {
    name: 'frontend-web',
    namespace: 'production',
    className: 'nginx',
    hosts: [{ host: 'app.kubepilot.io', path: '/', service: 'frontend-web', port: 80 }],
    tls: true,
    ageMinutes: 96 * 24 * 60,
    status: 'Active',
  },
  {
    name: 'api-gateway',
    namespace: 'production',
    className: 'nginx',
    hosts: [
      { host: 'api.kubepilot.io', path: '/v1', service: 'api-gateway', port: 80 },
      { host: 'api.kubepilot.io', path: '/v2', service: 'api-gateway', port: 80 },
    ],
    tls: true,
    ageMinutes: 96 * 24 * 60,
    status: 'Active',
  },
  {
    name: 'grafana',
    namespace: 'monitoring',
    className: 'nginx',
    hosts: [{ host: 'grafana.kubepilot.io', path: '/', service: 'grafana', port: 80 }],
    tls: false,
    ageMinutes: 180 * 24 * 60,
    status: 'Active',
  },
  {
    name: 'staging-gateway',
    namespace: 'staging',
    className: 'nginx',
    hosts: [{ host: 'staging.kubepilot.io', path: '/', service: 'api-gateway', port: 80 }],
    tls: false,
    ageMinutes: 12 * 60,
    status: 'Pending',
  },
]

// ---------------------------------------------------------------- Config & Secrets
const configmaps: ConfigItem[] = [
  {
    name: 'gateway-config',
    namespace: 'production',
    ageMinutes: 120 * 24 * 60,
    immutable: false,
    keys: [
      { key: 'UPSTREAM_TIMEOUT', value: '30s' },
      { key: 'RATE_LIMIT_QPS', value: '2000' },
      { key: 'LOG_LEVEL', value: 'info' },
      { key: 'TRACE_ENDPOINT', value: 'http://otel-collector:4317' },
    ],
  },
  {
    name: 'order-service-config',
    namespace: 'production',
    ageMinutes: 88 * 24 * 60,
    immutable: false,
    keys: [
      { key: 'DB_POOL_SIZE', value: '40' },
      { key: 'KAFKA_BROKERS', value: 'kafka-0.kafka:9092,kafka-1.kafka:9092' },
    ],
  },
  {
    name: 'frontend-runtime',
    namespace: 'production',
    ageMinutes: 30 * 24 * 60,
    immutable: true,
    keys: [
      { key: 'config.js', value: 'window.__APP_CONFIG__={apiBase:"/v1",env:"prod"}' },
      { key: 'feature-flags.json', value: '{"newCheckout":true,"darkMode":false}' },
    ],
  },
  {
    name: 'coredns',
    namespace: 'kube-system',
    ageMinutes: 412 * 24 * 60,
    immutable: false,
    keys: [{ key: 'Corefile', value: '.:53 {\n  errors\n  health\n  ready\n  kubernetes cluster.local\n  forward . /etc/resolv.conf\n}' }],
  },
  {
    name: 'grafana-datasources',
    namespace: 'monitoring',
    ageMinutes: 180 * 24 * 60,
    immutable: false,
    keys: [{ key: 'prometheus.yaml', value: 'apiVersion: 1\ndatasources:\n  - name: Prometheus\n    url: http://prometheus:9090' }],
  },
  {
    name: 'staging-config',
    namespace: 'staging',
    ageMinutes: 14 * 24 * 60,
    immutable: false,
    keys: [{ key: 'LOG_LEVEL', value: 'debug' }],
  },
]

const secrets: SecretItem[] = [
  {
    name: 'db-credentials',
    namespace: 'production',
    type: 'Opaque',
    ageMinutes: 200 * 24 * 60,
    keys: [
      { key: 'username', value: 'order_svc' },
      { key: 'password', value: 'Sk9hbkQ4c2VjcmV0ITIwMjY=' },
    ],
  },
  {
    name: 'payment-tls',
    namespace: 'production',
    type: 'kubernetes.io/tls',
    ageMinutes: 42 * 24 * 60,
    keys: [
      { key: 'tls.crt', value: 'LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSUM...' },
      { key: 'tls.key', value: 'LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tCk1JSUV2...' },
    ],
  },
  {
    name: 'registry-pull-secret',
    namespace: 'production',
    type: 'kubernetes.io/dockerconfigjson',
    ageMinutes: 300 * 24 * 60,
    keys: [{ key: '.dockerconfigjson', value: 'eyJhdXRocyI6eyJyZWdpc3RyeS5rdWJlcGlsb3QuaW8iOns...' }],
  },
  {
    name: 'grafana-admin',
    namespace: 'monitoring',
    type: 'Opaque',
    ageMinutes: 180 * 24 * 60,
    keys: [
      { key: 'admin-user', value: 'admin' },
      { key: 'admin-password', value: 'R3JhZmFuYUAyMDI2IQ==' },
    ],
  },
  {
    name: 'staging-registry',
    namespace: 'staging',
    type: 'kubernetes.io/dockerconfigjson',
    ageMinutes: 60 * 24 * 60,
    keys: [{ key: '.dockerconfigjson', value: 'eyJhdXRocyI6eyJyZWdpc3RyeS5rdWJlcGlsb3QuaW8iOns...' }],
  },
]

// ---------------------------------------------------------------- Storage
const pvcs: PVCItem[] = [
  { name: 'data-redis-cluster-0', namespace: 'production', status: 'Bound', volume: 'pv-0001', capacity: '50Gi', storageClass: 'ceph-rbd-ssd', accessModes: 'RWO', ageMinutes: 240 * 24 * 60, usedPercent: 62 },
  { name: 'data-redis-cluster-1', namespace: 'production', status: 'Bound', volume: 'pv-0002', capacity: '50Gi', storageClass: 'ceph-rbd-ssd', accessModes: 'RWO', ageMinutes: 240 * 24 * 60, usedPercent: 58 },
  { name: 'data-redis-cluster-2', namespace: 'production', status: 'Bound', volume: 'pv-0003', capacity: '50Gi', storageClass: 'ceph-rbd-ssd', accessModes: 'RWO', ageMinutes: 240 * 24 * 60, usedPercent: 54 },
  { name: 'data-kafka-0', namespace: 'production', status: 'Bound', volume: 'pv-0004', capacity: '200Gi', storageClass: 'ceph-rbd-ssd', accessModes: 'RWO', ageMinutes: 300 * 24 * 60, usedPercent: 71 },
  { name: 'data-kafka-1', namespace: 'production', status: 'Bound', volume: 'pv-0005', capacity: '200Gi', storageClass: 'ceph-rbd-ssd', accessModes: 'RWO', ageMinutes: 300 * 24 * 60, usedPercent: 66 },
  { name: 'data-kafka-2', namespace: 'production', status: 'Bound', volume: 'pv-0006', capacity: '200Gi', storageClass: 'ceph-rbd-ssd', accessModes: 'RWO', ageMinutes: 300 * 24 * 60, usedPercent: 74 },
  { name: 'prometheus-data', namespace: 'monitoring', status: 'Bound', volume: 'pv-0007', capacity: '500Gi', storageClass: 'ceph-rbd-hdd', accessModes: 'RWO', ageMinutes: 180 * 24 * 60, usedPercent: 83 },
  { name: 'mysql-data', namespace: 'dev', status: 'Pending', volume: '—', capacity: '20Gi', storageClass: 'local-path', accessModes: 'RWO', ageMinutes: 3 * 24 * 60, usedPercent: 0 },
]

const pvs: PVItem[] = pvcs
  .filter((p) => p.status === 'Bound')
  .map((p, i) => ({
    name: p.volume,
    capacity: p.capacity,
    storageClass: p.storageClass,
    accessModes: p.accessModes,
    reclaimPolicy: i % 4 === 3 ? 'Delete' : 'Retain',
    status: 'Bound',
    claim: `${p.namespace}/${p.name}`,
    ageMinutes: p.ageMinutes,
  }))

pvs.push({
  name: 'pv-0008',
  capacity: '1Ti',
  storageClass: 'ceph-rbd-hdd',
  accessModes: 'RWO',
  reclaimPolicy: 'Retain',
  status: 'Available',
  claim: '—',
  ageMinutes: 90 * 24 * 60,
})

// ---------------------------------------------------------------- Events
const events: EventItem[] = [
  { id: 'e1', type: 'Warning', reason: 'BackOff', object: 'order-service-7d9f6c-x4klm', kind: 'Pod', namespace: 'staging', message: 'Back-off restarting failed container order-service in pod order-service-7d9f6c-x4klm_staging', count: 14, lastSeenMinutes: 2, source: 'kubelet' },
  { id: 'e2', type: 'Warning', reason: 'Unhealthy', object: 'payment-service-5b8c9d-hh2qp', kind: 'Pod', namespace: 'production', message: 'Readiness probe failed: HTTP probe failed with statuscode: 503', count: 3, lastSeenMinutes: 6, source: 'kubelet' },
  { id: 'e3', type: 'Warning', reason: 'FailedScheduling', object: 'mysql-primary-0', kind: 'Pod', namespace: 'dev', message: '0/6 nodes are available: pod has unbound immediate PersistentVolumeClaims.', count: 22, lastSeenMinutes: 9, source: 'default-scheduler' },
  { id: 'e4', type: 'Normal', reason: 'ScalingReplicaSet', object: 'api-gateway', kind: 'Deployment', namespace: 'production', message: 'Scaled up replica set api-gateway-6f8b7 to 6', count: 1, lastSeenMinutes: 14, source: 'deployment-controller' },
  { id: 'e5', type: 'Normal', reason: 'Pulled', object: 'recommend-engine-84c7d9-pp9xs', kind: 'Pod', namespace: 'production', message: 'Successfully pulled image "registry.kubepilot.io/recommend-engine:v0.9.4"', count: 1, lastSeenMinutes: 21, source: 'kubelet' },
  { id: 'e6', type: 'Warning', reason: 'NodeNotReady', object: 'kp-node-05', kind: 'Node', namespace: '—', message: 'Node kp-node-05 status is now: NodeNotReady', count: 1, lastSeenMinutes: 26, source: 'node-controller' },
  { id: 'e7', type: 'Normal', reason: 'Scheduled', object: 'frontend-web-6c5b8f-w8nzt', kind: 'Pod', namespace: 'production', message: 'Successfully assigned production/frontend-web-6c5b8f-w8nzt to kp-node-02', count: 1, lastSeenMinutes: 33, source: 'default-scheduler' },
  { id: 'e8', type: 'Normal', reason: 'Created', object: 'grafana', kind: 'Deployment', namespace: 'monitoring', message: 'Created replica set grafana-7f6d9c', count: 1, lastSeenMinutes: 48, source: 'deployment-controller' },
  { id: 'e9', type: 'Warning', reason: 'FailedMount', object: 'elasticsearch-2', kind: 'Pod', namespace: 'production', message: 'MountVolume.SetUp failed for volume "data-elasticsearch-2": rbd: image not found', count: 5, lastSeenMinutes: 55, source: 'kubelet' },
  { id: 'e10', type: 'Normal', reason: 'SuccessfulCreate', object: 'kafka', kind: 'StatefulSet', namespace: 'production', message: 'create Pod kafka-2 in StatefulSet kafka successful', count: 1, lastSeenMinutes: 72, source: 'statefulset-controller' },
  { id: 'e11', type: 'Warning', reason: 'Evicted', object: 'batch-job-9xl2m', kind: 'Pod', namespace: 'dev', message: 'The node was low on resource: memory. Threshold quantity: 100Mi, available: 32Mi.', count: 2, lastSeenMinutes: 96, source: 'kubelet' },
  { id: 'e12', type: 'Normal', reason: 'Pulling', object: 'api-gateway-6f8b7-k2m4p', kind: 'Pod', namespace: 'staging', message: 'Pulling image "registry.kubepilot.io/api-gateway:v2.15.0-rc.1"', count: 1, lastSeenMinutes: 110, source: 'kubelet' },
  { id: 'e13', type: 'Normal', reason: 'LeaderElection', object: 'kube-scheduler-kp-master-01', kind: 'Pod', namespace: 'kube-system', message: 'kp-master-01_9a2f1c became leader', count: 1, lastSeenMinutes: 140, source: 'kube-scheduler' },
  { id: 'e14', type: 'Normal', reason: 'UpdatedLoadBalancer', object: 'api-gateway', kind: 'Service', namespace: 'production', message: 'Updated load balancer with new hosts', count: 1, lastSeenMinutes: 168, source: 'service-controller' },
]

// ---------------------------------------------------------------- Metrics series
const series = (base: number, spread: number, drift: number): SeriesPoint[] => {
  const out: SeriesPoint[] = []
  let v = base
  for (let i = 47; i >= 0; i--) {
    v += (rnd() - 0.45) * spread + drift * (i < 12 ? 0.4 : 0)
    v = Math.max(base * 0.62, Math.min(base * 1.42, v))
    out.push({ t: Date.now() - i * 5 * 60 * 1000, v: Math.round(v * 10) / 10 })
  }
  return out
}

export function buildInitialState(): ClusterState {
  return {
    cluster,
    nodes,
    workloads,
    pods,
    services,
    ingresses,
    configmaps,
    secrets,
    pvcs,
    pvs,
    events,
    cpuSeries: series(52, 4.2, 0.18),
    memSeries: series(63, 3.1, 0.12),
    ioSeries: series(28, 6.4, 0.05),
    namespace: '__all__',
  }
}

export { nodes as nodeSeedData, workloads as workloadSeed }
