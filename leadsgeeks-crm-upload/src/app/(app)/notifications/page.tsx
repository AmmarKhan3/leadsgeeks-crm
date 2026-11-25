import Link from "next/link";
import { revalidatePath } from "next/cache";
import { getProfile, createClient } from "@/lib/supabase/server";
import { fmtDateTime } from "@/lib/format";
import { Empty, PageHead } from "@/components/ui";
import { Icon } from "@/components/icons";
import { PageTitle } from "@/components/page-title";

export const metadata = { title: "Inbox" };

const ICON: Record<string, string> = { assignment: "users", assigned: "users", report: "file", note: "message", payment: "dollar", request: "check", mention: "message", approval: "shield" };

async function markAllRead() {
  "use server";
  const me = await getProfile();
  const supabase = await createClient();
  if (me) await supabase.from("notifications").update({ read: true }).eq("user_id", me.id).eq("read", false);
  revalidatePath("/", "layout");
}

export default async function NotificationsPage() {
  const me = (await getProfile())!;
  const supabase = await createClient();
  const { data: items } = await supabase.from("notifications").select("*").eq("user_id", me.id).order("at", { ascending: false }).limit(100);
  const unread = (items ?? []).filter((i) => !i.read).length;
  return (
    <>
      <PageTitle title="Notifications" />
      <PageHead title="Notifications" sub={`${unread} unread`}>
        <form action={markAllRead}><button className="btn sm">Mark all read</button></form>
      </PageHead>
      <div className="card" style={{ maxWidth: 760 }}>
        {items?.length ? (
          <div className="notif" style={{ position: "static", width: "auto", maxWidth: "none", border: 0, boxShadow: "none" }}>
            {items.map((n) => (
              <Link key={n.id} href={n.account_id ? `/accounts/${n.account_id}` : "/notifications"} className={`ni ${n.read ? "" : "unread"}`} style={{ textDecoration: "none" }}>
                <span className="ic"><Icon n={ICON[n.type] ?? "bell"} /></span>
                <div>
                  <div>{n.text}</div>
                  <time>{fmtDateTime(n.at)}</time>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <Empty icon="bell" title="Nothing here yet" text="Assignments, requests, reports and approvals show up here." />
        )}
      </div>
    </>
  );
}
