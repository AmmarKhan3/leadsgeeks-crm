import { signIn } from "./actions";
import { Icon } from "@/components/icons";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string; sent?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="login">
      <section className="left">
        <svg className="bg" viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <g stroke="#ff5f1f" strokeWidth="1" fill="none" opacity=".5">
            <path d="M-20 120 L180 60 L340 200 L520 90 L640 260" /><path d="M60 420 L180 60" /><path d="M60 420 L340 200 L420 520 L180 640 L60 420" /><path d="M420 520 L640 260" /><path d="M180 640 L-20 760" /><path d="M420 520 L560 780" />
          </g>
          <g fill="#ff5f1f">
            <circle cx="180" cy="60" r="4" /><circle cx="340" cy="200" r="5" /><circle cx="60" cy="420" r="3" /><circle cx="420" cy="520" r="6" /><circle cx="180" cy="640" r="3" /><circle cx="520" cy="90" r="3" />
          </g>
        </svg>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="LeadsGeeks" />
        <div>
          <h1>Every client, every access, every report. <em>One place.</em></h1>
          <p className="tag-line">Local visibility. Real results. Better leads. This is the internal CRM for the customer success and backend teams.</p>
        </div>
        <p className="mono" style={{ color: "rgba(248,249,250,.45)" }}>INTERNAL · LEADSGEEKS CRM</p>
      </section>
      <section className="right">
        <form action={signIn} className="form">
          <h2>Sign in</h2>
          {sp.error ? <div className="banner bad"><Icon n="alert" /><div>{sp.error}</div></div> : null}
          {sp.sent ? <div className="banner info"><Icon n="info" /><div>Check your email for a link to set a new password.</div></div> : null}
          <input type="hidden" name="next" value={sp.next ?? "/dashboard"} />
          <div className="field">
            <label htmlFor="email">Work email</label>
            <input id="email" name="email" type="email" autoComplete="username" required placeholder="you@leadsgeeks.ai" />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required placeholder="••••••••" />
          </div>
          <button className="btn primary block" type="submit">Sign in</button>
          <button className="link small" type="submit" formAction={signIn} name="intent" value="reset" formNoValidate>Forgot password?</button>
          <p className="small faint">Accounts are created by an admin. If you have no login yet, ask your admin for an invite.</p>
        </form>
      </section>
    </div>
  );
}
