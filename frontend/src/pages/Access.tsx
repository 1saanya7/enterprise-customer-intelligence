import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { auditSchema, usersSchema } from "../lib/contracts";
import { useApi } from "../lib/queries";
import { mutate } from "../lib/api";
import {
  Avatar,
  Badge,
  Card,
  Empty,
  ErrorPanel,
  Loading,
  PageHeading,
  Status,
  Tip,
} from "../components/ui";
import { dateTime } from "../lib/format";

export function Access() {
  const users = useApi("/users", usersSchema);
  const audit = useApi("/audit", auditSchema);
  const client = useQueryClient();
  const [saving, setSaving] = useState("");
  const [error, setError] = useState<Error | null>(null);
  async function change(id: string, role: string) {
    setSaving(id);
    setError(null);
    try {
      await mutate(`/users/${id}/role`, { role }, "PATCH");
      await client.invalidateQueries();
    } catch (e) {
      setError(e as Error);
    } finally {
      setSaving("");
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="IDENTITY & GOVERNANCE"
        title="People and access"
        description="Manage workspace roles and review organisation-scoped security events."
      />
      {error && <ErrorPanel error={error} />}{" "}
      {users.isPending ? (
        <Loading />
      ) : users.error ? (
        <ErrorPanel error={users.error} retry={() => void users.refetch()} />
      ) : (
        <Card
          title="Workspace members"
          description="Role changes invalidate the member’s active sessions"
          action={
            <Badge tone="blue">
              <ShieldCheck size={13} />
              Backend enforced
            </Badge>
          }
        >
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Team</th>
                  <th>Role</th>
                  <th>
                    Access level{" "}
                    <Tip text="Capabilities are enforced by backend route and domain-service checks." />
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.data!.users.map((u) => (
                  <tr key={u.user_id}>
                    <td>
                      <span className="member">
                        <Avatar name={u.name} />
                        <span>
                          <strong>{u.name}</strong>
                          <small>{u.email}</small>
                        </span>
                      </span>
                    </td>
                    <td>
                      {u.department}
                      <small className="block">{u.job_title}</small>
                    </td>
                    <td>
                      <select
                        aria-label={`Role for ${u.name}`}
                        value={u.role}
                        disabled={saving === u.user_id}
                        onChange={(e) => void change(u.user_id, e.target.value)}
                      >
                        {users.data!.roles.map((r) => (
                          <option value={r.value} key={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <Badge>{u.capabilities.length} capabilities</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {audit.isPending ? (
        <Loading rows={1} />
      ) : audit.error ? (
        <ErrorPanel error={audit.error} />
      ) : (
        <Card
          title="Audit trail"
          description="Latest 200 access and workflow events"
        >
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Outcome</th>
                  <th>Resource</th>
                </tr>
              </thead>
              <tbody>
                {audit.data!.map((a) => (
                  <tr key={a.id}>
                    <td>{dateTime(a.created_at)}</td>
                    <td>{a.name ?? a.user_id}</td>
                    <td>{a.action.replaceAll(".", " · ")}</td>
                    <td>
                      <Status value={a.outcome} />
                    </td>
                    <td>
                      <code>{a.resource_id?.slice(0, 12) || "—"}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!audit.data!.length && (
              <Empty
                title="No audit events"
                description="Access and workflow events will appear here."
              />
            )}
          </div>
        </Card>
      )}
    </>
  );
}
