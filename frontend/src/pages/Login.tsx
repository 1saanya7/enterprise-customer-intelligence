import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Database,
  FileText,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { Button, ErrorPanel, Logo } from "../components/ui";

export function homeFor(capabilities: string[]) {
  return capabilities.includes("analytics.read")
    ? "/overview"
    : capabilities.includes("operations.read")
      ? "/operations"
      : "/agents";
}
export function Login() {
  const { user, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  if (user) return <Navigate to={homeFor(user.capabilities)} replace />;
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (error) {
      setError(error as Error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <section className="login-story">
        <Logo />
        <div className="login-copy">
          <div className="eyebrow">EVIDENCE-LED DECISIONS</div>
          <h1>
            A clearer view of
            <br />
            your business.
          </h1>
          <p>
            Bring product performance, customer signals and policy evidence into
            one trusted workspace.
          </p>
          <div className="identity-diagram" aria-hidden="true">
            <div className="diagram-sources">
              <div className="source-tile">
                <Database size={21} />
                <span>Business data</span>
              </div>
              <div className="source-tile">
                <FileText size={21} />
                <span>Enterprise knowledge</span>
              </div>
            </div>
            <div className="diagram-connector">
              <div className="diagram-line" />
              <div className="diagram-hub">
                <Logo compact />
              </div>
              <div className="diagram-line" />
            </div>
            <div className="source-tile result-tile">
              <BarChart3 size={22} />
              <span>Decisions with evidence</span>
            </div>
          </div>
          <div className="login-values">
            <span>
              <ShieldCheck size={16} /> Scoped access
            </span>
            <span>
              <FileText size={16} /> Traceable findings
            </span>
          </div>
        </div>
        <small>Northstar Intelligence · Enterprise product intelligence</small>
      </section>
      <section className="login-form-panel">
        <div className="login-mobile-brand">
          <Logo />
        </div>
        <form onSubmit={submit} className="login-form">
          <span className="login-lock">
            <LockKeyhole size={24} />
          </span>
          <h2>Welcome to your workspace</h2>
          <p>Sign in with your Northstar account to continue.</p>
          {error && <ErrorPanel error={error} />}
          <label htmlFor="email">Work email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@organisation.example"
          />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={256}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" busy={busy}>
            Sign in
            <ArrowRight size={17} />
          </Button>
          <p className="login-security">
            <LockKeyhole size={14} /> Your session is private to this browser.
          </p>
          <details className="evaluation-help">
            <summary>Need access to the workspace?</summary>
            <p>
              Sign in with an account provisioned by your workspace
              administrator. Self-service registration is not enabled.
            </p>
          </details>
        </form>
      </section>
    </div>
  );
}
