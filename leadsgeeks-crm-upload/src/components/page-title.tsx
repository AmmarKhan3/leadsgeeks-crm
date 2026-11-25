"use client";
import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

// Tiny store so each page can set the title shown in the top bar (like the prototype's shell(title)).
let current = "";
const subs = new Set<() => void>();
const set = (t: string) => {
  current = t;
  subs.forEach((f) => f());
};
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
};

export function PageTitle({ title }: { title: string }) {
  useEffect(() => {
    set(title);
    return () => set("");
  }, [title]);
  return null;
}

const FALLBACK: [RegExp, string][] = [
  [/^\/dashboard/, "Dashboard"],
  [/^\/accounts\/new/, "New account"],
  [/^\/accounts\/[^/]+\/edit/, "Edit account"],
  [/^\/accounts\/[^/]+/, "Account"],
  [/^\/accounts/, "Accounts"],
  [/^\/team/, "Team"],
  [/^\/import/, "Import accounts"],
  [/^\/settings/, "Settings"],
  [/^\/notifications/, "Notifications"],
];

export function TopbarTitle() {
  const t = useSyncExternalStore(subscribe, () => current, () => "");
  const path = usePathname();
  const fb = FALLBACK.find(([re]) => re.test(path))?.[1] ?? "";
  return <div className="title">{t || fb}</div>;
}
