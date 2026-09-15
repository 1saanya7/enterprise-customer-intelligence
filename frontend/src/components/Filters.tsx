import { CalendarDays, MapPin } from "lucide-react";
import { useApi } from "../lib/queries";
import { workspaceSchema } from "../lib/contracts";
import { Badge, ErrorPanel } from "./ui";

export function Filters({
  period,
  region,
  onPeriod,
  onRegion,
}: {
  period: string;
  region: string;
  onPeriod: (value: string) => void;
  onRegion: (value: string) => void;
}) {
  const query = useApi("/workspace", workspaceSchema);
  const { data } = query;
  if (query.error)
    return (
      <ErrorPanel error={query.error} retry={() => void query.refetch()} />
    );
  return (
    <div className="filter-bar">
      <label>
        <CalendarDays size={16} />
        <span className="sr-only">Reporting quarter</span>
        <select
          aria-label="Reporting quarter"
          value={period}
          disabled={!data}
          onChange={(e) => onPeriod(e.target.value)}
        >
          {(data?.periods ?? [
            { value: period, label: "Loading reporting periods…" },
          ]).map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <MapPin size={16} />
        <span className="sr-only">Region</span>
        <select
          aria-label="Region"
          value={region}
          disabled={!data}
          onChange={(e) => onRegion(e.target.value)}
        >
          {(data?.regions ?? ["All regions"]).map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </label>
      <span className="filter-meta">
        <Badge>{data?.data_label ?? "Loading workspace"}</Badge>
        Calendar-quarter comparison
      </span>
    </div>
  );
}
