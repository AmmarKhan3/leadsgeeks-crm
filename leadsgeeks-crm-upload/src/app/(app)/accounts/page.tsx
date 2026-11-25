import Link from "next/link";
import { Suspense } from "react";
import { getProfile } from "@/lib/supabase/server";
import { perms } from "@/lib/perms";
import { listAccounts, accountExtras, listTeam, type AccountFilters } from "@/lib/data";
import { STATUSES, SERVICES, INDUSTRY_GROUPS, US_STATES, ROLES } from "@/lib/constants";
import { PageHead } from "@/components/ui";
import { Icon } from "@/components/icons";
import { PageTitle } from "@/components/page-title";
import { AccountsTable } from "@/components/accounts-table";
import { FilterBar, type FilterDef } from "./filter-bar";

export const metadata = { title: "Accounts" };

export default async function AccountsPage({ searchParams }: { searchParams: Promise<AccountFilters> }) {
  const sp = await searchParams;
  const me = (await getProfile())!;
  const p = perms(me.role);
  const [all, list] = await Promise.all([listAccounts(), listAccounts(sp)]);
  const [extras, team] = await Promise.all([accountExtras(list, p.billing), p.seesAll ? listTeam() : Promise.resolve([])]);

  const count = (f: (a: (typeof all)[number]) => boolean) => all.filter(f).length;
  const defs: FilterDef[] = [
    { key: "status", label: "Status", options: STATUSES.map((s) => [s, s, count((a) => a.status === s)]) },
    { key: "service", label: "Service", options: SERVICES.map((s) => [s, s, count((a) => a.services.includes(s))]) },
    { key: "industry", label: "Industry", searchable: true, groups: INDUSTRY_GROUPS.map((g) => ({ label: g.label, options: g.items.map((i) => [i, i, count((a) => a.industry === i)] as [string, string, number]) })) },
    { key: "state", label: "State", searchable: true, options: US_STATES.filter(([c]) => all.some((a) => a.state === c)).map(([c, n]) => [c, `${n} (${count((a) => a.state === c)})`]) },
    ...(p.seesAll ? [{ key: "owner", label: "Owner", options: team.filter((u) => u.active && (u.role === "cs" || u.role === "backend")).map((u) => [u.id, `${u.name} (${ROLES[u.role].short})`, count((a) => a.cs_id === u.id || a.backend.some((b) => b.user_id === u.id))] as [string, string, number]) }] : []),
  ];
  const title = p.seesAll ? "All accounts" : me.role === "sales" ? "Closed accounts" : "My accounts";

  return (
    <>
      <PageTitle title="Accounts" />
      <PageHead title={title} sub={`${list.length} of ${all.length} accounts${p.seesAll ? "" : " assigned to you"}`}>
        {p.create ? (
          <Link href="/accounts/new" className="btn primary">
            <Icon n="plus" /> New account
          </Link>
        ) : null}
      </PageHead>
      <div className="card">
        <Suspense>
          <FilterBar defs={defs} placeholder="Search business, contact, city, phone…" />
        </Suspense>
        <AccountsTable rows={list} extras={extras} showMoney={p.billing} emptyTitle={all.length ? "No matches" : "No accounts assigned yet"} emptyText={all.length ? "Try clearing a filter." : "When an admin or team lead assigns you to an account it will show up here."} />
      </div>
    </>
  );
}
