import { redirect } from "next/navigation";
import { getProfile } from "@/lib/supabase/server";
import { PageHead } from "@/components/ui";
import { PageTitle } from "@/components/page-title";
import { ImportForm } from "./form";

export const metadata = { title: "Import" };

export default async function ImportPage() {
  const me = (await getProfile())!;
  if (me.role !== "admin") redirect("/dashboard");
  return (
    <>
      <PageTitle title="Import accounts" />
      <PageHead title="Import accounts" sub="Bring your current client spreadsheet in. Fill in the LeadsGeeks client import template and upload it here." />
      <div className="card" style={{ maxWidth: 820 }}>
        <div className="card-b stack" style={{ gap: 14 }}>
          <ImportForm />
          <ul className="small muted" style={{ paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
            <li>Each row becomes a live account with its contact, team, services, billing and checklist statuses.</li>
            <li>Invite the team first (Team page): CS owner, team lead and backend names must match team members exactly.</li>
            <li>Rows whose business name already exists are skipped. The EXAMPLE row is ignored.</li>
            <li>Imported accounts are approved immediately because an admin imports them.</li>
          </ul>
        </div>
      </div>
    </>
  );
}
