import {
  Activity,
  CircleDollarSign,
  Clock3,
  CloudOff,
  Server,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { operationsSchema } from "../lib/contracts";
import { dateTime, duration, number } from "../lib/format";
import { useApi } from "../lib/queries";
import {
  Card,
  Empty,
  ErrorPanel,
  Loading,
  Metric,
  Notice,
  PageHeading,
  Status,
} from "../components/ui";

export function Operations() {
  const q = useApi("/operations", operationsSchema, true, 15000);
  if (q.isPending)
    return (
      <>
        <PageHeading
          title="Operations"
          description="Measured runtime health and activity."
        />
        <Loading />
      </>
    );
  if (q.error)
    return <ErrorPanel error={q.error} retry={() => void q.refetch()} />;
  const d = q.data!;
  return (
    <>
      <PageHeading
        eyebrow="PLATFORM OPERATIONS"
        title="Operations"
        description="Measured request health, execution outcomes and access activity."
      />
      <Notice>
        All figures are derived from this workspace's recorded activity. No
        fabricated infrastructure or model usage is shown.
      </Notice>
      <div className="metric-grid">
        <Metric
          label="Workflow executions"
          value={number(d.execution_count)}
          hint={d.window}
          icon={<Activity size={18} />}
        />
        <Metric
          label="Success rate"
          value={
            d.success_rate === null ? "No completed runs" : `${d.success_rate}%`
          }
          hint={`${d.failed_count} failed executions`}
          icon={<Server size={18} />}
        />
        <Metric
          label="API P95 response start"
          value={duration(d.p95_ms)}
          hint={`${d.api_requests} recorded API requests`}
          icon={<Clock3 size={18} />}
          tip="Time until the HTTP response starts. Streaming workflow completion is recorded separately."
        />
        <Metric
          label="Active sessions"
          value={d.active_users}
          hint="Active in the last 15 minutes"
          icon={<Users size={18} />}
        />
      </div>
      <div className="chart-grid">
        <Card
          title="API latency by route"
          description="Average response-start time  |  milliseconds"
        >
          {d.latency.length ? (
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.latency}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="route"
                    tickFormatter={(x) => String(x).replace("/api/", "")}
                  />
                  <YAxis />
                  <Tooltip
                    formatter={(v) => [`${Number(v).toFixed(2)} ms`, "Average"]}
                  />
                  <Bar dataKey="average_ms" fill="#4b75d1" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty
              title="No request measurements"
              description="Use the workspace to generate operational telemetry."
            />
          )}
        </Card>
        <Card
          title="Cloud and cost posture"
          description="Explicitly tracked availability"
        >
          <div className="cost-posture">
            <p>
              <CloudOff size={18} />
              <span>
                Google Cloud execution<strong>{d.cloud_status}</strong>
              </span>
            </p>
            <p>
              <CircleDollarSign size={18} />
              <span>
                Recorded AI cost<strong>₹{d.ai_cost_inr}</strong>
              </span>
            </p>
            <p>
              <Server size={18} />
              <span>
                Infrastructure cost
                <strong>
                  {d.infrastructure_cost_inr === null
                    ? "Unavailable - local process"
                    : "₹" + d.infrastructure_cost_inr}
                </strong>
              </span>
            </p>
            <p>
              <Activity size={18} />
              <span>
                Model tokens<strong>{number(d.model_tokens)}</strong>
              </span>
            </p>
          </div>
        </Card>
      </div>
      <Card
        title="Recent workflow executions"
        description="Latest 50 organisation-scoped records"
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Execution</th>
                <th>User</th>
                <th>Status</th>
                <th>Started</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {d.runs.map((r) => (
                <tr key={r.id}>
                  <td>
                    <code>{r.id.slice(0, 8)}</code>
                  </td>
                  <td>{r.user_name ?? r.user_id ?? "Unknown user"}</td>
                  <td>
                    <Status value={r.status} />
                  </td>
                  <td>{dateTime(r.started_at)}</td>
                  <td>{duration(r.duration_ms)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!d.runs.length && (
            <Empty
              title="No executions in this window"
              description="Run a product investigation to populate operational history."
            />
          )}
        </div>
      </Card>
    </>
  );
}
