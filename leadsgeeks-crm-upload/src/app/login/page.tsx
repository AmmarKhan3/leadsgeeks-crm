import Image from "next/image";
import { signIn } from "./actions";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string; sent?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="min-h-screen grid lg:grid-cols-[1.1fr_1fr]">
      <div className="hidden lg:flex flex-col justify-between bg-ink text-white p-10">
        <Image src="/logo.svg" alt="LeadsGeeks" width={104} height={44} priority />
        <div className="max-w-md">
          <h1 className="text-4xl leading-tight">
            Every client, every access, every report. <em className="text-accent not-italic">One place.</em>
          </h1>
          <p className="text-white/60 mt-4">Local visibility. Real results. Better leads. This is the internal CRM for the customer success and backend teams.</p>
        </div>
        <div className="eyebrow text-white/40">Internal · LeadsGeeks</div>
      </div>
      <div className="flex items-center justify-center p-6">
        <form action={signIn} className="w-full max-w-sm flex flex-col gap-4">
          <Image src="/logo.svg" alt="LeadsGeeks" width={75} height={32} className="lg:hidden invert" />
          <h2 className="text-2xl">Sign in</h2>
          {sp.error ? <div className="banner bad">{sp.error}</div> : null}
          {sp.sent ? <div className="banner info">Check your email for a link to set a new password.</div> : null}
          <input type="hidden" name="next" value={sp.next ?? "/dashboard"} />
          <div className="field">
            <label htmlFor="email">Work email</label>
            <input id="email" name="email" type="email" autoComplete="email" required placeholder="you@leadsgeeks.ai" />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          <button className="btn primary h-10" type="submit">
            Sign in
          </button>
          <button className="text-sm text-accent-deep font-semibold self-start" type="submit" formAction={signIn} name="intent" value="reset" formNoValidate>
            Forgot password?
          </button>
          <p className="text-xs text-fg-3">Accounts are created by an admin. If you have no login yet, ask Alex.</p>
        </form>
      </div>
    </div>
  );
}
