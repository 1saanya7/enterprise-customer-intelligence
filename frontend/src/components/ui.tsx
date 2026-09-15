import { Component, useEffect, useId, useRef } from "react";
import type { ButtonHTMLAttributes, ErrorInfo, ReactNode } from "react";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  FileSearch,
  Info,
  Loader2,
  X,
} from "lucide-react";
import { ApiError } from "../lib/api";
import { initials, statusLabel } from "../lib/format";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand">
      <svg viewBox="0 0 40 40" width="36" height="36" aria-hidden="true">
        <rect width="40" height="40" rx="10" fill="#407bff" />
        <path
          d="M20 6 24 16 34 20 24 24 20 34 16 24 6 20 16 16Z"
          fill="white"
        />
        <path d="M20 14 26 20 20 26 14 20Z" fill="#173976" />
        <circle cx="20" cy="20" r="2.5" fill="#72d5d0" />
      </svg>
      {!compact && (
        <span>
          northstar<span className="brand-subtitle">INTELLIGENCE</span>
        </span>
      )}
    </span>
  );
}
export function Avatar({
  name,
  size = "normal",
}: {
  name: string;
  size?: "normal" | "large";
}) {
  return (
    <span className={`avatar ${size}`} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
export function Button({
  children,
  variant = "primary",
  busy,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  busy?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || busy}
      className={`button ${variant} ${className}`}
      aria-busy={busy}
    >
      {busy && <Loader2 size={16} className="spin" aria-hidden="true" />}
      {children}
    </button>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "blue";
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Status({ value }: { value: string }) {
  return (
    <Badge
      tone={
        value === "complete" || value === "success" || value === "approved"
          ? "success"
          : value === "failed" || value === "denied"
            ? "danger"
            : value === "insufficient_evidence"
              ? "warning"
              : "neutral"
      }
    >
      {statusLabel(value)}
    </Badge>
  );
}
export function Tip({ text }: { text: string }) {
  const id = useId();
  return (
    <span className="tip" tabIndex={0} aria-describedby={id}>
      <Info size={14} aria-label="More information" />
      <span id={id} className="tip-content" role="tooltip">
        {text}
      </span>
    </span>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="heading-actions">{actions}</div>}
    </div>
  );
}
export function Card({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {title && (
        <header className="card-heading">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
export function Metric({
  label,
  value,
  hint,
  change,
  icon,
  tip,
}: {
  label: string;
  value: ReactNode;
  hint: string;
  change?: number | null;
  icon?: ReactNode;
  tip?: string;
}) {
  return (
    <div className="metric">
      <div className="metric-label">
        {label}
        {tip && <Tip text={tip} />}
        <span className="metric-icon">{icon}</span>
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-foot">
        {change != null && (
          <span className={change < 0 ? "negative" : "positive"}>
            {change < 0 ? (
              <ArrowDownRight size={14} />
            ) : (
              <ArrowUpRight size={14} />
            )}{" "}
            {Math.abs(change).toFixed(1)}%
          </span>
        )}
        <span>{hint}</span>
      </div>
    </div>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <FileSearch size={26} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function ErrorPanel({
  error,
  retry,
}: {
  error: Error;
  retry?: () => void;
}) {
  return (
    <div role="alert" className="error-panel">
      <AlertCircle size={19} />
      <div>
        <strong>{error.message}</strong>
        {error instanceof ApiError && error.requestId && (
          <small>Reference: {error.requestId}</small>
        )}
      </div>
      {retry && (
        <Button variant="secondary" onClick={retry}>
          Retry
        </Button>
      )}
    </div>
  );
}
export function Loading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="loading" role="status" aria-label="Loading workspace data">
      <span className="sr-only">Loading workspace data</span>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="skeleton"
          style={{ height: i === 0 ? 90 : 160 }}
        />
      ))}
    </div>
  );
}
export function Notice({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "success" | "warning";
}) {
  return (
    <div className={`notice ${tone}`}>
      {tone === "success" ? <CheckCircle2 size={17} /> : <Info size={17} />}
      <span>{children}</span>
    </div>
  );
}
export function Dialog({
  open,
  onClose,
  title,
  children,
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const el = ref.current;
    if (open && el && !el.open) el.showModal();
    else if (!open && el?.open) el.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`dialog ${className}`}
      aria-labelledby={id}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <header>
        <h2 id={id}>{title}</h2>
        <Button variant="ghost" onClick={onClose} aria-label="Close dialog">
          <X size={18} />
        </Button>
      </header>
      {children}
    </dialog>
  );
}
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    /* Do not log rendered user data to external services. */
  }
  render() {
    return this.state.failed ? (
      <main className="fatal">
        <Logo />
        <Empty
          title="This view could not be displayed"
          description="Your saved investigations are safe. Reload the workspace to continue."
          action={
            <Button onClick={() => window.location.reload()}>
              Reload workspace
            </Button>
          }
        />
      </main>
    ) : (
      this.props.children
    );
  }
}
