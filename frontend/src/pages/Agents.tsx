import { Bot, CheckCircle2, Clock3, Coins, Wrench } from "lucide-react";
import { agentsSchema } from "../lib/contracts";
import { dateTime, duration } from "../lib/format";
import { useApi } from "../lib/queries";
import {
  Badge,
  Card,
  Empty,
  ErrorPanel,
  Loading,
  PageHeading,
  Tip,
} from "../components/ui";

export function Agents() {
  const q = useApi("/agents", agentsSchema);
  return (
    <>
      <PageHeading
        eyebrow="AGENT ORCHESTRATION"
        title="Agent workspace"
        description="Inspect each specialist, its tools and measured execution activity."
      />
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorPanel error={q.error} retry={() => void q.refetch()} />
      ) : (
        <>
          <div className="agent-summary">
            <span>
              <CheckCircle2 size={17} />
              {q.data!.length} specialists available
            </span>
            <span>
              <Coins size={17} />
              ₹0 AI cost
            </span>
            <span>
              <Bot size={17} />
              Provider: Offline workflow{" "}
              <Tip text="The production Google provider is intentionally disabled until a separate end-to-end test is approved." />
            </span>
          </div>
          <div className="agent-grid">
            {q.data!.map((a) => (
              <Card key={a.id} className="agent-card">
                <div className="agent-head">
                  <span className="agent-icon">
                    <Bot size={21} />
                  </span>
                  <Badge tone="success">{a.status}</Badge>
                </div>
                <h2>{a.name}</h2>
                <p>{a.description}</p>
                <dl>
                  <div>
                    <dt>Provider</dt>
                    <dd>{a.provider}</dd>
                  </div>
                  <div>
                    <dt>Model</dt>
                    <dd>{a.model ?? "Deterministic rules"}</dd>
                  </div>
                  <div>
                    <dt>Tasks completed</dt>
                    <dd>{a.runs}</dd>
                  </div>
                  <div>
                    <dt>Average time</dt>
                    <dd>{duration(a.average_ms)}</dd>
                  </div>
                  <div>
                    <dt>Last execution</dt>
                    <dd>
                      {a.last_execution
                        ? dateTime(a.last_execution)
                        : "No executions yet"}
                    </dd>
                  </div>
                  <div>
                    <dt>Recorded AI cost</dt>
                    <dd>₹{a.cost_inr}</dd>
                  </div>
                </dl>
                <div className="tools">
                  <span>
                    <Wrench size={14} />
                    Available tools
                  </span>
                  {a.tools.map((t) => (
                    <Badge key={t}>{t}</Badge>
                  ))}
                </div>
                <small>
                  <Clock3 size={13} />
                  {a.scope}
                </small>
              </Card>
            ))}
          </div>
          {!q.data!.length && (
            <Empty
              title="No agents available"
              description="Agent definitions will appear here when configured."
            />
          )}
        </>
      )}
    </>
  );
}
