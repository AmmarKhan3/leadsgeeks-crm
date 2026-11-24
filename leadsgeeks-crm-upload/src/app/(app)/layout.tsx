import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile, createClient } from "@/lib/supabase/server";
import { perms } from "@/lib/perms";
import { ROLES } from "@/lib/constants";
import { Avatar } from "@/components/ui";
import { signOut } from "@/app/login/actions";
import { NavLink } from "@/components/nav-link";
import { MoneyToggle } from "@/components/money";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await getProfile();
  if (!me) redirect("/login");
  if (!me.active) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="card p-6 max-w-sm text-center">
          <h2 className="text-xl mb-2">Account deactivated</h2>
          <p className="text-fg-2">Ask an admin to reactivate your access.</p>
          <form action={signOut} className="mt-4">
            <button className="btn">Sign out</button>
          </form>
        </div>
      </div>
    );
  }
  const p = perms(me.role);
  const supabase = await createClient();
  const { count: unread } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", me.id).eq("read", false);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[var(--sidebar-w)_1fr]">
      <aside className="bg-ink text-white flex flex-col lg:sticky lg:top-0 lg:h-screen">
        <div className="h-[var(--topbar-h)] flex items-center gap-3 px-5 border-b border-white/10">
          <Image src="/logo.svg" alt="LeadsGeeks" width={75} height={32} priority />
          <span className="eyebrow text-white/40">Internal CRM</span>
        </div>
        <nav className="flex-1 p-3 flex flex-col gap-0.5 text-sm">
          <NavLink href="/dashboard">Dashboard</NavLink>
          <NavLink href="/accounts">{p.seesAll ? "All accounts" : me.role === "sales" ? "Closed accounts" : "My accounts"}</NavLink>
          {p.create ? <NavLink href="/accounts/new">New account</NavLink> : null}
          {p.manageUsers ? (
            <>
              <div className="eyebrow text-white/40 px-3 pt-4 pb-1">Admin</div>
              <NavLink href="/team">Team</NavLink>
              <NavLink href="/import">Import</NavLink>
            </>
          ) : null}
          <div className="eyebrow text-white/40 px-3 pt-4 pb-1">You</div>
          <NavLink href="/settings">Settings</NavLink>
        </nav>
        <div className="p-3 border-t border-white/10 flex items-center gap-3">
          <Avatar name={me.name} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold text-sm">{me.name}</div>
            <div className="text-xs text-white/50">{ROLES[me.role].label}</div>
          </div>
          <form action={signOut}>
            <button className="text-xs text-white/60 hover:text-white" title="Log out">
              Log out
            </button>
          </form>
        </div>
      </aside>
      <div className="min-w-0 flex flex-col">
        <header className="h-[var(--topbar-h)] bg-surface border-b border-line flex items-center gap-3 px-6 sticky top-0 z-20">
          <form action="/accounts" className="flex-1 max-w-md">
            <input name="q" type="search" placeholder={p.seesAll ? "Search all accounts" : "Search my accounts"} className="w-full h-9 px-3 rounded-[var(--radius)] border border-line bg-bg text-sm outline-none focus:border-accent" />
          </form>
          <div className="flex-1" />
          {p.billing ? <MoneyToggle /> : null}
          <Link href="/notifications" className="btn h-9 relative" title="Notifications">
            Inbox
            {unread ? <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center">{unread}</span> : null}
          </Link>
        </header>
        <main className="p-6 max-w-[1280px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
