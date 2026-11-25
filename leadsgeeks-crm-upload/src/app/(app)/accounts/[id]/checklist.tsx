"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { CHECKLIST_GROUPS, CHECK_ORDER, checkLabel, checkHelp, LOGIN_URLS, type CheckStatus } from "@/lib/constants";
import { fmtDate } from "@/lib/format";
import { Icon } from "@/components/icons";
import { Modal } from "@/components/modal";
import { revealLogin, saveChecklistItem, setChecklistStatus } from "./actions";
import type { ChecklistRow } from "@/lib/data";

type LoginIdx = { item_key: string; login_url: string; username: string; updated_at: string };
type Props = { accountId: string; rows: ChecklistRow[]; logins: LoginIdx[]; canEdit: boolean; canLogins: boolean; website: string | null };

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
    <>
      <div className="card">
        <div className="card-b" style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
          <div className="ring" style={{ ["--p" as string]: pct }}>
            <i>{pct}%</i>
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <b>
              {have} of {relevant.length} accesses in hand
            </b>
            {canLogins ? <span className="muted small" style={{ marginLeft: 8 }}>{logins.length} logins stored</span> : null}
            <div className="muted small">
              {[
                relevant.filter((r) => r.status === "requested").length ? `${relevant.filter((r) => r.status === "requested").length} waiting on the client` : "",
                relevant.filter((r) => r.status === "pending").length ? `${relevant.filter((r) => r.status === "pending").length} pending` : "",
                relevant.filter((r) => r.status === "denied").length ? `${relevant.filter((r) => r.status === "denied").length} denied` : "",
                relevant.filter((r) => r.status === "removed").length ? `${relevant.filter((r) => r.status === "removed").length} removed` : "",
              ]
                .filter(Boolean)
                .join(" · ") || "Nothing outstanding"}
              {" · "}
              {rows.length - relevant.length} not needed
            </div>
          </div>
          <div className="muted small" style={{ maxWidth: "38ch" }}>
            {canEdit ? (
              <>Click a status chip to change it. Click an item name to add a note or the login. The <Icon n="key" size={13} style={{ display: "inline", verticalAlign: -2 }} /> key opens the login page and shows the username and password ({canLogins ? "account team and admins only" : "you are not on this account's team"}).</>
            ) : (
              <><Icon n="eye" size={14} style={{ display: "inline", verticalAlign: -2 }} /> View only. Logins are stored encrypted and only the account team can open them.</>
            )}
          </div>
        </div>
      </div>

      <div className="b-grid">
        {CHECKLIST_GROUPS.map((g) => {
          const items = g.items.map((it) => ({ ...it, row: byKey.get(it.key) ?? { item_key: it.key, status: "pending" as CheckStatus, note: "", external_link: "", updated_at: "", updated_by: null, updater: null } }));
          const rel = items.filter((i) => i.row.status !== "none");
          const gHave = rel.filter((i) => i.row.status === "have").length;
          const req = rel.filter((i) => i.row.status === "requested");
          const pen = rel.filter((i) => i.row.status === "pending");
          const den = rel.filter((i) => ["denied", "removed"].includes(i.row.status));
          const parts: string[] = [];
          if (req.length) parts.push(`Waiting on client for ${req.map((i) => i.label.split(" /")[0]).join(", ")}`);
          if (pen.length) parts.push(`Pending: ${pen.map((i) => i.label.split(" /")[0]).join(", ")}`);
          if (den.length) parts.push(den.map((i) => `${i.label.split(" /")[0]} ${i.row.status}`).join(", "));
          const updated = rel.map((i) => i.row.updated_at).filter(Boolean).sort().reverse()[0];
          const foot = parts.length ? parts.join(" · ") : rel.length ? `Nothing outstanding${updated ? ` · updated ${fmtDate(updated)}` : ""}` : "Not needed for this client";
          return (
            <div key={g.key} className={`b-card ${req.length ? "has-req" : ""}`}>
              <h4>
                {g.label}
                <span className="mono">
                  {gHave}/{rel.length}
                </span>
              </h4>
              <div className="bar">
                <i style={{ width: `${rel.length ? (gHave / rel.length) * 100 : 0}%` }} />
              </div>
              {items.map(({ key, label, row }) => {
                const lg = loginFor(key);
                const st = row.status;
                return (
                  <div key={key} className={`b-item ${st}`}>
                    {canEdit ? (
                      <button className="n" onClick={() => setEdit(key)} title={row.note || "Add a note or login"} type="button">
                        {label}
                        {row.note ? <span className="note-dot" aria-label="Has a note" /> : null}
                      </button>
                    ) : (
                      <span className="n" title={row.note}>
                        {label}
                        {row.note ? <span className="note-dot" /> : null}
                      </span>
                    )}
                    {st === "have" && lg && canLogins ? (
                      <span className="ckwrap" data-pop>
                        <button className={`key on ${open === key ? "open" : ""}`} onClick={() => { setOpen(open === key ? null : key); setMenu(null); }} title="Open login details" type="button">
                          <Icon n="key" />
                        </button>
                        {open === key ? <LoginPop accountId={accountId} itemKey={key} label={label} index={lg} canEdit={canEdit} onEdit={() => { setOpen(null); setEdit(key); }} onClose={() => setOpen(null)} /> : null}
                      </span>
                    ) : st === "have" && lg ? (
                      <span className="key locked" title="Only the account team and admins can open this login">
                        <Icon n="lock" />
                      </span>
                    ) : st === "have" && canLogins && canEdit ? (
                      <button className="key faint" onClick={() => setEdit(key)} title="No login stored yet. Click to add it." type="button">
                        <Icon n="key" />
                      </button>
                    ) : (
                      <span className="key off">
                        <Icon n="key" />
                      </span>
                    )}
                    {canEdit ? (
                      <span className="ckwrap" data-pop>
                        <button className={`chip-status ${st} ${menu === key ? "open" : ""} ${pending ? "opacity-60" : ""}`} onClick={() => { setMenu(menu === key ? null : key); setOpen(null); }} title="Change status" type="button">
                          {checkLabel(key, st)} <Icon n="chevron" />
                        </button>
                        {menu === key ? (
                          <div className="ckmenu" role="menu">
                            {CHECK_ORDER.map((o) => (
                              <button key={o} type="button" className={`opt ${st === o ? "sel" : ""}`} onClick={() => { setMenu(null); start(() => setChecklistStatus(accountId, key, o)); }}>
                                <span className={`chip-status ${o} static`}>{checkLabel(key, o)}</span>
                                <span className="help">{checkHelp(key, o)}</span>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </span>
                    ) : (
                      <span className={`chip-status ${st} static`}>{checkLabel(key, st)}</span>
                    )}
                  </div>
                );
              })}
              <div className="b-foot">{foot}</div>
            </div>
          );
        })}
      </div>

      {edit ? <EditModal accountId={accountId} itemKey={edit} row={byKey.get(edit)} login={loginFor(edit)} canLogins={canLogins} website={website} onClose={() => setEdit(null)} /> : null}
    </>
  );
}

function LoginPop({ accountId, itemKey, label, index, canEdit, onEdit, onClose }: { accountId: string; itemKey: string; label: string; index: LoginIdx; canEdit: boolean; onEdit: () => void; onClose: () => void }) {
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
    <div className="login-pop" role="dialog" aria-label={`Login for ${label}`}>
      <div className="lp-head">
        <b>{label}</b>
        <button className="iconbtn sm" onClick={onClose} title="Close" type="button">
          <Icon n="x" />
        </button>
      </div>
      <div className="lp-row">
        <span className="lp-l">Login page</span>
        <span className="lp-v" title={index.login_url}>{index.login_url.replace(/^https?:\/\//, "") || <span className="faint">No URL</span>}</span>
        <button className="btn sm primary" disabled={busy || !index.login_url} onClick={() => act("opened the login page")} type="button">
          <Icon n="external" /> Open
        </button>
      </div>
      <div className="lp-row">
        <span className="lp-l">Username</span>
        <span className="lp-v mono">{index.username || <span className="faint">—</span>}</span>
        <button className="btn sm" disabled={busy || !index.username} onClick={() => act("copied the username")} type="button">Copy</button>
      </div>
      <div className="lp-row">
        <span className="lp-l">Password</span>
        <span className="lp-v mono">{pw ?? "••••••••••••"}</span>
        <button className="iconbtn sm" disabled={busy} onClick={() => (pw ? setPw(null) : act("revealed the password"))} title={pw ? "Hide" : "Reveal"} type="button">
          <Icon n={pw ? "eyeOff" : "eye"} />
        </button>
        <button className="btn sm" disabled={busy} onClick={() => act("copied the password")} type="button">Copy</button>
      </div>
      <div className="lp-foot">
        <span className="faint small">{msg || "Every open is logged"}</span>
        {canEdit ? <button className="link small" onClick={onEdit} type="button">Edit</button> : null}
      </div>
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
    <Modal title={label} onClose={onClose}>
      <form
        className="stack"
        style={{ gap: 14 }}
        action={(fd) => {
          if (!pwTouched && login) fd.set("password_unchanged", "1");
          start(async () => {
            await saveChecklistItem(accountId, itemKey, fd);
            onClose();
          });
        }}
      >
        <div className="field">
          <label htmlFor="m-status">Status</label>
          <select id="m-status" name="status" defaultValue={row?.status ?? "pending"}>
            {CHECK_ORDER.map((o) => (
              <option key={o} value={o}>{checkLabel(itemKey, o)}</option>
            ))}
          </select>
        </div>
        {canLogins ? (
          <>
            <div className="eyebrow" style={{ marginTop: 6 }}>
              Login <span className="muted" style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>· stored encrypted, visible to the account team and admins</span>
            </div>
            <div className="field">
              <label htmlFor="m-url">Login page URL</label>
              <input id="m-url" name="login_url" type="url" defaultValue={login?.login_url ?? ""} placeholder={(LOGIN_URLS[itemKey] ?? "https://").replace("{site}", site)} />
            </div>
            <div className="form-grid" style={{ gap: 12 }}>
              <div className="field">
                <label htmlFor="m-user">Username / email</label>
                <input id="m-user" name="username" defaultValue={login?.username ?? ""} autoComplete="off" />
              </div>
              <div className="field">
                <label htmlFor="pw">Password</label>
                <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                  <input id="pw" name="password" type={show ? "text" : "password"} defaultValue="" placeholder={login ? "unchanged" : ""} autoComplete="new-password" style={{ flex: 1, minWidth: 0 }} onChange={() => setPwTouched(true)} />
                  <button type="button" className="btn sm" onClick={() => setShow(!show)}>{show ? "Hide" : "Show"}</button>
                  <button type="button" className="btn sm" onClick={gen} title="Generate a strong password">Generate</button>
                </div>
              </div>
            </div>
            {login ? <div className="faint small" style={{ margin: "-4px 0 0" }}>Login last updated {fmtDate(login.updated_at)}. Clear the URL, username and password to remove it.</div> : null}
          </>
        ) : (
          <div className="banner info">
            <Icon n="lock" />
            <div className="small">Only the account team and admins can see or edit this item&apos;s login.</div>
          </div>
        )}
        <div className="field">
          <label htmlFor="m-link">External vault link <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label>
          <input id="m-link" name="external_link" type="url" defaultValue={row?.external_link ?? ""} placeholder="https://vault…" />
          <span className="hint">If this login also lives in a password manager, link the item here.</span>
        </div>
        <div className="field">
          <label htmlFor="m-note">Note</label>
          <textarea id="m-note" name="note" defaultValue={row?.note ?? ""} placeholder="Who we asked, when, anything odd about this login" />
        </div>
        <div className="modal-f" style={{ margin: "6px -20px -20px" }}>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </Modal>
  );
}
