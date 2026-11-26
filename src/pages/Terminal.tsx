import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CircleDot, Eraser, SquareTerminal } from 'lucide-react'
import { useCluster } from '../store'
import type { Pod } from '../types'
import { cn, formatAge, statusText } from '../lib/utils'
import { Badge, Button, Card } from '../components/ui'
import { PageHeader } from '../components/PageHeader'

interface Line {
  kind: 'in' | 'out' | 'err' | 'sys'
  text: string
}

const pad = (s: string, n: number) => (s.length >= n ? s : s + ' '.repeat(n - s.length))

function podsTableLines(pods: Pod[], ns: string): string[] {
  const rows = pods.filter((p) => p.namespace === ns)
  const out = [
    `${pad('NAME', 44)}${pad('READY', 8)}${pad('STATUS', 12)}${pad('RESTARTS', 10)}${pad('AGE', 8)}IP`,
  ]
  rows.forEach((p) => {
    const ready = `${p.containers.filter((c) => c.ready).length}/${p.containers.length}`
    out.push(
      `${pad(p.name, 44)}${pad(ready, 8)}${pad(p.reason ?? statusText[p.phase], 12)}${pad(String(p.restarts), 10)}${pad(formatAge(p.ageMinutes), 8)}${p.podIP}`,
    )
  })
  out.push(`共 ${rows.length} 个 Pod（namespace=${ns}）`)
  return out
}

export default function Terminal() {
  const state = useCluster()
  const [params] = useSearchParams()
  const defaultNs = state.namespace === '__all__' ? 'production' : state.namespace
  const [lines, setLines] = useState<Line[]>(() => [
    { kind: 'sys', text: `KubePilot Web Terminal · kubectl v1.29.3 · cluster ${state.cluster.name}` },
    { kind: 'sys', text: '只读沙箱环境，输入 help 查看可用命令。' },
    { kind: 'sys', text: '' },
    { kind: 'in', text: `kubectl get pods -n ${defaultNs}` },
    ...podsTableLines(state.pods, defaultNs).map((text) => ({ kind: 'out' as const, text })),
    { kind: 'sys', text: '' },
  ])
  const [cmd, setCmd] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [hIdx, setHIdx] = useState(-1)
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const pod = params.get('pod')
    const ns = params.get('ns')
    if (pod) setCmd(`kubectl logs ${pod}${ns ? ` -n ${ns}` : ''}`)
  }, [params])

  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight
  }, [lines])

  const prompt = useMemo(() => `yubai@kubepilot:~$`, [])

  const run = (raw: string) => {
    const input = raw.trim()
    if (!input) return
    const next: Line[] = [{ kind: 'in', text: input }]
    const push = (text: string, kind: Line['kind'] = 'out') => next.push({ kind, text })

    const tokens = input.split(/\s+/)
    if (input === 'clear' || input === 'cls') {
      setLines([])
      setCmd('')
      setHistory((h) => [input, ...h])
      return
    }
    if (input === 'help') {
      push('可用命令：', 'sys')
      push('  kubectl get pods|nodes|deploy|svc|pvc|events [-n <namespace>]', 'out')
      push('  kubectl describe pod <name>', 'out')
      push('  kubectl logs <pod> [-n <namespace>]', 'out')
      push('  kubectl config current-context', 'out')
      push('  clear / help', 'out')
    } else if (tokens[0] !== 'kubectl') {
      push(`bash: ${tokens[0]}: command not found（试试 kubectl ... 或 help）`, 'err')
    } else {
      const nsIdx = tokens.findIndex((t) => t === '-n' || t === '--namespace')
      const ns = nsIdx > -1 ? tokens[nsIdx + 1] : defaultNs
      const verb = tokens[1]
      const res = tokens[2]

      if (verb === 'config' && res === 'current-context') {
        push(state.cluster.name)
      } else if (verb === 'get' && res) {
        if (res.startsWith('pod')) {
          const rows = state.pods.filter((p) => p.namespace === ns)
          push(`${pad('NAME', 44)}${pad('READY', 8)}${pad('STATUS', 12)}${pad('RESTARTS', 10)}${pad('AGE', 8)}IP`)
          rows.forEach((p) => {
            const ready = `${p.containers.filter((c) => c.ready).length}/${p.containers.length}`
            push(`${pad(p.name, 44)}${pad(ready, 8)}${pad(p.reason ?? statusText[p.phase], 12)}${pad(String(p.restarts), 10)}${pad(formatAge(p.ageMinutes), 8)}${p.podIP}`)
          })
          push(`共 ${rows.length} 个 Pod（namespace=${ns}）`, 'sys')
        } else if (res === 'nodes' || res === 'node' || res === 'no') {
          push(`${pad('NAME', 16)}${pad('STATUS', 12)}${pad('ROLES', 16)}${pad('VERSION', 12)}${pad('AGE', 8)}INTERNAL-IP`)
          state.nodes.forEach((n) => {
            push(`${pad(n.name, 16)}${pad(n.status, 12)}${pad(n.roles.join(','), 16)}${pad(n.version, 12)}${pad(formatAge(n.ageMinutes), 8)}${n.internalIP}`)
          })
        } else if (res.startsWith('deploy')) {
          const rows = state.workloads.filter((w) => w.kind === 'Deployment' && w.namespace === ns)
          push(`${pad('NAME', 30)}${pad('READY', 10)}${pad('UP-TO-DATE', 14)}${pad('AVAILABLE', 12)}AGE`)
          rows.forEach((w) => push(`${pad(w.name, 30)}${pad(`${w.ready}/${w.replicas}`, 10)}${pad(String(w.updated), 14)}${pad(String(w.available), 12)}${formatAge(w.ageMinutes)}`))
        } else if (res.startsWith('svc') || res === 'service') {
          const rows = state.services.filter((s) => s.namespace === ns)
          push(`${pad('NAME', 24)}${pad('TYPE', 16)}${pad('CLUSTER-IP', 16)}${pad('PORT(S)', 14)}AGE`)
          rows.forEach((s) => push(`${pad(s.name, 24)}${pad(s.type, 16)}${pad(s.clusterIP, 16)}${pad(String(s.ports[0].port), 14)}${formatAge(s.ageMinutes)}`))
        } else if (res.startsWith('pvc')) {
          const rows = state.pvcs.filter((p) => p.namespace === ns)
          push(`${pad('NAME', 26)}${pad('STATUS', 12)}${pad('VOLUME', 12)}${pad('CAPACITY', 12)}STORAGECLASS`)
          rows.forEach((p) => push(`${pad(p.name, 26)}${pad(p.status, 12)}${pad(p.volume, 12)}${pad(p.capacity, 12)}${p.storageClass}`))
        } else if (res.startsWith('event')) {
          const rows = state.events.filter((e) => e.namespace === ns)
          push(`${pad('LAST SEEN', 14)}${pad('TYPE', 10)}${pad('REASON', 24)}OBJECT`)
          rows.forEach((e) => push(`${pad(`${e.lastSeenMinutes}m`, 14)}${pad(e.type, 10)}${pad(e.reason, 24)}${e.object}`))
        } else {
          push(`error: the server doesn't have a resource type "${res}"`, 'err')
        }
      } else if (verb === 'describe' && res?.startsWith('pod')) {
        const name = tokens[3]
        const pod = state.pods.find((p) => p.name === name)
        if (!pod) {
          push(`Error from server (NotFound): pods "${name}" not found`, 'err')
        } else {
          push(`Name:         ${pod.name}`, 'out')
          push(`Namespace:    ${pod.namespace}`, 'out')
          push(`Node:         ${pod.node}`, 'out')
          push(`Status:       ${statusText[pod.phase]} (${pod.reason ?? '—'})`, 'out')
          push(`IP:           ${pod.podIP}`, 'out')
          push(`QoS Class:    ${pod.qos}`, 'out')
          push(`Containers:`, 'out')
          pod.containers.forEach((c) => {
            push(`  ${c.name}:`, 'out')
            push(`    Image:      ${c.image}`, 'out')
            push(`    Ready:      ${c.ready}`, 'out')
            push(`    Restarts:   ${c.restarts}`, 'out')
          })
          push(`Events: ${state.events.filter((e) => e.object.includes(pod.name)).length} related`, 'sys')
        }
      } else if (verb === 'logs') {
        const name = tokens[2]
        const pod = state.pods.find((p) => p.name === name)
        if (!pod) {
          push(`Error from server (NotFound): pods "${name}" not found`, 'err')
        } else {
          push(`2026-11-26T10:38:02.114Z INFO  [http] GET /healthz 200 1.7ms`, 'out')
          push(`2026-11-26T10:38:04.882Z INFO  container ${pod.containers[0].name} serving on :${pod.containers[0].ports[0]}`, 'out')
          push(`2026-11-26T10:38:09.301Z WARN  slow request GET /v1/orders took 1240ms`, 'out')
          push(`（完整日志请在 Pod 详情页查看）`, 'sys')
        }
      } else {
        push(`error: unknown command "kubectl ${tokens.slice(1).join(' ')}"，输入 help 查看示例`, 'err')
      }
    }

    setLines((prev) => [...prev, ...next])
    setHistory((h) => [input, ...h])
    setHIdx(-1)
    setCmd('')
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Web 终端"
        desc="在浏览器中执行只读 kubectl 命令，输出与当前集群 Mock 数据联动"
        actions={
          <Badge className="border-green-200 bg-success-soft text-success">
            <CircleDot size={10} className="mr-1" />
            已连接 {state.cluster.name}
          </Badge>
        }
      />

      <div className="flex flex-wrap gap-1.5">
        {[
          'kubectl get pods',
          'kubectl get nodes',
          'kubectl get deploy',
          'kubectl get svc',
          'kubectl get pvc',
          'kubectl config current-context',
          'help',
        ].map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              setCmd(c)
              inputRef.current?.focus()
            }}
            className="rounded-md border border-line bg-white px-2 py-1 font-mono text-[11px] text-muted transition-colors hover:border-blue-200 hover:text-brand"
          >
            {c}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden border-slate-800 bg-[#0b1220]">
        <div className="flex items-center gap-2 border-b border-slate-800 px-3 py-2">
          <SquareTerminal size={13} className="text-emerald-400" />
          <span className="font-mono text-[11.5px] text-slate-300">bash</span>
          <span className="text-slate-600">—</span>
          <span className="font-mono text-[11.5px] text-slate-400">{state.cluster.name}</span>
          <span className="ml-auto rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-px text-[10px] text-emerald-300">
            read-only
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            onClick={() => setLines([])}
          >
            <Eraser size={12} />
            清屏
          </Button>
        </div>

        <div
          ref={boxRef}
          className="h-[calc(100vh-340px)] min-h-[380px] cursor-text overflow-auto px-3.5 py-3 font-mono text-[11.5px] leading-[19px]"
          onClick={() => inputRef.current?.focus()}
        >
          {lines.map((l, i) => (
            <div
              key={i}
              className={cn(
                'whitespace-pre-wrap break-all',
                l.kind === 'in' && 'text-emerald-300',
                l.kind === 'out' && 'text-slate-300',
                l.kind === 'err' && 'text-rose-300',
                l.kind === 'sys' && 'text-slate-500',
              )}
            >
              {l.kind === 'in' ? `${prompt} ${l.text}` : l.text || '\u00A0'}
            </div>
          ))}
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-emerald-300">{prompt}</span>
            <input
              ref={inputRef}
              autoFocus
              value={cmd}
              onChange={(e) => setCmd(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') run(cmd)
                if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  const idx = Math.min(history.length - 1, hIdx + 1)
                  if (idx >= 0) {
                    setHIdx(idx)
                    setCmd(history[idx])
                  }
                }
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  const idx = Math.max(-1, hIdx - 1)
                  setHIdx(idx)
                  setCmd(idx === -1 ? '' : history[idx])
                }
              }}
              spellCheck={false}
              className="flex-1 bg-transparent font-mono text-[11.5px] text-slate-100 caret-emerald-400 outline-none"
            />
          </div>
        </div>
      </Card>

      <p className="px-1 text-[11px] text-muted">
        原型说明：命令解析在浏览器内完成，读取的是本地 Mock 集群状态；接入后端后可透传至真实 apiserver（只读 ServiceAccount + 命令白名单）。
      </p>
    </div>
  )
}
