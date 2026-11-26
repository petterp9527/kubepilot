# KubePilot

> Kubernetes 图形化管理控制台 · v0.1 纯前端可交互原型

一个对标 KubeSphere、更轻量的 K8s 管理界面。v0.1 用 Mock 数据实现了完整的产品形态与交互，**所有页面均可点击操作**（扩缩容、重启、删除、YAML 编辑、日志流、终端）。

产品设计见 [PRODUCT.md](./PRODUCT.md)。

---

## 快速开始

```bash
npm install
npm run dev           # http://localhost:5173
npm run build         # 产出 dist/
npm run preview       # 预览构建产物
npm run build:single  # 产出可双击打开的单文件版 dist/kubepilot-standalone.html
```

> 想直接看效果、不想起服务：用 `npm run build:single` 生成的单文件 HTML 双击即可（JS/CSS 已内联，file:// 下也能运行），方便发给同事评审。

技术栈：React 19 + TypeScript + Vite 8 + Tailwind CSS v4 + React Router（Hash 路由）+ lucide-react。零 UI 框架，组件与图表均为手写。

## 已实现功能

| 模块 | 能力 |
| --- | --- |
| 集群总览 | 4 个 KPI、资源趋势折线（CPU/内存/磁盘切换、hover 读数）、集群水位、节点排行、命名空间负载、事件流、工作负载健康、异常告警条 |
| 工作负载 | Deployment / StatefulSet / DaemonSet 列表（搜索、排序、副本进度、状态徽标）；详情页 概览/实例/事件/YAML 四 Tab |
| Pod | 列表（状态筛选、搜索）、详情（容器、运行时信息、日志、事件、YAML） |
| 日志 | 多容器切换、实时跟随、关键字过滤、自动换行、下载、ERROR/WARN 染色 |
| 网络与配置 | Service、Ingress 列表；ConfigMap / Secret（Secret 值默认脱敏，需二次确认才显示明文） |
| 存储 | PVC（绑定状态、使用率）、PV（回收策略、Claim 绑定关系） |
| 运维 | 事件中心（Warning 筛选、跳转关联资源）、Web 终端（kubectl 子集，读取当前集群状态） |
| 全局交互 | 命名空间切换（影响列表与统计）、⌘K 全局搜索、Toast 反馈、危险操作输名确认、YAML 编辑后「应用」触发滚动更新 |

## 目录结构

```
src/
├─ mock/data.ts            确定性 Mock 集群（6 节点 / 20 工作负载 / 66 Pod / 事件 / 指标序列）
├─ types.ts                领域模型，字段对齐 K8s API 对象，便于后续替换为真实数据
├─ store.tsx               useSyncExternalStore 单例状态 + 动作（scale/restart/delete/apply/create）
├─ lib/utils.ts            格式化、聚合统计、YAML 生成与解析
├─ lib/logs.ts             可复现的容器日志生成器
├─ components/             UI 基础件、DataTable、图表（SVG）、YamlView、LogViewer、各类弹层
└─ pages/                  12 个页面
```

设计要点：

- **命名空间是全局状态**，切换后总览统计与所有列表同步过滤，避免"总览全量、列表单空间"的认知错位。
- **列表高度复用**：`DataTable` 统一排序 / 空态 / 行操作；`PodTable` 复用于 Pod 列表、工作负载实例、节点详情。
- **状态即时生效**：扩缩容会把新副本加入列表，重启会先置为 Progressing 再回落 Healthy，便于演示发布流程。
- **数据契约即接口契约**：`types.ts` 的字段命名贴近 K8s，v0.2 接后端时页面基本无需改动。

## 从原型到真实集群（v0.2 建议）

1. 新增 Node BFF（Express/Fastify），用 `@kubernetes/client-node` 读取 kubeconfig 或 in-cluster ServiceAccount。
2. 暴露 REST：`GET /api/:ns/:resource`、`GET /api/pods/:name/logs`（SSE/WebSocket）、`PATCH /api/deployments/:name/scale`。
3. 前端把 `store.tsx` 的 Mock 数据源替换为 `fetch` + SWR/React Query，`actions` 改为调用 BFF。
4. 终端改为 xterm.js + WebSocket exec；YAML apply 走服务端 `kubectl apply` 或 dynamic client。
5. 权限：ServiceAccount 只读 + 白名单写操作，前端按 RBAC 结果隐藏按钮。

## 已知限制（v0.1）

- 数据在内存中，刷新页面即重置；不落库、不持久化。
- 终端与日志为模拟输出，不执行真实命令。
- 未实现多集群切换、RBAC 视角、告警与监控图表接入。
