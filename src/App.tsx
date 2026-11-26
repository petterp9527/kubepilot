import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import Overview from './pages/Overview'
import NodeList from './pages/NodeList'
import NodeDetail from './pages/NodeDetail'
import WorkloadList from './pages/WorkloadList'
import WorkloadDetail from './pages/WorkloadDetail'
import PodList from './pages/PodList'
import PodDetail from './pages/PodDetail'
import ServiceList from './pages/ServiceList'
import IngressList from './pages/IngressList'
import ConfigList from './pages/ConfigList'
import StorageList from './pages/StorageList'
import Events from './pages/Events'
import Terminal from './pages/Terminal'
import { Card, EmptyState } from './components/ui'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/overview" replace />} />
          <Route path="/overview" element={<Overview />} />

          <Route path="/nodes" element={<NodeList />} />
          <Route path="/nodes/:name" element={<NodeDetail />} />

          <Route path="/workloads/deployments" element={<WorkloadList kind="Deployment" />} />
          <Route path="/workloads/deployments/:name" element={<WorkloadDetail kind="Deployment" />} />
          <Route path="/workloads/statefulsets" element={<WorkloadList kind="StatefulSet" />} />
          <Route path="/workloads/statefulsets/:name" element={<WorkloadDetail kind="StatefulSet" />} />
          <Route path="/workloads/daemonsets" element={<WorkloadList kind="DaemonSet" />} />
          <Route path="/workloads/daemonsets/:name" element={<WorkloadDetail kind="DaemonSet" />} />
          <Route path="/workloads/pods" element={<PodList />} />
          <Route path="/workloads/pods/:name" element={<PodDetail />} />

          <Route path="/network/services" element={<ServiceList />} />
          <Route path="/network/ingresses" element={<IngressList />} />

          <Route path="/config/configmaps" element={<ConfigList mode="configmaps" />} />
          <Route path="/config/secrets" element={<ConfigList mode="secrets" />} />

          <Route path="/storage/pvcs" element={<StorageList mode="pvcs" />} />
          <Route path="/storage/pvs" element={<StorageList mode="pvs" />} />

          <Route path="/events" element={<Events />} />
          <Route path="/terminal" element={<Terminal />} />

          <Route
            path="*"
            element={
              <Card>
                <EmptyState title="页面不存在" desc="请通过左侧导航访问集群资源。" />
              </Card>
            }
          />
        </Route>
      </Routes>
    </HashRouter>
  )
}
