import { Navigate, Route, Routes } from "react-router-dom";
import { lazy, Suspense } from "react";
import type { ReactNode } from "react";
import { useAuth } from "./lib/auth";
import { Loading } from "./components/ui";
import { Shell } from "./components/Shell";
import { Login, homeFor } from "./pages/Login";

const Dashboard = lazy(() =>
  import("./pages/Dashboard").then((module) => ({ default: module.Dashboard })),
);
const InvestigationList = lazy(() =>
  import("./pages/Investigations").then((module) => ({
    default: module.InvestigationList,
  })),
);
const NewInvestigation = lazy(() =>
  import("./pages/Investigations").then((module) => ({
    default: module.NewInvestigation,
  })),
);
const InvestigationDetail = lazy(() =>
  import("./pages/Investigations").then((module) => ({
    default: module.InvestigationDetail,
  })),
);
const Agents = lazy(() =>
  import("./pages/Agents").then((module) => ({ default: module.Agents })),
);
const Operations = lazy(() =>
  import("./pages/Operations").then((module) => ({
    default: module.Operations,
  })),
);
const Access = lazy(() =>
  import("./pages/Access").then((module) => ({ default: module.Access })),
);
const Settings = lazy(() =>
  import("./pages/Settings").then((module) => ({ default: module.Settings })),
);

function Protected({ children }: { children: ReactNode }) {
  const { user, loading, error } = useAuth();
  if (loading)
    return (
      <div className="boot-screen">
        <Loading rows={2} />
      </div>
    );
  if (!user || error) return <Navigate to="/login" replace />;
  return children;
}
function Capability({
  capability,
  children,
}: {
  capability: string;
  children: ReactNode;
}) {
  const { can, user } = useAuth();
  return can(capability) ? (
    children
  ) : (
    <Navigate to={homeFor(user?.capabilities ?? [])} replace />
  );
}
function Home() {
  const { user } = useAuth();
  return <Navigate to={user ? homeFor(user.capabilities) : "/login"} replace />;
}

export default function App() {
  return (
    <Suspense
      fallback={
        <div className="boot-screen">
          <Loading rows={2} />
        </div>
      }
    >
      <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <Protected>
            <Shell />
          </Protected>
        }
      >
        <Route index element={<Home />} />
        <Route
          path="overview"
          element={
            <Capability capability="analytics.read">
              <Dashboard />
            </Capability>
          }
        />
        <Route
          path="investigations"
          element={
            <Capability capability="agents.execute">
              <InvestigationList />
            </Capability>
          }
        />
        <Route
          path="investigations/new"
          element={
            <Capability capability="agents.execute">
              <NewInvestigation />
            </Capability>
          }
        />
        <Route
          path="investigations/:id"
          element={
            <Capability capability="agents.execute">
              <InvestigationDetail />
            </Capability>
          }
        />
        <Route
          path="agents"
          element={
            <Capability capability="agents.read">
              <Agents />
            </Capability>
          }
        />
        <Route
          path="operations"
          element={
            <Capability capability="operations.read">
              <Operations />
            </Capability>
          }
        />
        <Route
          path="access"
          element={
            <Capability capability="users.read">
              <Access />
            </Capability>
          }
        />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Home />} />
      </Routes>
    </Suspense>
  );
}
