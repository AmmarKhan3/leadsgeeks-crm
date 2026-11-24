import Link from "next/link";
import { revalidatePath } from "next/cache";
import { getProfile, createClient } from "@/lib/supabase/server";
import { fmtDateTime } from "@/lib/format";
import { Empty } from "@/components/ui";

export const metadata = { title: "Inbox" };

async function markAllRead() {
  "use server";
  const me = await getProfile();
  const supabase = await createClient();
  if (me) await supabase.from("notifications").update({ read: true }).eq("user_id", me.id).eq("read", false);
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}

export default async function NotificationsPage() {
  const me = (await getProfile())!;
  const supabase = await createClient();
  const { data: items } = await supabase.from("notifications").select("*").eq("user_id", me.id).order("at", { ascending: false }).limit(100);
  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <div className="flex items-end gap-3">
        <div>
          <h2 className="text-2xl">Inbox</h2>
          <p className="text-fg-2">{(items ?? []).filter((i) => !i.read).length} unread</p>
        </div>
        <div className="flex-1" />
        <form action={markAllRead}>
          <button className="btn sm">Mark all read</button>
        </form>
      </div>
      <div className="card">
        {items?.length ? (
          <ul className="divide-y divide-line">
            {items.map((n) => (
              <li key={n.id} className={`px-5 py-3 flex gap-3 ${n.read ? "" : "bg-accent-soft/40"}`}>
                <span className={`mt-2 w-2 h-2 rounded-full shrink-0 ${n.read ? "bg-line" : "bg-accent"}`} />
                <div className="flex-1 min-w-0">
                  {n.account_id ? (
                    <Link href={`/accounts/${n.account_id}`} className="font-medium hover:underline">
                      {n.text}
                    </Link>
                  ) : (
                    <span className="font-medium">{n.text}</span>
                  )}
                  <div className="text-xs text-fg-3">{fmtDateTime(n.at)}</div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty title="Nothing here yet" text="Assignments, requests, reports and approvals show up here." />
        )}
      </div>
    </div>
  );
}
