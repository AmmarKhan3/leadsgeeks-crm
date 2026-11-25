"use client";
import { useActionState, useState } from "react";
import { Icon } from "@/components/icons";
import { importClients, type ImportResult } from "./actions";

export function ImportForm() {
  const [result, action, pending] = useActionState<ImportResult | null, FormData>(importClients, null);
  const [file, setFile] = useState("");
  return (
    <div className="stack" style={{ gap: 14 }}>
      <form action={action} className="stack" style={{ gap: 12 }}>
        <label className="dropzone" htmlFor="import-file">
          <Icon n="upload" />
          <div>{file ? <b>{file}</b> : <><b>Drop the filled-in template here</b> or click to choose</>}</div>
          <div className="small faint">Excel file (.xlsx), Clients tab</div>
          <input type="file" id="import-file" name="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required onChange={(e) => setFile(e.target.files?.[0]?.name ?? "")} />
        </label>
        <div className="row">
          <button className="btn primary" disabled={pending || !file}><Icon n="check" /> {pending ? "Importing…" : "Import accounts"}</button>
          <span className="faint small">Industry names are matched to the list we serve; unmatched ones become &quot;Other&quot;.</span>
        </div>
      </form>
      {result ? (
        <div className="card">
          <div className="card-h"><h3>Result</h3><span className="muted small">{result.created.length} created · {result.skipped.length} skipped · {result.errors.length} failed</span></div>
          <div className="card-b stack" style={{ gap: 10 }}>
            {result.created.length ? <div><b style={{ color: "var(--ok)" }}>Created:</b> {result.created.join(", ")}</div> : null}
            {result.skipped.length ? <div><b>Skipped:</b> {result.skipped.map((s) => `row ${s.row} ${s.business} (${s.reason})`).join("; ")}</div> : null}
            {result.errors.length ? (
              <div>
                <b style={{ color: "var(--bad)" }}>Failed:</b>
                <ul style={{ paddingLeft: 18 }}>{result.errors.map((e) => <li key={e.row}>Row {e.row} {e.business}: {e.reason}</li>)}</ul>
                <p className="small faint" style={{ marginTop: 4 }}>Fix those rows in the sheet and upload again; the created ones are skipped automatically.</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
