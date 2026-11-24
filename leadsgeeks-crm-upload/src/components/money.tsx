"use client";
import { useSyncExternalStore } from "react";
import { usd } from "@/lib/format";

const KEY = "lg-crm-hide-money";
const EVT = "lg-money";

function read() {
  try {
    return localStorage.getItem(KEY) !== "0";
  } catch {
    return true;
  }
}
function subscribe(cb: () => void) {
  window.addEventListener(EVT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVT, cb);
    window.removeEventListener("storage", cb);
  };
}
const useHidden = () => useSyncExternalStore(subscribe, read, () => true);

/** Top-bar eye: dollar amounts are blurred by default, per browser. */
export function MoneyToggle() {
  const hidden = useHidden();
  const toggle = () => {
    try {
      localStorage.setItem(KEY, hidden ? "0" : "1");
    } catch {}
    window.dispatchEvent(new Event(EVT));
  };
  return (
    <button className="btn h-9" onClick={toggle} title={hidden ? "Show dollar amounts" : "Hide dollar amounts"} type="button">
      {hidden ? "Show $" : "Hide $"}
    </button>
  );
}

export function Money({ value }: { value: number }) {
  const hidden = useHidden();
  return <span className={`money font-mono ${hidden ? "blur" : ""}`}>{usd(value)}</span>;
}
