import { redirect } from "next/navigation";
import { getProfile } from "@/lib/supabase/server";
import { ImportForm } from "./form";

export const metadata = { title: "Import" };

export default async function ImportPage() {
  const me = (await getProfile())!;
  if (me.role !== "admin") redirect("/dashboard");
  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <h2 className="text-2xl">Import clients</h2>
      <div className="card card-b text-sm text-fg-2 flex flex-col gap-2">
        <p>Fill in the <b>LeadsGeeks client import template</b> (Excel, Clients tab) and upload it here. Each row becomes a live account with its contact, team, services, billing and checklist statuses.</p>
        <ul className="list-disc pl-5 text-xs text-fg-3">
          <li>Invite the team first (Team page): CS owner, team lead and backend names must match team members exactly.</li>
          <li>Rows whose business name already exists are skipped. The EXAMPLE row is ignored.</li>
          <li>Imported accounts are approved immediately because an admin imports them.</li>
        </ul>
      </div>
      <ImportForm />
    </div>
  );
}
