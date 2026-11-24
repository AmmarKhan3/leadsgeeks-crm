"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { CHECKLIST_GROUPS, CHECK_ORDER, checkLabel, checkHelp, LOGIN_URLS, type CheckStatus } from "@/lib/constants";
import { fmtDate } from "@/lib/format";
import { revealLogin, saveChecklistItem, setChecklistStatus } from "./actions";
import type { ChecklistRow } from "@/lib/data";

type LoginIdx = { item_key: string; login_url: string; username: string; updated_at: string };
type Props = { accountId: string; rows: ChecklistRow[]; logins: LoginIdx[]; canEdit: boolean; canLogins: boolean; website: string | null };

const TONE: Record<CheckStatus, string> = { have: "ok", requested: "warn", pending: "info", denied: "bad", removed: "muted", none: "muted" };

export function Checklist({ accountId, rows, logins, canEdit, canLogins, website }: Props) {
  const byKey = new Map(rows.map((r) => [r.item_key, r]));
  const loginFor = (k: string) => logins.find((l) => l.item_key === k);
  const [menu, setMenu] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [edit, setEdit] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    const h = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-pop]")) {
        setMenu(null);
        setOpen(null);
      }
    };
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, []);

  const relevant = rows.filter((r) => r.status !== "none");
  const have = relevant.filter((r) => r.status === "have").length;
  const pct = relevant.length ? Math.round((have / relevant.length) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="card card-b flex gap-6 items-center flex-wrap">
        <div className="w-16 h-16 rounded-full grid place-items-center text-sm font-semibold" style={{ background: `conic-gradient(var(--ok) ${pct}%, var(--line) 0)` }}>
          <span className="w-12 h-12 rounded-full bg-surface grid place-items-center">{pct}%</span>
        </div>
        <div className="flex-1 min-w-52">
          <b>
            {have} of {relevant.length} accesses in hand
          </b>
          {canLogins ? <span className="text-fg-3 text-xs ml-2">{logins.length} logins stored</span> : null}
          <div className="text-fg-3 text-xs mt-0.5">
            {[
              relevant.filter((r) => r.status === "requested").length ? `${relevant.filter((r) => r.status === "requested").length} waiting on the client` : "",
              relevant.filter((r) => r.status === "pending").length ? `${relevant.filter((r) => r.status === "pending").length} pending` : "",
              relevant.filter((r) => r.status === "denied").length ? `${relevant.filter((r) => r.status === "denied").length} denied` : "",
            ]
              .filter(Boolean)
              .join(" · ") || "Nothing outstanding"}
            {" · "}
            {rows.length - relevant.length} not needed
          </div>
        </div>
        <div className="text-fg-3 text-xs max-w-[38ch]">
          {canEdit ? `Click a status chip to change it. Click an item name to add a note or the login. The key opens the login page and shows the username and password (${canLogins ? "account team and admins only" : "you are not on this account's team"}).` : "View only. Logins are stored encrypted and only the account team can open them."}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 items-start">
        {CHECKLIST_GROUPS.map((g) => {
          const items = g.items.map((it) => ({ ...it, row: byKey.get(it.key) ?? { item_key: it.key, status: "pending" as CheckStatus, note: "", external_link: "", updated_at: "", updated_by: null, updater: null } }));
          const rel = items.filter((i) => i.row.status !== "none");
          const gHave = rel.filter((i) => i.row.status === "have").length;
          return (
            <div key={g.key} className="card">
              <div className="card-h">
                <h3>{g.label}</h3>
                <span className="ml-auto font-mono text-xs text-fg-3">
                  {gHave}/{rel.length}
                </span>
              </div>
              <div className="h-1 bg-line mx-5 mt-3 rounded">
                <div className="h-1 bg-ok rounded" style={{ width: `${rel.length ? (gHave / rel.length) * 100 : 0}%` }} />
              </div>
              <div className="px-5 py-2">
                {items.map(({ key, label, row }) => {
                  const lg = loginFor(key);
                  const st = row.status;
                  return (
                    <div key={key} className={`flex items-center gap-2.5 py-2 border-b border-line last:border-b-0 ${st === "none" ? "text-fg-3 line-through decoration-line-strong" : ""}`}>
                      {canEdit ? (
                        <button className="flex-1 min-w-0 text-left truncate hover:text-accent-deep hover:underline underline-offset-4 inline-flex items-center gap-1.5" onClick={() => setEdit(key)} title={row.note || "Add a note or login"}>
                          {label}
                          {row.note ? <span className="w-1.5 h-1.5 rounded-full bg-info shrink-0" title="Has a note" /> : null}
                        </button>
                      ) : (
                        <span className="flex-1 min-w-0 truncate" title={row.note}>
                          {label}
                        </span>
                      )}
                      {/* key */}
                      {st === "have" && lg && canLogins ? (
                        <span className="relative inline-flex" data-pop>
                          <button className={`text-accent-deep hover:text-accent ${open === key ? "text-accent" : ""}`} onClick={() => { setOpen(open === key ? null : key); setMenu(null); }} title="Open login details">
                            <KeyIcon />
                          </button>
                          {open === key ? <LoginPop accountId={accountId} itemKey={key} label={label} index={lg} canEdit={canEdit} onEdit={() => { setOpen(null); setEdit(key); }} /> : null}
                        </span>
                      ) : st === "have" && lg ? (
                        <span className="text-fg-3 cursor-not-allowed" title="Only the account team and admins can open this login">
                          <LockIcon />
                        </span>
                      ) : st === "have" && canLogins && canEdit ? (
                        <button className="text-fg-3 opacity-40 hover:opacity-100 hover:text-accent-deep" onClick={() => setEdit(key)} title="No login stored yet. Click to add it.">
                          <KeyIcon />
                        </button>
                      ) : (
                        <span className="w-[15px]" />
                      )}
                      {/* status chip */}
                      {canEdit ? (
                        <span className="relative inline-flex" data-pop>
                          <button className={`pill ${TONE[st]} ${pending ? "opacity-60" : ""}`} onClick={() => { setMenu(menu === key ? null : key); setOpen(null); }} title="Change status">
                            {checkLabel(key, st)} <span className="text-[10px]">▾</span>
                          </button>
                          {menu === key ? (
                            <div className="absolute right-0 top-full mt-1.5 z-30 min-w-64 card p-1.5 flex flex-col gap-0.5" role="menu">
                              {CHECK_ORDER.map((o) => (
                                <button key={o} className={`flex items-center gap-2.5 w-full px-2 py-1.5 rounded text-left hover:bg-surface-2 ${st === o ? "bg-surface-2 shadow-[inset_2px_0_0_var(--accent)]" : ""}`} onClick={() => { setMenu(null); start(() => setChecklistStatus(accountId, key, o)); }}>
                                  <span className={`pill ${TONE[o]} min-w-[92px] justify-center`}>{checkLabel(key, o)}</span>
                                  <span className="text-xs text-fg-3">{checkHelp(key, o)}</span>
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </span>
                      ) : (
                        <span className={`pill ${TONE[st]}`}>{checkLabel(key, st)}</span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="px-5 py-2.5 border-t border-line text-xs text-fg-3">
                {rel.length ? (rel.some((i) => i.row.status === "requested") ? `Waiting on client for ${rel.filter((i) => i.row.status === "requested").map((i) => i.label.split(" /")[0]).join(", ")}` : `Nothing outstanding${rel.some((i) => i.row.updated_at) ? ` · updated ${fmtDate(rel.map((i) => i.row.updated_at).sort().reverse()[0])}` : ""}`) : "Not needed for this client"}
              </div>
            </div>
          );
        })}
      </div>

      {edit ? <EditModal accountId={accountId} itemKey={edit} row={byKey.get(edit)} login={loginFor(edit)} canLogins={canLogins} website={website} onClose={() => setEdit(null)} /> : null}
    </div>
  );
}

function LoginPop({ accountId, itemKey, label, index, canEdit, onEdit }: { accountId: string; itemKey: string; label: string; index: LoginIdx; canEdit: boolean; onEdit: () => void }) {
  const [pw, setPw] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const act = (action: Parameters<typeof revealLogin>[2]) =>
    start(async () => {
      try {
        const r = await revealLogin(accountId, itemKey, action);
        if (action === "opened the login page") window.open(r.url || index.login_url, "_blank", "noopener");
        if (action === "revealed the password") {
          setPw(r.password);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => setPw(null), 20000);
        }
        if (action === "copied the password" || action === "copied the username") {
          const v = action === "copied the password" ? r.password : r.username;
          await navigator.clipboard?.writeText(v);
          setMsg(action === "copied the password" ? "Password copied · clear your clipboard when done" : "Username copied");
          if (action === "copied the password") setTimeout(() => navigator.clipboard?.writeText("").catch(() => {}), 30000);
          setTimeout(() => setMsg(""), 2500);
        }
      } catch (e) {
        setMsg((e as Error).message);
      }
    });

  return (
    <div className="absolute -left-3 top-full mt-2 z-40 w-[340px] max-w-[calc(100vw-48px)] card p-3 text-left whitespace-normal no-underline" style={{ textDecoration: "none" }}>
      <div className="flex items-center justify-between pb-1.5 border-b border-line mb-1">
        <b>{label}</b>
      </div>
      <Row l="Login page">
        <span className="flex-1 min-w-0 truncate text-[13px]" title={index.login_url}>
          {index.login_url.replace(/^https?:\/\//, "") || <span className="text-fg-3">No URL</span>}
        </span>
        <button className="btn sm primary" disabled={busy || !index.login_url} onClick={() => act("opened the login page")}>
          Open
        </button>
      </Row>
      <Row l="Username">
        <span className="flex-1 min-w-0 truncate font-mono text-[13px]">{index.username || <span className="text-fg-3">—</span>}</span>
        <button className="btn sm" disabled={busy || !index.username} onClick={() => act("copied the username")}>
          Copy
        </button>
      </Row>
      <Row l="Password">
        <span className="flex-1 min-w-0 truncate font-mono text-[13px]">{pw ?? "••••••••••••"}</span>
        <button className="btn sm" disabled={busy} onClick={() => (pw ? setPw(null) : act("revealed the password"))} title={pw ? "Hide" : "Reveal"}>
          {pw ? "Hide" : "Reveal"}
        </button>
        <button className="btn sm" disabled={busy} onClick={() => act("copied the password")}>
          Copy
        </button>
      </Row>
      <div className="flex items-center justify-between pt-1.5 border-t border-line mt-1 text-xs text-fg-3">
        <span>{msg || "Every open is logged"}</span>
        {canEdit ? (
          <button className="text-accent-deep font-semibold" onClick={onEdit}>
            Edit
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Row({ l, children }: { l: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className="w-[76px] shrink-0 text-[11px] uppercase tracking-wider text-fg-3">{l}</span>
      {children}
    </div>
  );
}

function EditModal({ accountId, itemKey, row, login, canLogins, website, onClose }: { accountId: string; itemKey: string; row?: ChecklistRow; login?: LoginIdx; canLogins: boolean; website: string | null; onClose: () => void }) {
  const [busy, start] = useTransition();
  const [show, setShow] = useState(false);
  const [pwTouched, setPwTouched] = useState(false);
  const label = CHECKLIST_GROUPS.flatMap((g) => g.items).find((i) => i.key === itemKey)?.label ?? itemKey;
  const site = (website ?? "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "") || "client-site.com";
  const gen = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!#%&*";
    const arr = new Uint32Array(16);
    crypto.getRandomValues(arr);
    const el = document.getElementById("pw") as HTMLInputElement;
    el.value = Array.from(arr, (v) => chars[v % chars.length]).join("");
    setShow(true);
    setPwTouched(true);
  };
  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-center justify-center p-4" onClick={onClose}>
      <form
        className="card w-full max-w-lg max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
        action={(fd) => {
          if (!pwTouched && login) fd.set("password_unchanged", "1");
          start(async () => {
            await saveChecklistItem(accountId, itemKey, fd);
            onClose();
          });
        }}
      >
        <div className="card-h">
          <h3>{label}</h3>
          <button type="button" className="ml-auto text-fg-3" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="card-b flex flex-col gap-3">
          <div className="field">
            <label>Status</label>
            <select name="status" defaultValue={row?.status ?? "pending"}>
              {CHECK_ORDER.map((o) => (
                <option key={o} value={o}>
                  {checkLabel(itemKey, o)}
                </option>
              ))}
            </select>
          </div>
          {canLogins ? (
            <>
              <div className="eyebrow mt-1">
                Login <span className="normal-case tracking-normal font-sans">· stored encrypted, visible to the account team and admins</span>
              </div>
              <div className="field">
                <label>Login page URL</label>
                <input name="login_url" type="url" defaultValue={login?.login_url ?? ""} placeholder={(LOGIN_URLS[itemKey] ?? "https://").replace("{site}", site)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="field">
                  <label>Username / email</label>
                  <input name="username" defaultValue={login?.username ?? ""} autoComplete="off" />
                </div>
                <div className="field">
                  <label>Password</label>
                  <div className="flex gap-1.5">
                    <input id="pw" name="password" type={show ? "text" : "password"} defaultValue="" placeholder={login ? "unchanged" : ""} autoComplete="new-password" className="flex-1 min-w-0" onChange={() => setPwTouched(true)} />
                    <button type="button" className="btn sm" onClick={() => setShow(!show)}>
                      {show ? "Hide" : "Show"}
                    </button>
                    <button type="button" className="btn sm" onClick={gen}>
                      Generate
                    </button>
                  </div>
                </div>
              </div>
              {login ? <div className="text-xs text-fg-3 -mt-1">Login last updated {fmtDate(login.updated_at)}. Clear the URL, username and password to remove it.</div> : null}
            </>
          ) : (
            <div className="banner info">Only the account team and admins can see or edit this item&apos;s login.</div>
          )}
          <div className="field">
            <label>
              External vault link <span className="text-fg-3 font-normal">(optional)</span>
            </label>
            <input name="external_link" type="url" defaultValue={row?.external_link ?? ""} placeholder="https://vault…" />
          </div>
          <div className="field">
            <label>Note</label>
            <textarea name="note" defaultValue={row?.note ?? ""} placeholder="Who we asked, when, anything odd about this login" />
          </div>
        </div>
        <div className="px-5 py-3 border-t border-line flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

function KeyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
