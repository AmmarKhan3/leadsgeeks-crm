import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Icon } from "@/components/icons";

export const metadata = { title: "Set password" };

async function setPassword(formData: FormData) {
  "use server";
  const password = String(formData.get("password") ?? "");
  if (password.length < 10) redirect("/reset-password?error=" + encodeURIComponent("Use at least 10 characters."));
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect("/reset-password?error=" + encodeURIComponent(error.message));
  redirect("/dashboard");
}

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="login" style={{ gridTemplateColumns: "1fr" }}>
      <section className="right">
        <form action={setPassword} className="form card card-b" style={{ gap: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="LeadsGeeks" style={{ width: 75, height: 32, filter: "invert(1)" }} />
          <h2>Set your password</h2>
          {sp.error ? <div className="banner bad"><Icon n="alert" /><div>{sp.error}</div></div> : null}
          <div className="field">
            <label htmlFor="password">New password</label>
            <input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
            <span className="hint">At least 10 characters.</span>
          </div>
          <button className="btn primary block" type="submit">Save and continue</button>
        </form>
      </section>
    </div>
  );
}
