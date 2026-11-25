"use client";
import { useSyncExternalStore } from "react";
import { usd } from "@/lib/format";
import { Icon } from "./icons";

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
export const useHiddenMoney = () => useSyncExternalStore(subscribe, read, () => true);
export function setHiddenMoney(hidden: boolean) {
  try {
    localStorage.setItem(KEY, hidden ? "1" : "0");
  } catch {}
  window.dispatchEvent(new Event(EVT));
}

/** Top-bar eye: dollar amounts are blurred by default, per browser. */
export function MoneyToggle() {
  const hidden = useHiddenMoney();
  return (
    <button className={`iconbtn ${hidden ? "" : "on"}`} onClick={() => setHiddenMoney(!hidden)} aria-pressed={!hidden} title={hidden ? "Amounts hidden. Click to show dollar figures." : "Amounts visible. Click to hide dollar figures."} type="button">
      <Icon n={hidden ? "eyeOff" : "eye"} />
    </button>
  );
}

/** Settings-page switch for the same preference. */
export function MoneySwitch() {
  const hidden = useHiddenMoney();
  return (
    <label className="switch" style={{ justifyContent: "space-between", width: "100%" }}>
      <span>
        <b style={{ fontWeight: 500 }}>Hide dollar amounts</b>
        <span className="hint small" style={{ display: "block", color: "var(--fg-3)" }}>Blurs MRR, billing and upsell figures everywhere until you reveal them with the eye button in the top bar. Handy when sharing your screen.</span>
      </span>
      <input type="checkbox" checked={hidden} onChange={(e) => setHiddenMoney(e.target.checked)} />
      <i />
    </label>
  );
}

export function Money({ value, suffix }: { value: number; suffix?: string }) {
  const hidden = useHiddenMoney();
  return (
    <span className={`money num ${hidden ? "blur" : ""}`} title={hidden ? "Amounts are hidden. Use the eye button in the top bar to show them." : undefined}>
      {usd(value)}
      {suffix ? <span className="faint">{suffix}</span> : null}
    </span>
  );
}
