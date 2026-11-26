/** KubePilot 领域模型（v0.1 Mock 数据契约，后续可直接映射 K8s API 对象） */

export type WorkloadKind = 'Deployment' | 'StatefulSet' | 'DaemonSet';

export type PodPhase =
  | 'Running'
  | 'Pending'
  | 'Failed'
  | 'Succeeded'
  | 'Unknown'
  | 'Terminating';

export interface Container {
  name: string;
  image: string;
  ready: boolean;
  restarts: number;
  state: string;
  ports: number[];
  cpuRequest: string;
  memRequest: string;
  cpuLimit: string;
  memLimit: string;
  probe?: string;
}

export interface Pod {
  name: string;
  namespace: string;
  phase: PodPhase;
  reason?: string;
  node: string;
  podIP: string;
  hostIP: string;
  ownerKind: string;
  ownerName: string;
  qos: string;
  restarts: number;
  cpu: number; // millicores
  memory: number; // MiB
  ageMinutes: number;
  containers: Container[];
  labels: Record<string, string>;
}

export interface Workload {
  name: string;
  namespace: string;
  kind: WorkloadKind;
  replicas: number;
  ready: number;
  updated: number;
  available: number;
  image: string;
  strategy: string;
  revision: number;
  status: 'Healthy' | 'Progressing' | 'Degraded' | 'Stopped';
  cpu: number; // millicores
  memory: number; // MiB
  ageMinutes: number;
  selector: Record<string, string>;
  containers: Container[];
  conditions: { type: string; status: string; reason: string; updated: string }[];
}

export interface NodeCondition {
  type: string;
  status: 'True' | 'False' | 'Unknown';
  reason?: string;
}

export interface NodeItem {
  name: string;
  status: 'Ready' | 'NotReady' | 'SchedulingDisabled';
  roles: string[];
  version: string;
  internalIP: string;
  os: string;
  kernel: string;
  runtime: string;
  cpuCores: number;
  memoryGiB: number;
  cpuUsage: number; // 0-100
  memoryUsage: number;
  pods: number;
  podCapacity: number;
  diskUsage: number;
  ageMinutes: number;
  nodePool: string;
  conditions: NodeCondition[];
  taints: string[];
}

export interface ServicePort {
  name: string;
  port: number;
  targetPort: number;
  protocol: 'TCP' | 'UDP';
}

export interface ServiceItem {
  name: string;
  namespace: string;
  type: 'ClusterIP' | 'NodePort' | 'LoadBalancer' | 'ExternalName';
  clusterIP: string;
  externalIP: string;
  ports: ServicePort[];
  selector: Record<string, string>;
  ageMinutes: number;
  endpoints: number;
}

export interface IngressItem {
  name: string;
  namespace: string;
  className: string;
  hosts: { host: string; path: string; service: string; port: number }[];
  tls: boolean;
  ageMinutes: number;
  status: 'Active' | 'Pending';
}

export interface ConfigItem {
  name: string;
  namespace: string;
  keys: { key: string; value: string }[];
  ageMinutes: number;
  immutable: boolean;
}

export interface SecretItem {
  name: string;
  namespace: string;
  type: string;
  keys: { key: string; value: string }[];
  ageMinutes: number;
}

export interface PVCItem {
  name: string;
  namespace: string;
  status: 'Bound' | 'Pending' | 'Lost';
  volume: string;
  capacity: string;
  storageClass: string;
  accessModes: string;
  ageMinutes: number;
  usedPercent: number;
}

export interface PVItem {
  name: string;
  capacity: string;
  storageClass: string;
  accessModes: string;
  reclaimPolicy: 'Retain' | 'Delete';
  status: 'Bound' | 'Available' | 'Released';
  claim: string;
  ageMinutes: number;
}

export interface EventItem {
  id: string;
  type: 'Normal' | 'Warning';
  reason: string;
  object: string;
  kind: string;
  namespace: string;
  message: string;
  count: number;
  lastSeenMinutes: number;
  source: string;
}

export interface ClusterInfo {
  name: string;
  version: string;
  provider: string;
  region: string;
  apiServer: string;
  ageDays: number;
}

export interface SeriesPoint {
  t: number;
  v: number;
}

export interface ClusterState {
  cluster: ClusterInfo;
  nodes: NodeItem[];
  workloads: Workload[];
  pods: Pod[];
  services: ServiceItem[];
  ingresses: IngressItem[];
  configmaps: ConfigItem[];
  secrets: SecretItem[];
  pvcs: PVCItem[];
  pvs: PVItem[];
  events: EventItem[];
  cpuSeries: SeriesPoint[];
  memSeries: SeriesPoint[];
  ioSeries: SeriesPoint[];
  namespace: string;
}
