import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Posts a line to the team Slack channel through the incoming webhook.
 * Silent when SLACK_WEBHOOK_URL is missing or the admin switched posting off.
 */
export async function notifySlack(text: string, accountId?: string) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return;
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("app_settings").select("value").eq("key", "slack").maybeSingle();
    const enabled = (data?.value as { enabled?: boolean } | null)?.enabled ?? true;
    if (!enabled) return;
    const link = accountId && process.env.NEXT_PUBLIC_APP_URL ? ` <${process.env.NEXT_PUBLIC_APP_URL}/accounts/${accountId}|Open>` : "";
    await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: text + link }) });
  } catch {
    // Slack being down must never break the action that triggered it.
  }
}
