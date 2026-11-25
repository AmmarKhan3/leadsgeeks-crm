"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Icon } from "@/components/icons";

export type FilterDef = { key: string; label: string; options?: [string, string, number?][]; groups?: { label: string; options: [string, string, number?][] }[]; searchable?: boolean };

/** Pill-style filter dropdowns + search, from the prototype's accounts list. State lives in the URL. */
export function FilterBar({ defs, placeholder }: { defs: FilterDef[]; placeholder: string }) {
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const [open, setOpen] = useState<string | null>(null);
  const [fs, setFs] = useState("");
  const [q, setQ] = useState(sp.get("q") ?? "");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, [open]);

  const setParam = (key: string, v: string) => {
    const p = new URLSearchParams(sp.toString());
    if (v) p.set(key, v);
    else p.delete(key);
    router.replace(`${path}?${p.toString()}`);
    setOpen(null);
    setFs("");
  };
  const allOpts = (d: FilterDef) => (d.groups ? d.groups.flatMap((g) => g.options) : d.options ?? []);
  const labelFor = (d: FilterDef, v: string) => allOpts(d).find((o) => o[0] === v)?.[1] ?? v;
  const active = defs.filter((d) => sp.get(d.key));

  const opt = (d: FilterDef, [v, l, cnt]: [string, string, number?]) => {
    const sel = (sp.get(d.key) ?? "") === v;
    if (fs && !l.toLowerCase().includes(fs.toLowerCase())) return null;
    return (
      <button key={v} className={`opt ${sel ? "sel" : ""}`} onClick={() => setParam(d.key, v)} type="button">
        {sel ? <Icon n="check" /> : <i />}
        <span>{l}</span>
        {cnt != null ? <span className="cnt">{cnt}</span> : null}
      </button>
    );
  };

  return (
    <>
      <div className="card-h filterbar" ref={ref}>
        <form
          className="search pillsearch"
          onSubmit={(e) => {
            e.preventDefault();
            setParam("q", q.trim());
          }}
        >
          <Icon n="search" />
          <input type="search" placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search accounts" />
        </form>
        <div className="fgroup">
          {defs.map((d) => {
            const v = sp.get(d.key) ?? "";
            return (
              <div key={d.key} className="fwrap">
                <button className={`fbtn ${v ? "on" : ""} ${open === d.key ? "open" : ""}`} onClick={() => { setOpen(open === d.key ? null : d.key); setFs(""); }} aria-haspopup="listbox" aria-expanded={open === d.key} type="button">
                  <span className="fl">{d.label}</span>
                  {v ? <span className="fv">{labelFor(d, v)}</span> : null}
                  <Icon n="chevron" />
                </button>
                {open === d.key ? (
                  <div className="fmenu" role="listbox">
                    {d.searchable ? (
                      <div className="fs">
                        <Icon n="search" />
                        <input type="text" placeholder="Type to filter…" value={fs} onChange={(e) => setFs(e.target.value)} autoFocus aria-label="Filter options" />
                      </div>
                    ) : null}
                    <button className={`opt ${v ? "" : "sel"}`} onClick={() => setParam(d.key, "")} type="button">
                      {v ? <i /> : <Icon n="check" />}
                      <span>Any {d.label.toLowerCase()}</span>
                    </button>
                    {d.groups
                      ? d.groups.map((g) => (
                          <div key={g.label}>
                            <div className="grp">{g.label}</div>
                            {g.options.map((o) => opt(d, o))}
                          </div>
                        ))
                      : (d.options ?? []).map((o) => opt(d, o))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        {sp.get("q") || active.length ? (
          <button className="link small" onClick={() => router.replace(path)} type="button">
            Clear all
          </button>
        ) : null}
      </div>
      {active.length ? (
        <div className="chipsrow">
          {active.map((d) => (
            <span key={d.key} className="fchip">
              {d.label}: <b>{labelFor(d, sp.get(d.key)!)}</b>
              <button onClick={() => setParam(d.key, "")} aria-label={`Remove ${d.label} filter`} type="button">
                <Icon n="x" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </>
  );
}
