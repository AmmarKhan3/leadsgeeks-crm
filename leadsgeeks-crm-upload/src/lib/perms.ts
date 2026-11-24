import type { Role } from "@/lib/constants";
import type { Profile } from "@/lib/supabase/server";

export function perms(role: Role) {
  return {
    seesAll: role === "admin" || role === "lead",
    billing: role === "admin" || role === "cs",
    reassign: role === "admin" || role === "lead",
    upload: role === "admin" || role === "backend",
    editChecklist: role !== "sales",
    addNote: role !== "sales",
    create: role === "admin" || role === "lead" || role === "cs",
    manageUsers: role === "admin",
    importData: role === "admin",
    editAccount: role !== "sales",
    approve: role === "admin",
  };
}

export type AccountTeam = { cs_id: string | null; lead_id: string | null; backend: { user_id: string }[] };

/** Admins and the account team (CS owner, team lead, assigned backend) may open stored logins. */
export function canOpenLogins(me: Profile, a: AccountTeam) {
  return me.role === "admin" || a.cs_id === me.id || a.lead_id === me.id || a.backend.some((b) => b.user_id === me.id);
}
