import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
    <div className="min-h-screen flex items-center justify-center p-6">
      <form action={setPassword} className="card p-6 w-full max-w-sm flex flex-col gap-4">
        <h2 className="text-2xl">Set your password</h2>
        {sp.error ? <div className="banner bad">{sp.error}</div> : null}
        <div className="field">
          <label htmlFor="password">New password</label>
          <input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
          <span className="hint">At least 10 characters.</span>
        </div>
        <button className="btn primary h-10" type="submit">
          Save and continue
        </button>
      </form>
    </div>
  );
}
