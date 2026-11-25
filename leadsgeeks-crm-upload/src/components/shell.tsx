"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "./icons";
import { Avatar } from "./ui";
import { TopbarTitle } from "./page-title";
import { fmtDateTime } from "@/lib/format";

type Notif = { id: number; type: string; text: string; account_id: string | null; read: boolean; at: string };

/** App frame: dark sidebar (collapsible on phones), top bar, content. Mirrors the prototype's shell(). */
export function AppShell({ nav, me, roleLabel, signOut, search, topbarExtra, notifications, unread, markAllRead, children }: {
  nav: React.ReactNode;
  me: { name: string; email: string; role: string };
  roleLabel: string;
  signOut: () => Promise<void>;
  search: { placeholder: string };
  topbarExtra?: React.ReactNode;
  notifications: Notif[];
  unread: number;
  markAllRead: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const [seenPath, setSeenPath] = useState(path);
  if (seenPath !== path) {
    // close the phone drawer after navigating
    setSeenPath(path);
    setOpen(false);
  }

  return (
    <div className="app">
      <aside className={`sidebar ${open ? "open" : ""}`} id="sidebar">
        <div className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="LeadsGeeks" />
          <span className="brand-sub">Internal CRM</span>
        </div>
        <nav className="nav">{nav}</nav>
        <UserMenu me={me} roleLabel={roleLabel} signOut={signOut} />
      </aside>
      <div className={`overlay ${open ? "show" : ""}`} onClick={() => setOpen(false)} />
      <div className="main">
        <header className="topbar">
          <button className="hamburger" onClick={() => setOpen(!open)} aria-label="Menu" type="button">
            <Icon n="menu" />
          </button>
          <TopbarTitle />
          <div className="spacer" />
          <form className="search" action="/accounts" role="search">
            <Icon n="search" />
            <input type="search" name="q" placeholder={search.placeholder} aria-label="Search accounts" />
          </form>
          {topbarExtra}
          <Bell notifications={notifications} unread={unread} markAllRead={markAllRead} />
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}

function UserMenu({ me, roleLabel, signOut }: { me: { name: string; email: string; role: string }; roleLabel: string; signOut: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, [open]);
  return (
    <div className="sidebar-foot usermenu-wrap" ref={ref}>
      {open ? (
        <div className="usermenu" role="menu">
          <div className="um-head">
            <Avatar name={me.name} role={me.role} size="lg" />
            <div className="who">
              <b>{me.name}</b>
              <span>{me.email}</span>
              <span>{roleLabel}</span>
            </div>
          </div>
          <Link href="/dashboard" className="um-item" role="menuitem" onClick={() => setOpen(false)}>
            <Icon n="dashboard" />
            <span>Dashboard</span>
          </Link>
          <Link href="/settings" className="um-item" role="menuitem" onClick={() => setOpen(false)}>
            <Icon n="settings" />
            <span>My settings</span>
          </Link>
          <form action={signOut}>
            <button className="btn block um-signout" role="menuitem">
              <Icon n="logout" /> Sign out
            </button>
          </form>
        </div>
      ) : null}
      <button className={`me ${open ? "open" : ""}`} onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} type="button">
        <Avatar name={me.name} role={me.role} />
        <div className="who">
          <b>{me.name}</b>
          <span>{roleLabel}</span>
        </div>
        <span className="caret">
          <Icon n="chevron" />
        </span>
      </button>
    </div>
  );
}

const NOTIF_ICON: Record<string, string> = { assignment: "users", assigned: "users", report: "file", note: "message", payment: "dollar", request: "check", mention: "message", approval: "shield", invite: "users" };

function Bell({ notifications, unread, markAllRead }: { notifications: Notif[]; unread: number; markAllRead: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, [open]);
  return (
    <div className="bellwrap" ref={ref}>
      <button className="iconbtn" onClick={() => setOpen(!open)} aria-label="Notifications" type="button">
        <Icon n="bell" />
        {unread ? <span className="dot">{unread}</span> : null}
      </button>
      {open ? (
        <div className="notif">
          <div className="nh">
            <b>Notifications</b>
            <form action={markAllRead}>
              <button className="link small">Mark all read</button>
            </form>
          </div>
          {notifications.length ? (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`ni ${n.read ? "" : "unread"}`}
                onClick={() => {
                  setOpen(false);
                  router.push(n.account_id ? `/accounts/${n.account_id}` : "/notifications");
                }}
              >
                <span className="ic">
                  <Icon n={NOTIF_ICON[n.type] ?? "bell"} />
                </span>
                <div>
                  <div>{n.text}</div>
                  <time>{fmtDateTime(n.at)}</time>
                </div>
              </div>
            ))
          ) : (
            <div className="card-b muted small">Nothing yet. Assignments, requests, reports and approvals show up here.</div>
          )}
          <div className="nh" style={{ borderTop: "1px solid var(--line)", borderBottom: 0 }}>
            <Link href="/notifications" className="link small" onClick={() => setOpen(false)}>
              Open inbox
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
