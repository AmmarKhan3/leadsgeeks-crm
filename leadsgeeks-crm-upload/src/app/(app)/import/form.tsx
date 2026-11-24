"use client";
import { useActionState } from "react";
import { importClients, type ImportResult } from "./actions";

export function ImportForm() {
  const [result, action, pending] = useActionState<ImportResult | null, FormData>(importClients, null);
  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="card card-b flex gap-3 items-end flex-wrap">
        <div className="field flex-1 min-w-60">
          <label>Filled-in template (.xlsx)</label>
          <input type="file" name="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required className="pt-1.5" />
        </div>
        <button className="btn primary" disabled={pending}>{pending ? "Importing…" : "Import"}</button>
      </form>
      {result ? (
        <div className="card">
          <div className="card-h"><h3>Result</h3><span className="ml-auto text-xs text-fg-3">{result.created.length} created · {result.skipped.length} skipped · {result.errors.length} failed</span></div>
          <div className="card-b flex flex-col gap-3 text-sm">
            {result.created.length ? <div><b className="text-ok">Created:</b> {result.created.join(", ")}</div> : null}
            {result.skipped.length ? <div><b>Skipped:</b> {result.skipped.map((s) => `row ${s.row} ${s.business} (${s.reason})`).join("; ")}</div> : null}
            {result.errors.length ? (
              <div>
                <b className="text-bad">Failed:</b>
                <ul className="list-disc pl-5">{result.errors.map((e) => <li key={e.row}>Row {e.row} {e.business}: {e.reason}</li>)}</ul>
                <p className="text-xs text-fg-3 mt-1">Fix those rows in the sheet and upload again; the created ones are skipped automatically.</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
