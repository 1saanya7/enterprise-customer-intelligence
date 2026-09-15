import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Download,
  FileSearch,
  Play,
  RotateCcw,
  Search,
  ShieldCheck,
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
import { useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  Dialog,
  Empty,
  ErrorPanel,
  Loading,
  Notice,
  PageHeading,
  Status,
} from "../components/ui";
import { Filters } from "../components/Filters";
import { downloadReport, streamInvestigation } from "../lib/api";
import {
  historySchema,
  investigationSchema,
  runsSchema,
} from "../lib/contracts";
import type { Step } from "../lib/contracts";
import { compactMoney, dateTime, duration, money } from "../lib/format";
import { useApi } from "../lib/queries";

export function InvestigationList() {
  const [search, setSearch] = useState("");
  const history = useApi("/investigations", historySchema);
  const runs = useApi("/executions", runsSchema, true, 10000);
  if (history.isPending || runs.isPending)
    return (
      <>
        <PageHeading
          title="Investigations"
          description="Review your evidence-led product investigations and execution status."
        />
        <Loading />
      </>
    );
  if (history.error)
    return (
      <ErrorPanel error={history.error} retry={() => void history.refetch()} />
    );
  const items = (history.data ?? []).filter((x) =>
    x.question.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="DECISION WORKSPACE"
        title="Investigations"
        description="Review completed analyses, source evidence and execution history."
        actions={
          <Link className="button primary" to="/investigations/new">
            New investigation
            <ArrowRight size={16} />
          </Link>
        }
      />
      <Card>
        <div className="list-toolbar">
          <label className="search-field">
            <Search size={16} />
            <span className="sr-only">Search investigations</span>
            <input
              placeholder="Search investigations"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <span>{items.length} investigations</span>
        </div>
        {items.length ? (
          <div className="investigation-list">
            {items.map((item) => (
              <Link key={item.id} to={`/investigations/${item.id}`}>
                <span className="list-icon">
                  <FileSearch size={18} />
                </span>
                <div>
                  <strong>Product performance investigation</strong>
                  <p>{item.question}</p>
                  <small>
                    {dateTime(item.created_at)} | {item.region}
                  </small>
                </div>
                <Status value={item.status} />
                <span>{duration(item.duration_ms)}</span>
                <ArrowRight size={17} />
              </Link>
            ))}
          </div>
        ) : (
          <Empty
            title="No investigations found"
            description={
              search
                ? "Try another search term."
                : "Start an investigation to connect product, customer and policy evidence."
            }
          />
        )}
      </Card>
      {(runs.data ?? []).some((r) =>
        ["queued", "running", "failed"].includes(r.status),
      ) && (
        <Card
          title="Execution history"
          description="Recent non-terminal and failed runs"
        >
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Execution</th>
                  <th>Status</th>
                  <th>Started</th>
                  <th>Duration</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {runs
                  .data!.filter((r) =>
                    ["queued", "running", "failed"].includes(r.status),
                  )
                  .map((r) => (
                    <tr key={r.id}>
                      <td>
                        <code>{r.id.slice(0, 8)}</code>
                      </td>
                      <td>
                        <Status value={r.status} />
                      </td>
                      <td>{dateTime(r.started_at)}</td>
                      <td>{duration(r.duration_ms)}</td>
                      <td>{r.error ?? "In progress"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}

const stages = [
  "Authorization",
  "Sales analysis",
  "Complaint aggregation",
  "Policy lookup",
  "Evidence validation",
];
export function NewInvestigation() {
  const navigate = useNavigate();
  const client = useQueryClient();
  const [period, setPeriod] = useState("2026-07-01");
  const [region, setRegion] = useState("All regions");
  const [threshold, setThreshold] = useState(15);
  const [question, setQuestion] = useState(
    "Which products declined by more than 15% last quarter, what customer complaints are associated with them, and what warranty conditions apply?",
  );
  const [steps, setSteps] = useState<Step[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<Error | null>(null);
  const [running, setRunning] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function run() {
    setRunning(true);
    setError(null);
    setSteps([]);
    setMessage("Request accepted. Preparing your investigation.");
    controller.current = new AbortController();
    try {
      await streamInvestigation(
        { question, decline_threshold: threshold, as_of: period, region },
        (event) => {
          if (event.type === "started") setMessage(event.message);
          if (event.type === "step")
            setSteps((old) => [
              ...old.filter((x) => x.name !== event.name),
              event,
            ]);
          if (event.type === "result") {
            void client.invalidateQueries();
            navigate(`/investigations/${event.result.id}`, {
              state: { fresh: true },
            });
          }
        },
        controller.current.signal,
      );
    } catch (e) {
      setError(e as Error);
    } finally {
      setRunning(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="GUIDED ANALYSIS"
        title="New investigation"
        description="Define the business question and review each evidence-gathering stage."
      />
      <Notice>
        Northstar uses the selected workspace data, region and completed
        calendar quarters. External actions are not enabled.
      </Notice>
      <Card className="investigation-builder">
        <label>
          Business question
          <textarea
            rows={4}
            maxLength={500}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            aria-describedby="question-help"
          />
        </label>
        <small id="question-help">
          Ask about revenue decline, customer complaint patterns and warranty
          conditions. {question.length}/500
        </small>
        <Filters
          period={period}
          region={region}
          onPeriod={setPeriod}
          onRegion={setRegion}
        />
        <label className="threshold">
          Material decline threshold
          <div>
            <input
              type="range"
              min="5"
              max="50"
              step="5"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
            />
            <output>{threshold}%</output>
          </div>
        </label>
        <div className="builder-actions">
          <Button
            variant="secondary"
            onClick={() => {
              setThreshold(15);
              setRegion("All regions");
              setPeriod("2026-07-01");
            }}
            disabled={running}
          >
            <RotateCcw size={16} />
            Reset
          </Button>
          <Button
            onClick={run}
            busy={running}
            disabled={question.trim().length < 10}
          >
            <Play size={16} />
            {running ? "Investigation running" : "Run investigation"}
          </Button>
        </div>
      </Card>
      {(running || steps.length > 0) && (
        <Card title="Execution progress" description={message}>
          <ol className="progress-steps">
            {stages.map((name, i) => {
              const step = steps.find((x) => x.name === name);
              const active = !step && i === steps.length;
              return (
                <li
                  key={name}
                  className={step ? "done" : active ? "active" : ""}
                >
                  <span>{step ? <Check size={15} /> : i + 1}</span>
                  <div>
                    <strong>{name}</strong>
                    <small>
                      {step?.detail ?? (active ? "In progress..." : "Waiting")}
                    </small>
                  </div>
                  {step && <em>{duration(step.duration_ms)}</em>}
                </li>
              );
            })}
          </ol>
        </Card>
      )}
      {error && <ErrorPanel error={error} retry={run} />}
    </>
  );
}

export function InvestigationDetail() {
  const { id = "" } = useParams();
  const [tab, setTab] = useState<"findings" | "evidence" | "execution">(
    "findings",
  );
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const query = useApi(`/investigations/${id}`, investigationSchema);
  if (query.isPending) return <Loading />;
  if (query.error)
    return (
      <ErrorPanel error={query.error} retry={() => void query.refetch()} />
    );
  const r = query.data!;
  async function exportFile() {
    try {
      await downloadReport(r.id);
      setOpen(false);
    } catch (e) {
      setError(e as Error);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="INVESTIGATION"
        title={
          r.status === "complete"
            ? "Evidence review"
            : "Evidence gap identified"
        }
        description={`${r.period}  |  ${r.region}`}
        actions={
          <Button variant="secondary" onClick={() => setOpen(true)}>
            <Download size={16} />
            Export report
          </Button>
        }
      />
      {error && <ErrorPanel error={error} />}
      <div className="metric-grid three">
        <div className="metric">
          <div className="metric-label">Products requiring review</div>
          <div className="metric-value">{r.products.length}</div>
          <div className="metric-foot">Threshold-qualified declines</div>
        </div>
        <div className="metric">
          <div className="metric-label">Supporting sources</div>
          <div className="metric-value">{r.evidence.length}</div>
          <div className="metric-foot">
            Revenue, tickets and policy evidence
          </div>
        </div>
        <div className="metric">
          <div className="metric-label">Execution duration</div>
          <div className="metric-value small">{duration(r.duration_ms)}</div>
          <div className="metric-foot">Offline workflow</div>
        </div>
      </div>
      <div className="tabs" role="tablist">
        {(["findings", "evidence", "execution"] as const).map((x) => (
          <button
            key={x}
            role="tab"
            aria-selected={tab === x}
            onClick={() => setTab(x)}
          >
            {x === "execution"
              ? "Execution timeline"
              : x[0].toUpperCase() + x.slice(1)}
          </button>
        ))}
      </div>
      {tab === "findings" && (
        <div role="tabpanel">
          <Notice tone={r.status === "complete" ? "success" : "warning"}>
            {r.summary}
          </Notice>
          {r.products.length ? (
            <>
              <Card
                className="revenue-card"
                title="Revenue comparison"
                description="INR  |  previous and current completed quarters"
              >
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={r.products}>
                      <CartesianGrid vertical={false} strokeDasharray="3 4" />
                      <XAxis dataKey="product" />
                      <YAxis tickFormatter={compactMoney} width={80} />
                      <Tooltip
                        cursor={{ fill: "#eef3fb" }}
                        formatter={(v) => money(Number(v))}
                      />
                      <Bar
                        dataKey="previous_revenue"
                        name="Previous quarter"
                        fill="#a7b9de"
                      />
                      <Bar
                        dataKey="current_revenue"
                        name="Current quarter"
                        fill="#4775db"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mobile-chart-data">
                  <table>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Previous</th>
                        <th>Current</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.products.map((p) => (
                        <tr key={p.product_id}>
                          <td>{p.product}</td>
                          <td>{compactMoney(p.previous_revenue)}</td>
                          <td>{compactMoney(p.current_revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
              <div className="finding-grid">
                {r.products.map((p) => (
                  <Card key={p.product_id}>
                    <div className="finding-title">
                      <h2>{p.product}</h2>
                      <Status value="insufficient_evidence" />
                    </div>
                    <strong className="finding-change">
                      {p.change_pct.toFixed(1)}%
                    </strong>
                    <span>
                      {money(p.previous_revenue)} to {money(p.current_revenue)}
                    </span>
                    <h3>Customer signal</h3>
                    {p.complaints.map((c) => (
                      <p className="finding-row" key={c.category}>
                        <span>{c.category}</span>
                        <strong>{c.count} tickets</strong>
                      </p>
                    ))}
                    <h3>Warranty assessment</h3>
                    <p>{p.warranty}</p>
                    <button
                      className="text-button"
                      onClick={() => setTab("evidence")}
                    >
                      Inspect {p.evidence_ids.length} sources{" "}
                      <ArrowRight size={14} />
                    </button>
                  </Card>
                ))}
              </div>
              <Card title="Recommended actions">
                {r.recommendations.map((x, i) => (
                  <p className="action-row" key={x}>
                    <span>{i + 1}</span>
                    {x}
                  </p>
                ))}
              </Card>
            </>
          ) : (
            <Empty
              title="No products crossed the threshold"
              description="Adjust the threshold or region to investigate a broader scope."
            />
          )}
        </div>
      )}
      {tab === "evidence" && (
        <div role="tabpanel" className="evidence-grid">
          {r.evidence.map((e) => (
            <Card key={e.id}>
              <div className="source-top">
                <Status value="complete" />
                <code>{e.id}</code>
              </div>
              <h2>{e.title}</h2>
              <blockquote>{e.excerpt}</blockquote>
              <small>{e.source}</small>
            </Card>
          ))}
        </div>
      )}
      {tab === "execution" && (
        <Card>
          <ol className="execution-timeline">
            {r.trace.map((t) => (
              <li key={t.name}>
                <span>
                  <Check size={15} />
                </span>
                <div>
                  <h3>{t.name}</h3>
                  <p>{t.detail}</p>
                </div>
                <em>{duration(t.duration_ms)}</em>
              </li>
            ))}
          </ol>
        </Card>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Export investigation report"
      >
        <p>
          The report contains the displayed findings, recommendations and source
          passages. Review the evidence before approving the download.
        </p>
        <Notice>
          <ShieldCheck size={16} />
          The file remains on your device. No external workspace action is
          configured.
        </Notice>
        <div className="dialog-actions">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={exportFile}>Approve and download</Button>
        </div>
      </Dialog>
    </>
  );
}
