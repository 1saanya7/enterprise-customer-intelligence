export const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
export const compactMoney = (value: number) =>
  Math.abs(value) >= 10000000
    ? `₹${(value / 10000000).toFixed(2)} cr`
    : Math.abs(value) >= 100000
      ? `₹${(value / 100000).toFixed(1)} lakh`
      : money(value);
export const number = (value: number) =>
  new Intl.NumberFormat("en-IN").format(value);
export const dateTime = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
export const month = (value: string) =>
  new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "UTC" }).format(
    new Date(`${value}-01T00:00:00Z`),
  );
export const duration = (value: number | null) =>
  value === null
    ? "Not measured"
    : value < 1000
      ? `${value.toFixed(1)} ms`
      : `${(value / 1000).toFixed(2)} s`;
export const initials = (name: string) =>
  name
    .split(" ")
    .map((x) => x[0])
    .slice(0, 2)
    .join("");
export const statusLabel = (status: string) =>
  ({
    complete: "Completed",
    insufficient_evidence: "Needs evidence",
    failed: "Failed",
    running: "Running",
    queued: "Queued",
    success: "Success",
    denied: "Denied",
    accepted: "Accepted",
    approved: "Approved",
    skipped: "Not required",
  })[status] ?? status.replaceAll("_", " ");
