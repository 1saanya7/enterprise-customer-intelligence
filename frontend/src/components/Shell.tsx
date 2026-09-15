import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Activity,
  Bot,
  ChevronDown,
  ChevronRight,
  FileSearch,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Users,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { Avatar, Badge, Button, Dialog, ErrorPanel, Logo } from "./ui";

const navigation = [
  {
    to: "/overview",
    label: "Overview",
    icon: LayoutDashboard,
    capability: "analytics.read",
  },
  {
    to: "/investigations",
    label: "Investigations",
    icon: FileSearch,
    capability: "agents.execute",
  },
  {
    to: "/agents",
    label: "Agent workspace",
    icon: Bot,
    capability: "agents.read",
  },
  {
    to: "/operations",
    label: "Operations",
    icon: Activity,
    capability: "operations.read",
  },
  {
    to: "/access",
    label: "People & access",
    icon: Users,
    capability: "users.read",
  },
  { to: "/settings", label: "Workspace settings", icon: Settings },
];

export function Shell() {
  const { user, can, signOut } = useAuth();
  const location = useLocation();
  const [mobile, setMobile] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    setMobile(false);
    document.getElementById("main-content")?.focus();
  }, [location.pathname]);
  if (!user) return null;
  const current = navigation.find((n) => location.pathname.startsWith(n.to));
  const links = (
    <>
      <div className="nav-label">WORKSPACE</div>
      <nav aria-label="Main navigation">
        {navigation
          .filter((n) => !n.capability || can(n.capability))
          .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobile(false)}
            >
              <item.icon size={18} aria-hidden="true" />
              {item.label}
            </NavLink>
          ))}
      </nav>
    </>
  );
  return (
    <div className="app">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">
        <NavLink to="/" aria-label="Northstar home">
          <Logo />
        </NavLink>
        <div className="workspace-switch">
          <span className="org-mark">{user.organization[0]}</span>
          <div>
            {user.organization}
            <small>India workspace</small>
          </div>
        </div>
        {links}
        <div className="sidebar-profile">
          <Avatar name={user.name} />
          <div>
            {user.name}
            <small>{user.role_label}</small>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <Button
            variant="ghost"
            className="mobile-menu"
            aria-label="Open navigation"
            onClick={() => setMobile(true)}
          >
            <Menu size={21} />
          </Button>
          <div className="breadcrumbs">
            <span>Workspace</span>
            <ChevronRight size={13} />
            <span>{current?.label ?? "Investigation"}</span>
            {location.pathname.split("/").length > 2 && (
              <>
                <ChevronRight size={13} />
                <span>Details</span>
              </>
            )}
          </div>
          <div className="topbar-right">
            <Badge tone="blue">Private workspace</Badge>
            <details className="profile-menu">
              <summary aria-label="Account menu">
                <Avatar name={user.name} />
                <span>
                  {user.name}
                  <small>{user.department}</small>
                </span>
                <ChevronDown size={14} />
              </summary>
              <div className="profile-dropdown">
                <strong>{user.name}</strong>
                <small>{user.email}</small>
                <Badge>{user.role_label}</Badge>
                <NavLink to="/settings">Account & workspace</NavLink>
                <button
                  onClick={() => {
                    void signOut().catch(setError);
                  }}
                >
                  <LogOut size={16} />
                  Sign out
                </button>
              </div>
            </details>
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          {error && <ErrorPanel error={error} />}
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>Northstar Intelligence</span>
          <span>Sample enterprise data · INR · Asia/Kolkata</span>
        </footer>
      </div>
      <Dialog
        open={mobile}
        onClose={() => setMobile(false)}
        title="Workspace navigation"
        className="drawer"
      >
        <Logo />
        {links}
      </Dialog>
    </div>
  );
}
