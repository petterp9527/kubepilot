import { useSyncExternalStore } from 'react'
import type { ClusterState, EventItem, Pod, Workload, WorkloadKind } from './types'
import { buildInitialState } from './mock/data'
import { ALL_NS } from './lib/utils'

let state: ClusterState = buildInitialState()
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

export function useCluster(): ClusterState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  )
}

export function getState() {
  return state
}

function patch(next: Partial<ClusterState>) {
  state = { ...state, ...next }
  emit()
}

const rid = () => Math.random().toString(36).slice(2, 9)

function newPod(w: Workload, name: string): Pod {
  return {
    name,
    namespace: w.namespace,
    phase: 'Pending',
    reason: 'ContainerCreating',
    node: 'kp-node-02',
    podIP: `10.244.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 250)}`,
    hostIP: '10.12.0.13',
    ownerKind: w.kind,
    ownerName: w.name,
    qos: 'Burstable',
    restarts: 0,
    cpu: Math.floor(80 + Math.random() * 300),
    memory: Math.floor(120 + Math.random() * 400),
    ageMinutes: 0.2,
    containers: w.containers.map((c) => ({ ...c, ready: false, state: 'ContainerCreating', restarts: 0 })),
    labels: { app: w.name, 'pod-template-hash': rid() },
  }
}

function pushEvent(e: Omit<EventItem, 'id'>) {
  return { ...e, id: rid() }
}

// ------------------------------------------------------------ actions
export const actions = {
  setNamespace(ns: string) {
    patch({ namespace: ns })
  },

  scale(name: string, namespace: string, kind: WorkloadKind, replicas: number) {
    const target = state.workloads.find(
      (w) => w.name === name && w.namespace === namespace && w.kind === kind,
    )
    if (!target) return
    const nextWorkloads = state.workloads.map((w) =>
      w === target
        ? {
            ...w,
            replicas,
            ready: replicas,
            updated: replicas,
            available: replicas,
            status: replicas === 0 ? ('Stopped' as const) : ('Healthy' as const),
            revision: w.revision + 1,
          }
        : w,
    )

    const others = state.pods.filter(
      (p) => !(p.ownerName === name && p.namespace === namespace && p.ownerKind === kind),
    )
    const existing = state.pods.filter(
      (p) => p.ownerName === name && p.namespace === namespace && p.ownerKind === kind,
    )
    const keep = existing.slice(0, replicas)
    const extras = Array.from({ length: Math.max(0, replicas - keep.length) }, () =>
      newPod(target, `${name}-${rid()}-${rid().slice(0, 5)}`),
    )

    patch({
      workloads: nextWorkloads,
      pods: [...others, ...keep, ...extras],
      events: [
        pushEvent({
          type: 'Normal',
          reason: 'ScalingReplicaSet',
          object: name,
          kind,
          namespace,
          message: `Scaled ${kind === 'Deployment' ? 'replica set' : 'stateful set'} ${name} to ${replicas}`,
          count: 1,
          lastSeenMinutes: 0,
          source: 'deployment-controller',
        }),
        ...state.events,
      ],
    })
  },

  restart(name: string, namespace: string, kind: WorkloadKind) {
    const bump = (w: Workload) =>
      w.name === name && w.namespace === namespace && w.kind === kind
        ? { ...w, status: 'Progressing' as const, revision: w.revision + 1, ready: Math.max(w.replicas - 1, 0) }
        : w

    patch({
      workloads: state.workloads.map(bump),
      pods: state.pods.map((p) =>
        p.ownerName === name && p.namespace === namespace ? { ...p, ageMinutes: 0.1, restarts: p.restarts + 1 } : p,
      ),
      events: [
        pushEvent({
          type: 'Normal',
          reason: 'ScalingReplicaSet',
          object: name,
          kind,
          namespace,
          message: `Rolling restart triggered for ${kind} ${name}`,
          count: 1,
          lastSeenMinutes: 0,
          source: 'kubepilot',
        }),
        ...state.events,
      ],
    })

    window.setTimeout(() => {
      const settled = state.workloads.map((w) =>
        w.name === name && w.namespace === namespace && w.kind === kind
          ? { ...w, status: 'Healthy' as const, ready: w.replicas, updated: w.replicas, available: w.replicas }
          : w,
      )
      const readyPods = state.pods.map((p) =>
        p.ownerName === name && p.namespace === namespace
          ? { ...p, phase: 'Running' as const, reason: undefined, containers: p.containers.map((c) => ({ ...c, ready: true, state: 'Running' })) }
          : p,
      )
      patch({ workloads: settled, pods: readyPods })
    }, 2600)
  },

  deleteWorkload(name: string, namespace: string, kind: WorkloadKind) {
    patch({
      workloads: state.workloads.filter((w) => !(w.name === name && w.namespace === namespace && w.kind === kind)),
      pods: state.pods.filter((p) => !(p.ownerName === name && p.namespace === namespace && p.ownerKind === kind)),
      events: [
        pushEvent({
          type: 'Normal',
          reason: 'Killing',
          object: name,
          kind,
          namespace,
          message: `Stopping container ${name}; ${kind} deleted by user`,
          count: 1,
          lastSeenMinutes: 0,
          source: 'kubepilot',
        }),
        ...state.events,
      ],
    })
  },

  deletePod(name: string, namespace: string) {
    const pod = state.pods.find((p) => p.name === name && p.namespace === namespace)
    if (!pod) return
    const nextPods = state.pods.filter((p) => !(p.name === name && p.namespace === namespace))
    patch({
      pods: nextPods,
      workloads: state.workloads.map((w) =>
        w.name === pod.ownerName && w.namespace === namespace
          ? { ...w, ready: Math.max(w.ready - 1, 0) }
          : w,
      ),
      events: [
        pushEvent({
          type: 'Normal',
          reason: 'Killing',
          object: name,
          kind: 'Pod',
          namespace,
          message: `Stopping container ${pod.containers[0]?.name ?? name}`,
          count: 1,
          lastSeenMinutes: 0,
          source: 'kubepilot',
        }),
        ...state.events,
      ],
    })
  },

  applyWorkload(name: string, namespace: string, kind: WorkloadKind, yaml: string) {
    patch({
      workloads: state.workloads.map((w) =>
        w.name === name && w.namespace === namespace && w.kind === kind
          ? { ...w, revision: w.revision + 1, status: 'Progressing' as const }
          : w,
      ),
      events: [
        pushEvent({
          type: 'Normal',
          reason: 'Applied',
          object: name,
          kind,
          namespace,
          message: `kubectl apply -f (${yaml.split('\n').length} lines) applied by user`,
          count: 1,
          lastSeenMinutes: 0,
          source: 'kubepilot',
        }),
        ...state.events,
      ],
    })
    window.setTimeout(() => {
      patch({
        workloads: state.workloads.map((w) =>
          w.name === name && w.namespace === namespace && w.kind === kind
            ? { ...w, status: 'Healthy' as const, ready: w.replicas }
            : w,
        ),
      })
    }, 2200)
  },

  createWorkload(payload: { name: string; namespace: string; replicas: number; image: string; kind: WorkloadKind }) {
    const now = Date.now()
    const w: Workload = {
      name: payload.name,
      namespace: payload.namespace,
      kind: payload.kind,
      replicas: payload.replicas,
      ready: payload.replicas,
      updated: payload.replicas,
      available: payload.replicas,
      image: payload.image,
      strategy: 'RollingUpdate (maxSurge 25% / maxUnavailable 25%)',
      revision: 1,
      status: 'Progressing',
      cpu: payload.replicas * 180,
      memory: payload.replicas * 260,
      ageMinutes: 0.1,
      selector: { app: payload.name, 'app.kubernetes.io/name': payload.name },
      containers: [
        {
          name: payload.name,
          image: payload.image,
          ready: true,
          restarts: 0,
          state: 'Running',
          ports: [8080],
          cpuRequest: '100m',
          memRequest: '128Mi',
          cpuLimit: '500m',
          memLimit: '512Mi',
        },
      ],
      conditions: [{ type: 'Available', status: 'True', reason: 'MinimumReplicasAvailable', updated: 'just now' }],
    }
    const newPods: Pod[] = Array.from({ length: payload.replicas }, (_, i) => ({
      name: `${payload.name}-${rid()}-${rid().slice(0, 5)}`,
      namespace: payload.namespace,
      phase: 'Running' as const,
      node: 'kp-node-01',
      podIP: `10.244.${Math.floor(Math.random() * 12)}.${10 + i}`,
      hostIP: '10.12.0.12',
      ownerKind: payload.kind,
      ownerName: payload.name,
      qos: 'Burstable',
      restarts: 0,
      cpu: 90,
      memory: 140,
      ageMinutes: 0.1,
      containers: w.containers.map((c) => ({ ...c })),
      labels: { app: payload.name, 'pod-template-hash': rid() },
    }))

    patch({
      workloads: [w, ...state.workloads],
      pods: [...newPods, ...state.pods],
      events: [
        pushEvent({
          type: 'Normal',
          reason: 'SuccessfulCreate',
          object: payload.name,
          kind: payload.kind,
          namespace: payload.namespace,
          message: `Created ${payload.kind} ${payload.name} with ${payload.replicas} replicas`,
          count: 1,
          lastSeenMinutes: 0,
          source: 'kubepilot',
        }),
        ...state.events,
      ],
    })
    window.setTimeout(() => {
      patch({
        workloads: state.workloads.map((x) =>
          x.name === payload.name && x.namespace === payload.namespace ? { ...x, status: 'Healthy' as const } : x,
        ),
      })
    }, 2400)
    void now
  },

  refresh() {
    const shift = (pts: ClusterState['cpuSeries'], spread: number) => {
      const last = pts[pts.length - 1].v
      const next = Math.max(20, Math.min(92, last + (Math.random() - 0.5) * spread))
      return [...pts.slice(1), { t: Date.now(), v: Math.round(next * 10) / 10 }]
    }
    patch({
      cpuSeries: shift(state.cpuSeries, 7),
      memSeries: shift(state.memSeries, 4),
      ioSeries: shift(state.ioSeries, 9),
      nodes: state.nodes.map((n) => ({
        ...n,
        cpuUsage: Math.max(8, Math.min(96, n.cpuUsage + Math.round((Math.random() - 0.5) * 6))),
        memoryUsage: Math.max(10, Math.min(96, n.memoryUsage + Math.round((Math.random() - 0.5) * 4))),
      })),
    })
  },
}

// ------------------------------------------------------------ toasts
export type ToastTone = 'success' | 'info' | 'danger'
export interface Toast {
  id: string
  message: string
  tone: ToastTone
}

let toasts: Toast[] = []
const toastListeners = new Set<() => void>()

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (l) => {
      toastListeners.add(l)
      return () => {
        toastListeners.delete(l)
      }
    },
    () => toasts,
    () => toasts,
  )
}

export function toast(message: string, tone: ToastTone = 'success') {
  const t: Toast = { id: rid(), message, tone }
  toasts = [...toasts, t]
  toastListeners.forEach((l) => l())
  window.setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id)
    toastListeners.forEach((l) => l())
  }, 3200)
}

export { ALL_NS }
