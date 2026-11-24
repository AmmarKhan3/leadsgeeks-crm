import { redirect } from "next/navigation";
import { getProfile } from "@/lib/supabase/server";
import { perms } from "@/lib/perms";
import { listTeam } from "@/lib/data";
import { NewAccountForm } from "./form";

export const metadata = { title: "New account" };

export default async function NewAccountPage() {
  const me = (await getProfile())!;
  if (!perms(me.role).create) redirect("/dashboard");
  const team = await listTeam();
  return (
    <div className="flex flex-col gap-4 max-w-5xl">
      <div>
        <h2 className="text-2xl">New account</h2>
        <p className="text-fg-2">Business and contact, then services and website, then the team. {me.role === "cs" ? "You will be the CS owner; pick a team lead who assigns the backend team." : ""}</p>
      </div>
      <NewAccountForm me={me} team={team} />
    </div>
  );
}
