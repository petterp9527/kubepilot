# KubePilot 产品设计基线 v0.1

> 面向研发/运维的 Kubernetes 图形化管理控制台。对标 KubeSphere，但更轻、更聚焦「日常运维 80% 的高频动作」。

---

## 1. 产品定位

| 维度 | 说明 |
| --- | --- |
| 一句话 | 让不熟 kubectl 的研发也能安全地看、改、排障 K8s 工作负载 |
| 目标用户 | 中小团队后端研发、SRE、值班运维 |
| 核心场景 | ① 集群健康巡检 ② 服务发版后确认状态 ③ Pod 异常排障（日志/事件/YAML）④ 快速扩缩容与重启 |
| 不做（v1 边界） | 多集群联邦、多租户 RBAC 计费、CI/CD 流水线编排、可观测性平台替代 |

## 2. 信息架构

```
集群
├── 集群总览            /overview
├── 节点                /nodes  →  /nodes/:name
工作负载
├── Deployment          /workloads/deployments → /workloads/deployments/:name
├── StatefulSet         /workloads/statefulsets → ...
├── DaemonSet           /workloads/daemonsets  → ...
├── Pod                 /workloads/pods        → /workloads/pods/:name
网络
├── Service             /network/services
├── Ingress             /network/ingresses
配置
├── ConfigMap           /config/configmaps
├── Secret              /config/secrets
存储
├── PVC                 /storage/pvcs
├── PV                  /storage/pvs
运维
├── 事件                /events
├── Web 终端            /terminal
```

## 3. 关键页面与交互契约

### 3.1 全局壳
- **左侧导航**：按「集群 / 工作负载 / 网络 / 配置 / 存储 / 运维」分组，组内显示资源数量徽标。
- **顶栏**：全局搜索（按名称模糊匹配并跳转）、**命名空间选择器**（全局生效，`全部命名空间` 为默认）、集群选择、手动刷新、通知、用户。
- **命名空间状态是全局的**：切换后所有列表页与总览统计同步过滤，避免"总览看全量、列表看单空间"的认知错位。

### 3.2 总览
- 4 个 KPI：节点就绪、Pod 运行中、CPU 分配率、内存分配率。
- 资源趋势折线（近 1h，CPU / 内存切换）。
- 节点资源排行（横向条）。
- 近期事件流（Warning 优先）。
- 工作负载健康矩阵（按命名空间 × 就绪率）。

### 3.3 资源列表（统一框架）
所有列表共用一套表格能力：搜索、排序（名称/创建时间）、状态徽标、行悬停操作、点击进入详情、空态。
- Deployment 行操作：扩缩容、滚动重启、查看 YAML、删除。
- Pod 行操作：日志、终端、YAML、删除。
- Secret 列表默认遮蔽 value，需点击「显示」二次确认。

### 3.4 资源详情
统一 Tab 骨架：**概览 / 实例（Pod）/ 事件 / YAML / 日志**（Pod 详情为 概览 / 日志 / 事件 / YAML）。
- 概览：状态卡、副本进度条、容器列表（镜像、端口、资源 requests/limits）、标签与选择器、滚动策略。
- YAML：等宽字体 + 行号 + 复制 + 编辑模式（编辑后可「应用」，v1 为前端模拟并写入变更提示）。
- 日志：Pod 多容器切换、尾部跟随、暂停、下载、按关键字高亮。
- 事件：按时间倒序，Warning 红色标记，显示 count / reason / message / source。

### 3.5 危险操作
扩缩容、重启、删除均为**模态确认**；删除需输入资源名确认（防误删），操作后 toast 反馈并即时更新列表。

### 3.6 Web 终端
模拟 kubectl 会话：支持 `kubectl get pods -n <ns>`、`get nodes`、`describe pod <name>`、`logs <pod>`、`help`、`clear`，输出与当前命名空间数据联动。

## 4. 视觉规范

| Token | 值 | 用途 |
| --- | --- | --- |
| `--bg` | `#F5F7FB` | 页面底色 |
| `--surface` | `#FFFFFF` | 卡片 |
| `--border` | `#E6E9F1` | 分割线 |
| `--text` | `#0F172A` | 主文字 |
| `--muted` | `#64748B` | 次要文字 |
| `--primary` | `#2563EB` | 主色 / 选中态 |
| `--sidebar` | `#0B1220` | 深色侧边栏 |
| success / warning / danger | `#16A34A` / `#D97706` / `#DC2626` | 状态语义 |

- 圆角：卡片 12px、控件 8px、徽标 999px。
- 阴影：仅弹层使用 `0 20px 50px rgba(15,23,42,.12)`，列表不用阴影，用 1px 边框分层。
- 数字统一 `tabular-nums`，表格行高 48px，密度按「控制台」而非「营销页」设定。

## 5. 演进路线

- **v0.1（本次）**：纯前端可交互原型，Mock 数据，全部核心页面与交互可点。
- **v0.2**：Node BFF 接入真实集群（kubeconfig / ServiceAccount），资源列表与详情接 K8s API。
- **v0.3**：日志流（WebSocket）、真实 exec 终端（xterm.js + SPDY/WebSocket）、YAML apply。
- **v0.4**：多集群、RBAC 视角、审计日志、告警看板。
