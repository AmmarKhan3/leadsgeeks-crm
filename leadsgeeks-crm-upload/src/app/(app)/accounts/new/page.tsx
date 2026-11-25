import { redirect } from "next/navigation";
import { getProfile } from "@/lib/supabase/server";
import { perms } from "@/lib/perms";
import { listTeam } from "@/lib/data";
import { PageHead } from "@/components/ui";
import { PageTitle } from "@/components/page-title";
import { NewAccountForm } from "./form";

export const metadata = { title: "New account" };

export default async function NewAccountPage() {
  const me = (await getProfile())!;
  if (!perms(me.role).create) redirect("/dashboard");
  const team = await listTeam();
  return (
    <>
      <PageTitle title="New account" />
      <PageHead title="New account" sub="Create the client record after the sale closes, then assign the team." />
      <NewAccountForm me={me} team={team} />
    </>
  );
}
