import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getProfile } from "@/lib/supabase/server";
import { perms } from "@/lib/perms";
import { getAccount } from "@/lib/data";
import { INDUSTRY_GROUPS, US_STATES, SERVICES, PLATFORMS } from "@/lib/constants";
import { updateAccount } from "./actions";

export const metadata = { title: "Edit account" };

const OWNERS: [string, string][] = [["us", "LeadsGeeks"], ["client", "Client"], ["agency", "Other"]];

export default async function EditAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = (await getProfile())!;
  if (!perms(me.role).editAccount) redirect(`/accounts/${id}`);
  const a = await getAccount(id);
  if (!a) notFound();
  const contacts = [...a.contacts].sort((x, y) => Number(y.is_primary) - Number(x.is_primary));
  while (contacts.length < 3) contacts.push({ id: "", name: "", title: "", phone: "", email: "", is_primary: contacts.length === 0 });

  return (
    <div className="flex flex-col gap-4 max-w-4xl">
      <div className="text-xs text-fg-3">
        <Link href="/accounts" className="hover:underline">Accounts</Link> /{" "}
        <Link href={`/accounts/${a.id}`} className="hover:underline">{a.business}</Link> / Edit
      </div>
      <h2 className="text-2xl">Edit {a.business}</h2>
      <form action={updateAccount.bind(null, a.id)} className="flex flex-col gap-4">
        <div className="card">
          <div className="card-h"><h3>Business</h3></div>
          <div className="card-b grid md:grid-cols-2 gap-3">
            <div className="field md:col-span-2"><label>Business name *</label><input name="business" defaultValue={a.business} required /></div>
            <div className="field">
              <label>Industry *</label>
              <select name="industry" defaultValue={a.industry} required>
                {INDUSTRY_GROUPS.map((g) => (
                  <optgroup key={g.label} label={g.label}>{g.items.map((i) => <option key={i}>{i}</option>)}</optgroup>
                ))}
              </select>
            </div>
            <div className="field"><label>If Other, which industry?</label><input name="industry_other" defaultValue={a.industry_other ?? ""} /></div>
            <div className="field"><label>Business phone</label><input name="phone" type="tel" defaultValue={a.phone ?? ""} /></div>
            <div className="field"><label>Business email</label><input name="email" type="email" defaultValue={a.email ?? ""} /></div>
            <div className="field md:col-span-2"><label>Street</label><input name="street" defaultValue={a.street ?? ""} /></div>
            <div className="field"><label>City *</label><input name="city" defaultValue={a.city ?? ""} required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="field">
                <label>State *</label>
                <select name="state" defaultValue={a.state ?? ""} required>
                  <option value="">—</option>
                  {US_STATES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
                </select>
              </div>
              <div className="field"><label>ZIP</label><input name="zip" defaultValue={a.zip ?? ""} inputMode="numeric" pattern="[0-9]{5}" maxLength={5} /></div>
            </div>
            <div className="field"><label>Website</label><input name="website" type="url" defaultValue={a.website ?? ""} /></div>
            <div className="field"><label>Google Business Profile link</label><input name="gbp_url" type="url" defaultValue={a.gbp_url ?? ""} /></div>
            <div className="field"><label>Client since</label><input name="client_since" type="date" defaultValue={a.client_since} /></div>
          </div>
        </div>

        <div className="card">
          <div className="card-h"><h3>Contacts</h3><span className="ml-auto text-xs text-fg-3">The first row is the primary contact. Leave a row empty to remove it.</span></div>
          <div className="card-b flex flex-col gap-3">
            {contacts.map((c, i) => (
              <div key={i} className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <input type="hidden" name="contact_id" value={c.id} />
                <input name="contact_name" defaultValue={c.name} placeholder={i === 0 ? "Primary contact name" : "Name"} className="h-9 px-3 rounded-[var(--radius)] border border-line text-sm" />
                <input name="contact_title" defaultValue={c.title ?? ""} placeholder="Title" className="h-9 px-3 rounded-[var(--radius)] border border-line text-sm" />
                <input name="contact_phone" defaultValue={c.phone ?? ""} placeholder="Phone" className="h-9 px-3 rounded-[var(--radius)] border border-line text-sm" />
                <input name="contact_email" defaultValue={c.email ?? ""} placeholder="Email" className="h-9 px-3 rounded-[var(--radius)] border border-line text-sm" />
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-h"><h3>Services & website</h3></div>
          <div className="card-b flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {SERVICES.map((s) => (
                <label key={s} className="px-3 h-8 inline-flex items-center gap-2 rounded-full border border-line cursor-pointer text-sm has-[:checked]:bg-accent-soft has-[:checked]:border-accent has-[:checked]:text-accent-deep">
                  <input type="checkbox" name="services" value={s} defaultChecked={a.services.includes(s)} className="sr-only" />{s}
                </label>
              ))}
            </div>
            <div className="field"><label>Other service</label><input name="service_other" defaultValue={a.service_other ?? ""} placeholder="What else do we handle?" /></div>
            <div className="grid md:grid-cols-2 gap-3">
              {(["built_by", "hosted_by", "domain_by"] as const).map((k) => (
                <div key={k} className="grid grid-cols-2 gap-2">
                  <div className="field">
                    <label>{k === "built_by" ? "Built by" : k === "hosted_by" ? "Hosted by" : "Domain held by"}</label>
                    <select name={k} defaultValue={a[k]}>
                      {OWNERS.map(([v, l]) => <option key={v} value={v}>{k === "domain_by" && v === "agency" ? "Third party" : l}</option>)}
                    </select>
                  </div>
                  <div className="field"><label>Who (if other)</label><input name={`${k}_name`} defaultValue={a[`${k}_name`] ?? ""} /></div>
                </div>
              ))}
              <div className="field">
                <label>Platform</label>
                <select name="platform" defaultValue={a.platform}>{PLATFORMS.map((p) => <option key={p}>{p}</option>)}</select>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Link href={`/accounts/${a.id}`} className="btn">Cancel</Link>
          <button className="btn primary">Save changes</button>
        </div>
      </form>
    </div>
  );
}
