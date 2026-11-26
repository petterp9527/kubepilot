import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import type { WorkloadKind } from '../types'
import { actions, toast } from '../store'
import { Button, Drawer, Field, inputClass, Tabs } from './ui'
import { YamlView } from './YamlView'
import { cn, deploymentTemplate, parseMeta } from '../lib/utils'

const NAME_RE = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/

export function CreateResourceButton({
  namespace,
  label = '创建资源',
}: {
  namespace: string
  label?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        <Plus size={14} />
        {label}
      </Button>
      <CreateResourceDrawer open={open} onClose={() => setOpen(false)} namespace={namespace} />
    </>
  )
}

export function CreateResourceDrawer({
  open,
  onClose,
  namespace,
}: {
  open: boolean
  onClose: () => void
  namespace: string
}) {
  const navigate = useNavigate()
  const [kind, setKind] = useState<WorkloadKind>('Deployment')
  const [name, setName] = useState('my-service')
  const [ns, setNs] = useState(namespace === '__all__' ? 'default' : namespace)
  const [replicas, setReplicas] = useState(2)
  const [image, setImage] = useState('registry.kubepilot.io/my-service:v0.1.0')
  const [manual, setManual] = useState(false)
  const [yamlText, setYamlText] = useState('')

  const generated = useMemo(() => {
    const base = deploymentTemplate(ns)
    return base
      .replace('kind: Deployment', `kind: ${kind}`)
      .replace('name: my-service\n  namespace', `name: ${name || 'my-service'}\n  namespace`)
      .replace('replicas: 2', `replicas: ${replicas}`)
      .replace('registry.kubepilot.io/my-service:v0.1.0', image || 'registry.kubepilot.io/my-service:latest')
  }, [kind, name, ns, replicas, image])

  useEffect(() => {
    if (open) {
      setNs(namespace === '__all__' ? 'default' : namespace)
      setManual(false)
    }
  }, [open, namespace])

  useEffect(() => {
    if (!manual) setYamlText(generated)
  }, [generated, manual])

  const nameValid = NAME_RE.test(name)
  const submit = () => {
    if (manual) {
      const meta = parseMeta(yamlText, ns)
      actions.createWorkload({
        kind,
        name: meta.name,
        namespace: meta.namespace,
        replicas: meta.replicas,
        image: meta.image,
      })
      toast(`${kind} ${meta.name} 已提交创建`)
      onClose()
      navigate(`/workloads/${kind.toLowerCase()}s/${meta.name}`)
      return
    }
    if (!nameValid) {
      toast('名称需符合 RFC 1123（小写字母、数字与中划线）', 'danger')
      return
    }
    actions.createWorkload({ kind, name, namespace: ns, replicas, image })
    toast(`${kind} ${name} 已提交创建`)
    onClose()
    navigate(`/workloads/${kind.toLowerCase()}s/${name}`)
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="创建资源"
      desc="以表单或 YAML 声明式创建，提交后立即出现在列表中"
      width="w-[680px]"
      footer={
        <>
          <span className="mr-auto text-[11px] text-muted">
            {manual ? 'YAML 模式：将解析 metadata.name / namespace' : `命名空间：${ns}`}
          </span>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button variant="primary" onClick={submit}>
            创建
          </Button>
        </>
      }
    >
      <div className="space-y-4 px-5 py-4">
        <Tabs
          tabs={[
            { key: 'Deployment', label: 'Deployment' },
            { key: 'StatefulSet', label: 'StatefulSet' },
          ]}
          value={kind}
          onChange={(k) => setKind(k as WorkloadKind)}
        />

        <div className="flex items-center justify-between">
          <span className="text-[12px] font-medium text-ink">基础信息</span>
          <button
            type="button"
            onClick={() => setManual((v) => !v)}
            className={cn('text-[11.5px] transition-colors', manual ? 'text-brand' : 'text-muted hover:text-ink')}
          >
            {manual ? '← 回到表单模式' : '直接编辑 YAML →'}
          </button>
        </div>

        {manual ? (
          <div className="space-y-2">
            <YamlView yaml={yamlText} editing onChange={setYamlText} maxHeight="420px" />
            <p className="text-[11px] text-muted">支持粘贴完整清单，创建时会解析名称、命名空间、副本数与首个镜像。</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="名称" hint={nameValid ? '符合 RFC 1123' : '仅小写字母、数字与中划线'}>
                <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="命名空间">
                <input className={inputClass} value={ns} onChange={(e) => setNs(e.target.value)} />
              </Field>
              <Field label="副本数">
                <input
                  type="number"
                  min={0}
                  max={50}
                  className={inputClass}
                  value={replicas}
                  onChange={(e) => setReplicas(Math.max(0, Number(e.target.value)))}
                />
              </Field>
              <Field label="镜像">
                <input className={inputClass} value={image} onChange={(e) => setImage(e.target.value)} />
              </Field>
            </div>
            <div className="space-y-2">
              <span className="text-[12px] font-medium text-ink">资源清单预览</span>
              <YamlView yaml={generated} maxHeight="300px" />
            </div>
          </>
        )}
      </div>
    </Drawer>
  )
}
