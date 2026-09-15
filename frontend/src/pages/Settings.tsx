import {
  CloudOff,
  Database,
  IndianRupee,
  KeyRound,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { workspaceSchema } from "../lib/contracts";
import { useApi } from "../lib/queries";
import {
  Badge,
  Card,
  ErrorPanel,
  Loading,
  Notice,
  PageHeading,
} from "../components/ui";

export function Settings() {
  const { user } = useAuth();
  const q = useApi("/workspace", workspaceSchema);
  if (q.isPending) return <Loading />;
  if (q.error) return <ErrorPanel error={q.error} />;
  const w = q.data!;
  return (
    <>
      <PageHeading
        eyebrow="WORKSPACE CONFIGURATION"
        title="Workspace settings"
        description="Review identity, data and environment configuration."
      />
      <div className="settings-grid">
        <Card title="Workspace">
          <dl className="settings-list">
            <div>
              <dt>Organisation</dt>
              <dd>{w.organization}</dd>
            </div>
            <div>
              <dt>Environment</dt>
              <dd>{w.environment}</dd>
            </div>
            <div>
              <dt>Dataset release</dt>
              <dd>{w.dataset}</dd>
            </div>
            <div>
              <dt>Reporting currency</dt>
              <dd>
                <IndianRupee size={15} />
                Indian rupees
              </dd>
            </div>
            <div>
              <dt>Timezone</dt>
              <dd>
                <MapPin size={15} />
                Asia/Kolkata
              </dd>
            </div>
          </dl>
        </Card>
        <Card title="Your account">
          <dl className="settings-list">
            <div>
              <dt>Name</dt>
              <dd>{user!.name}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>
                <Badge>{user!.role_label}</Badge>
              </dd>
            </div>
            <div>
              <dt>Department</dt>
              <dd>{user!.department}</dd>
            </div>
            <div>
              <dt>Access</dt>
              <dd>{user!.capabilities.length} capabilities</dd>
            </div>
          </dl>
        </Card>
        <Card title="Data sources">
          <div className="setting-status">
            <Database size={20} />
            <span>
              Workspace dataset<strong>Available</strong>
            </span>
            <Badge tone="success">Connected</Badge>
          </div>
          <div className="setting-status">
            <CloudOff size={20} />
            <span>
              Google Cloud data sources<strong>Not configured</strong>
            </span>
            <Badge>Disabled</Badge>
          </div>
        </Card>
        <Card title="Security posture">
          <div className="setting-status">
            <KeyRound size={20} />
            <span>
              Session security<strong>HttpOnly cookie + CSRF protection</strong>
            </span>
            <Badge tone="success">Active</Badge>
          </div>
          <div className="setting-status">
            <ShieldCheck size={20} />
            <span>
              Authorisation<strong>Server-side RBAC</strong>
            </span>
            <Badge tone="success">Active</Badge>
          </div>
        </Card>
      </div>
      <Notice>
        No cloud credentials or API keys are stored in this application. Google
        services remain disabled under the current spending policy.
      </Notice>
    </>
  );
}
