import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getProfile, createClient } from "@/lib/supabase/server";
import { perms } from "@/lib/perms";
import { ROLES } from "@/lib/constants";
import { signOut } from "@/app/login/actions";
import { NavLink } from "@/components/nav-link";
import { MoneyToggle } from "@/components/money";
import { AppShell } from "@/components/shell";

async function markAllRead() {
  "use server";
  const me = await getProfile();
  const supabase = await createClient();
  if (me) await supabase.from("notifications").update({ read: true }).eq("user_id", me.id).eq("read", false);
  revalidatePath("/", "layout");
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await getProfile();
  if (!me) redirect("/login");
  if (!me.active) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="card card-b max-w-sm text-center">
          <h2 className="text-xl mb-2">Account deactivated</h2>
          <p className="muted">Ask an admin to reactivate your access.</p>
          <form action={signOut} className="mt-4">
            <button className="btn">Sign out</button>
          </form>
        </div>
      </div>
    );
  }
  const p = perms(me.role);
  const supabase = await createClient();
  const [{ count: accountCount }, { data: notifs }] = await Promise.all([
    supabase.from("accounts").select("id", { count: "exact", head: true }),
    supabase.from("notifications").select("id, type, text, account_id, read, at").eq("user_id", me.id).order("at", { ascending: false }).limit(12),
  ]);
  const unread = (notifs ?? []).filter((n) => !n.read).length;

  const nav = (
    <>
      <NavLink href="/dashboard" icon="dashboard">Dashboard</NavLink>
      <NavLink href="/accounts" icon="accounts" count={accountCount ?? 0}>
        {p.seesAll ? "All accounts" : me.role === "sales" ? "Closed accounts" : "My accounts"}
      </NavLink>
      {p.create ? <NavLink href="/accounts/new" icon="plus">New account</NavLink> : null}
      {p.manageUsers ? (
        <>
          <div className="nav-label">Admin</div>
          <NavLink href="/team" icon="users">Team</NavLink>
          <NavLink href="/import" icon="upload">Import</NavLink>
        </>
      ) : null}
      <div className="nav-label">You</div>
      <NavLink href="/settings" icon="settings">Settings</NavLink>
    </>
  );

  return (
    <AppShell
      nav={nav}
      me={{ name: me.name, email: me.email, role: me.role }}
      roleLabel={ROLES[me.role].label}
      signOut={signOut}
      search={{ placeholder: p.seesAll ? "Search all accounts" : "Search my accounts" }}
      topbarExtra={p.billing ? <MoneyToggle /> : null}
      notifications={notifs ?? []}
      unread={unread}
      markAllRead={markAllRead}
    >
      {children}
    </AppShell>
  );
}
