import { initials } from "@/lib/format";
import { STATUS_TONE, type AccountStatus } from "@/lib/constants";

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  return (
    <span className={`avatar ${size === "sm" ? "sm" : ""}`} title={name}>
      {initials(name)}
    </span>
  );
}

export function Person({ name, sub, size = "md" }: { name?: string | null; sub?: string; size?: "sm" | "md" }) {
  if (!name) return <span className="text-fg-3">Not assigned</span>;
  return (
    <span className="inline-flex items-center gap-2 min-w-0">
      <Avatar name={name} size={size} />
      <span className="min-w-0">
        <span className="block truncate">{name}</span>
        {sub ? <span className="block text-xs text-fg-3 truncate">{sub}</span> : null}
      </span>
    </span>
  );
}

export function Pill({ tone = "muted", children }: { tone?: string; children: React.ReactNode }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

export function StatusPill({ status }: { status: AccountStatus }) {
  return <Pill tone={STATUS_TONE[status]}>{status}</Pill>;
}

export function Empty({ title, text }: { title: string; text?: string }) {
  return (
    <div className="px-5 py-10 text-center">
      <div className="font-semibold">{title}</div>
      {text ? <div className="text-fg-3 text-sm mt-1">{text}</div> : null}
    </div>
  );
}

export function Stat({ label, value, tone, href }: { label: string; value: React.ReactNode; tone?: string; href?: string }) {
  const inner = (
    <>
      <div className="eyebrow">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : ""}`}>{value}</div>
    </>
  );
  return href ? (
    <a href={href} className="card p-4 block hover:border-line-strong">
      {inner}
    </a>
  ) : (
    <div className="card p-4">{inner}</div>
  );
}
