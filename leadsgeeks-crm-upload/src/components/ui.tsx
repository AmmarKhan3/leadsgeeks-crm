import Link from "next/link";
import { initials } from "@/lib/format";
import { STATUS_TONE, ROLES, type AccountStatus, type Role } from "@/lib/constants";
import { Icon } from "./icons";

export function Avatar({ name, role, size }: { name: string; role?: Role | string | null; size?: "sm" | "lg" }) {
  return (
    <span className={`avatar ${role ? `role-${role}` : ""} ${size ?? ""}`} title={role && role in ROLES ? `${name} · ${ROLES[role as Role].label}` : name}>
      {initials(name || "?") || "—"}
    </span>
  );
}

/** Avatar + name, like the prototype's person(). */
export function Person({ name, role, size, sub }: { name?: string | null; role?: Role | string | null; size?: "sm" | "lg"; sub?: string }) {
  if (!name) return <span className="person"><span className={`avatar ${size ?? ""}`}>—</span><span className="pn muted">Unassigned</span></span>;
  return (
    <span className="person">
      <Avatar name={name} role={role} size={size} />
      <span className="pn">
        {name}
        {sub ? <span className="sub faint small block">{sub}</span> : null}
      </span>
    </span>
  );
}

export function Pill({ tone = "muted", plain, children, className }: { tone?: string; plain?: boolean; children: React.ReactNode; className?: string }) {
  return <span className={`pill ${tone} ${plain ? "plain" : ""} ${className ?? ""}`}>{children}</span>;
}

export function StatusPill({ status }: { status: AccountStatus }) {
  return <Pill tone={STATUS_TONE[status] ?? "muted"}>{status}</Pill>;
}

export function ApprovalChip({ approval }: { approval: string }) {
  if (approval === "pending") return <Pill tone="warn" plain>Pending approval</Pill>;
  if (approval === "rejected") return <Pill tone="bad" plain>Rejected</Pill>;
  return null;
}

export const ROLE_TONE: Record<string, string> = { admin: "accent", lead: "accent", cs: "info", backend: "ok", sales: "warn" };

export function RolePill({ role }: { role: Role }) {
  return <Pill tone={ROLE_TONE[role]} plain>{ROLES[role].label}</Pill>;
}

export function SpecChip({ s }: { s: string }) {
  return <span className={`spec ${s}`}>{s}</span>;
}

export function Tags({ items, max = 99 }: { items: string[]; max?: number }) {
  return (
    <span className="tags">
      {items.slice(0, max).map((s) => (
        <span key={s} className="tag">{s}</span>
      ))}
      {items.length > max ? <span className="tag more">+{items.length - max}</span> : null}
    </span>
  );
}

export function Progress({ have, total }: { have: number; total: number }) {
  const pct = total ? Math.round((have / total) * 100) : 0;
  const tone = pct === 100 ? "" : pct >= 60 ? "warn" : "bad";
  return (
    <span className="progress-line">
      <span className={`progress ${tone}`}><i style={{ width: `${pct}%` }} /></span>
      <span className="mono num">{have}/{total}</span>
    </span>
  );
}

type BackendRow = { user_id: string; specialty: string; profile: { name: string } | null };

/** Stacked avatars + first names, like the prototype's teamStack(). */
export function TeamStack({ backend }: { backend: BackendRow[] }) {
  const b = backend.filter((x) => x.profile);
  if (!b.length) return <span className="faint">Unassigned</span>;
  return (
    <>
      <span className="stack2">
        {b.map((x) => (
          <span key={x.user_id + x.specialty} className="avatar role-backend sm" title={`${x.profile!.name} · ${x.specialty}`}>{initials(x.profile!.name)}</span>
        ))}
      </span>
      <span className="small muted stack-names">{b.map((x) => `${x.profile!.name.split(" ")[0]} · ${x.specialty}`).join(", ")}</span>
    </>
  );
}

export function TeamList({ backend, size }: { backend: BackendRow[]; size?: "sm" }) {
  const b = backend.filter((x) => x.profile);
  if (!b.length) return <span className="faint">Unassigned</span>;
  const prim = (b.find((x) => x.specialty === "SEO") ?? b[0]).user_id;
  return (
    <div className="team-list">
      {b.map((x) => (
        <span key={x.user_id + x.specialty} className="member">
          <Avatar name={x.profile!.name} role="backend" size={size} />
          <span className="pn">{x.profile!.name}</span>
          <SpecChip s={x.specialty} />
          {x.user_id === prim && x.specialty === "SEO" ? <span className="faint small">primary</span> : null}
        </span>
      ))}
    </div>
  );
}

export function Empty({ icon = "inbox", title, text, children }: { icon?: string; title: string; text?: string; children?: React.ReactNode }) {
  return (
    <div className="empty">
      <Icon n={icon} />
      <h4>{title}</h4>
      {text ? <p>{text}</p> : null}
      {children}
    </div>
  );
}

export function Stat({ label, value, detail, alert, href, small }: { label: string; value: React.ReactNode; detail?: React.ReactNode; alert?: boolean; href?: string; small?: boolean }) {
  const inner = (
    <>
      <span className="k">{label}</span>
      <span className="v num" style={small ? { fontSize: 22 } : undefined}>{value}</span>
      {detail !== undefined ? <span className="d">{detail}</span> : null}
    </>
  );
  const cls = `card stat ${alert ? "alert" : ""}`;
  return href ? (
    <Link href={href} className={cls} style={{ textDecoration: "none" }}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

export function PageHead({ title, sub, children, eyebrow }: { title: React.ReactNode; sub?: React.ReactNode; children?: React.ReactNode; eyebrow?: string }) {
  return (
    <div className="page-head">
      <div>
        {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
        <h2>{title}</h2>
        {sub ? <p className="muted">{sub}</p> : null}
      </div>
      <div className="spacer" />
      {children}
    </div>
  );
}

export function Banner({ tone, icon, children, actions }: { tone: "warn" | "info" | "ok" | "bad"; icon?: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className={`banner ${tone} ${actions ? "approval" : ""}`}>
      {icon ? <Icon n={icon} /> : null}
      <div>{children}</div>
      {actions ? <div className="row">{actions}</div> : null}
    </div>
  );
}

/** Prototype-style toggle. Wrap in a form or pass onChange from a client component. */
export function Switch({ name, checked, label, hint, onChange, defaultChecked, disabled }: { name?: string; checked?: boolean; defaultChecked?: boolean; label?: React.ReactNode; hint?: React.ReactNode; onChange?: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="switch" style={label ? { justifyContent: "space-between", width: "100%" } : undefined}>
      {label ? (
        <span>
          <b style={{ fontWeight: 500 }}>{label}</b>
          {hint ? <span className="hint small" style={{ display: "block", color: "var(--fg-3)" }}>{hint}</span> : null}
        </span>
      ) : null}
      <input type="checkbox" name={name} value="1" checked={checked} defaultChecked={defaultChecked} onChange={onChange ? (e) => onChange(e.target.checked) : undefined} disabled={disabled} />
      <i />
    </label>
  );
}
