import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Boxes,
  MessageSquare,
  TrendingDown,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { analyticsSchema } from "../lib/contracts";
import { useApi } from "../lib/queries";
import { useAuth } from "../lib/auth";
import { compactMoney, money, month, number } from "../lib/format";
import {
  Badge,
  Card,
  Empty,
  ErrorPanel,
  Loading,
  Metric,
  Notice,
  PageHeading,
} from "../components/ui";
import { Filters } from "../components/Filters";

export function Dashboard() {
  const { can } = useAuth();
  const [period, setPeriod] = useState("2026-07-01");
  const [region, setRegion] = useState("All regions");
  const [search, setSearch] = useState("");
  const [trendTable, setTrendTable] = useState(false);
  const query = useApi(
    `/analytics?as_of=${period}&region=${encodeURIComponent(region)}`,
    analyticsSchema,
  );
  const d = query.data;
  return (
    <>
      <PageHeading
        eyebrow="BUSINESS INTELLIGENCE"
        title="Product overview"
        description="Understand performance. Spot customer signals. Decide with evidence."
        actions={
          can("agents.execute") && (
            <Link className="button primary" to="/investigations/new">
              New investigation
              <ArrowUpRight size={16} />
            </Link>
          )
        }
      />
      <Filters
        period={period}
        region={region}
        onPeriod={setPeriod}
        onRegion={setRegion}
      />
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorPanel error={query.error} retry={() => void query.refetch()} />
      ) : (
        d && (
          <>
            {!d.complete && (
              <Notice tone="warning">
                The selected period does not have two complete quarters of data.
                Comparison metrics are unavailable.
              </Notice>
            )}
            <div className="metric-grid">
              <Metric
                label="Quarterly revenue"
                value={compactMoney(d.revenue)}
                change={d.change_pct}
                hint="vs previous quarter"
                icon={<Banknote size={19} />}
                tip="Sales ledger revenue in INR. This sample excludes tax adjustments and refunds."
              />
              <Metric
                label="Products at risk"
                value={d.declining_products}
                hint="Revenue decline greater than 15%"
                icon={<TrendingDown size={19} />}
              />
              <Metric
                label="Units sold"
                value={number(d.units)}
                hint={`${d.products.length} products in selected scope`}
                icon={<Boxes size={19} />}
              />
              <Metric
                label={
                  d.complaints ? "Customer complaints" : "Reporting currency"
                }
                value={
                  d.complaints
                    ? number(d.complaints.reduce((n, x) => n + x.count, 0))
                    : "INR"
                }
                hint={
                  d.complaints
                    ? "Support tickets in selected quarter"
                    : "Indian rupees · calendar quarters"
                }
                icon={<MessageSquare size={19} />}
              />
            </div>
            <div className="chart-grid">
              <Card
                title="Revenue trajectory"
                description="Monthly sales across the comparison window"
                action={
                  <button
                    className="text-button"
                    onClick={() => setTrendTable(!trendTable)}
                  >
                    {trendTable ? "Show chart" : "View data"}
                  </button>
                }
              >
                {!d.trends.length ? (
                  <Empty
                    title="No revenue records"
                    description="Choose a reporting period with available sales data."
                  />
                ) : trendTable ? (
                  <div className="table-wrap">
                    <table>
                      <caption className="sr-only">
                        Monthly revenue in Indian rupees
                      </caption>
                      <thead>
                        <tr>
                          <th>Month</th>
                          <th className="numeric">Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.trends.map((t) => (
                          <tr key={t.month}>
                            <td>
                              {month(t.month)} {t.month.slice(0, 4)}
                            </td>
                            <td className="numeric">{money(t.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <>
                    <div className="chart-legend">
                      <span className="legend-dot blue" />
                      Revenue <span className="chart-unit">INR</span>
                    </div>
                    <div
                      className="chart-container"
                      role="img"
                      aria-label="Monthly revenue trend in INR. Use View data for exact values."
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={d.trends}
                          margin={{ left: 2, right: 20, top: 12 }}
                        >
                          <defs>
                            <linearGradient
                              id="revenue-fill"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="0%"
                                stopColor="#4c7ff3"
                                stopOpacity={0.18}
                              />
                              <stop
                                offset="100%"
                                stopColor="#4c7ff3"
                                stopOpacity={0}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            strokeDasharray="3 4"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="month"
                            tickFormatter={month}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            tickFormatter={compactMoney}
                            tickLine={false}
                            axisLine={false}
                            width={82}
                          />
                          <Tooltip
                            labelFormatter={(v) => month(String(v))}
                            formatter={(v) => [money(Number(v)), "Revenue"]}
                          />
                          <Area
                            type="monotone"
                            dataKey="revenue"
                            stroke="#3e73e8"
                            strokeWidth={2.5}
                            fill="url(#revenue-fill)"
                            isAnimationActive={false}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                )}
              </Card>
              <Card
                title="Regional contribution"
                description="Revenue in the selected quarter"
              >
                <div className="region-total">
                  {compactMoney(d.revenue)}
                  <small>Total revenue</small>
                </div>
                {d.regions.length ? (
                  <div className="region-list">
                    {d.regions.map((r, i) => (
                      <div key={r.region}>
                        <div>
                          <span>
                            <i className={`legend-dot region-${i}`} />
                            {r.region}
                          </span>
                          <strong>{compactMoney(r.revenue)}</strong>
                        </div>
                        <div className="progress-track">
                          <span
                            className={`region-${i}`}
                            style={{
                              width: `${d.revenue ? (r.revenue / d.revenue) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <small>
                          {d.revenue
                            ? ((r.revenue / d.revenue) * 100).toFixed(1)
                            : 0}
                          % of selected revenue
                        </small>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty
                    title="No regional data"
                    description="Try another reporting period."
                  />
                )}
                <div className="card-footnote">
                  Mumbai · Bengaluru · Delhi NCR
                </div>
              </Card>
            </div>
            <Card
              title="Product performance"
              description="Quarterly revenue and changes across your product portfolio"
              action={
                <input
                  className="search-input"
                  aria-label="Search products"
                  placeholder="Search products…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              }
            >
              <div className="table-wrap">
                <table>
                  <caption className="sr-only">
                    Product performance in INR
                  </caption>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Category</th>
                      <th className="numeric">Previous quarter</th>
                      <th className="numeric">Current quarter</th>
                      <th className="numeric">Change</th>
                      <th>Signal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.products
                      .filter((p) =>
                        `${p.product} ${p.category}`
                          .toLowerCase()
                          .includes(search.toLowerCase()),
                      )
                      .map((p) => (
                        <tr key={p.product_id}>
                          <td>
                            <span className="product-name">
                              <span className="product-icon">
                                <Boxes size={16} />
                              </span>
                              {p.product}
                            </span>
                          </td>
                          <td className="muted">{p.category}</td>
                          <td className="numeric">
                            {money(p.previous_revenue)}
                          </td>
                          <td className="numeric weight-medium">
                            {money(p.current_revenue)}
                          </td>
                          <td
                            className={`numeric ${(p.change_pct ?? 0) < 0 ? "negative" : "positive"}`}
                          >
                            {p.change_pct === null
                              ? "Unavailable"
                              : `${p.change_pct > 0 ? "+" : ""}${p.change_pct.toFixed(1)}%`}
                          </td>
                          <td>
                            <Badge
                              tone={
                                p.change_pct === null
                                  ? "neutral"
                                  : p.change_pct < -15
                                    ? "warning"
                                    : "success"
                              }
                            >
                              {p.change_pct === null
                                ? "Incomplete data"
                                : p.change_pct < -15
                                  ? "Review recommended"
                                  : "Within threshold"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {!d.products.some((p) =>
                  `${p.product} ${p.category}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                ) && (
                  <Empty
                    title="No matching products"
                    description="Try another product name or category."
                  />
                )}
              </div>
            </Card>
            {d.complaints && (
              <div className="chart-grid bottom-grid">
                <Card
                  title="What customers are reporting"
                  description="Complaint categories · ticket counts"
                >
                  <div
                    className="chart-container"
                    role="img"
                    aria-label="Support ticket counts by category"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={d.complaints}
                        layout="vertical"
                        margin={{ left: 0, right: 25 }}
                      >
                        <CartesianGrid
                          horizontal={false}
                          strokeDasharray="3 4"
                        />
                        <XAxis
                          type="number"
                          allowDecimals={false}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          dataKey="category"
                          type="category"
                          width={152}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          formatter={(v) => [number(Number(v)), "Tickets"]}
                        />
                        <Bar
                          dataKey="count"
                          fill="#577bce"
                          radius={[0, 4, 4, 0]}
                          barSize={17}
                          isAnimationActive={false}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <details className="chart-data">
                    <summary>View ticket counts</summary>
                    {d.complaints.map((c) => (
                      <p key={c.category}>
                        {c.category}
                        <strong>{c.count}</strong>
                      </p>
                    ))}
                  </details>
                </Card>
                <Card
                  className="insight-card"
                  title="Turn signals into a decision"
                  description="A guided, evidence-backed investigation"
                >
                  <span className="insight-icon">
                    <FileSearchIcon />
                  </span>
                  <h3>Connect the numbers to the context.</h3>
                  <p>
                    Investigate declining products alongside support patterns
                    and effective warranty clauses. Review every source before
                    exporting your findings.
                  </p>
                  {can("agents.execute") && (
                    <Link className="button secondary" to="/investigations/new">
                      Start an investigation
                      <ArrowRight size={16} />
                    </Link>
                  )}
                  <small>Offline analytical workflow · no model calls</small>
                </Card>
              </div>
            )}
          </>
        )
      )}
    </>
  );
}
function FileSearchIcon() {
  return <TrendingDown size={27} />;
}
