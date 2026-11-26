import type { Pod } from '../types'
import { logTime } from './utils'

const PATHS = [
  '/v1/orders',
  '/v1/orders/88213',
  '/v1/users/me',
  '/v1/products?page=2',
  '/healthz',
  '/metrics',
  '/v1/payments/authorize',
  '/v1/cart',
]
const METHODS = ['GET', 'GET', 'GET', 'POST', 'PUT', 'DELETE']
const MSGS = [
  'request completed',
  'upstream call succeeded',
  'cache hit',
  'db query executed',
  'kafka message produced',
  'jwt verified',
]

function seeded(str: string) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

export function generateLogs(pod: Pod, container?: string, count = 120): string[] {
  const r = seeded(`${pod.name}/${container ?? pod.containers[0]?.name ?? 'main'}`)
  const lines: string[] = []
  let ts = Date.now() - 1000

  for (let i = 0; i < count; i++) {
    ts -= Math.floor(400 + r() * 2600)
    const time = logTime(new Date(ts))
    const roll = r()
    const b3 = Math.floor(r() * 0xffffffff).toString(16).padStart(8, '0')
    const trace = `${b3}${Math.floor(r() * 0xffffffff).toString(16).padStart(8, '0')}`

    if (roll < 0.045) {
      const errs = [
        'upstream timeout after 3000ms: dial tcp 10.96.14.7:8080: i/o timeout',
        'context deadline exceeded while calling payment-service/authorize',
        'redis: connection pool exhausted (waiters=32)',
      ]
      lines.push(`${time} ERROR [http] ${errs[Math.floor(r() * errs.length)]} trace=${trace}`)
    } else if (roll < 0.12) {
      lines.push(
        `${time} WARN  [http] slow request ${METHODS[Math.floor(r() * METHODS.length)]} ${PATHS[Math.floor(r() * PATHS.length)]} took ${Math.floor(900 + r() * 2400)}ms trace=${trace}`,
      )
    } else if (roll < 0.2) {
      lines.push(`${time} INFO  [gc] ${MSGS[Math.floor(r() * MSGS.length)]} heap=${Math.floor(120 + r() * 480)}MB goroutines=${Math.floor(18 + r() * 240)}`)
    } else {
      const code = r() > 0.985 ? 500 : r() > 0.97 ? 404 : 200
      lines.push(
        `${time} INFO  [http] ${METHODS[Math.floor(r() * METHODS.length)]} ${PATHS[Math.floor(r() * PATHS.length)]} ${code} ${(2 + r() * 80).toFixed(1)}ms trace=${trace}`,
      )
    }
  }

  return lines
}
