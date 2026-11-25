"use client";
import { useState, useTransition } from "react";
import { ROLES, type Role } from "@/lib/constants";
import { Icon } from "@/components/icons";
import { ModalForm } from "@/components/modal";
import { inviteUser, setRole, setActive } from "./actions";

const ROLE_HINT = "Customer Success sees billing; Backend uploads reports; Team Lead sees everything except billing; Sales is view-only.";

export function InviteButton() {
  const [open, setOpen] = useState(false);
  const [busy, start] = useTransition();
  return (
    <>
      <button type="button" className="btn primary" onClick={() => setOpen(true)}>
        <Icon n="plus" /> Invite member
      </button>
      {open ? (
        <ModalForm title="Invite team member" onClose={() => setOpen(false)} submitLabel="Send invite" busy={busy} action={(fd) => start(() => inviteUser(fd))}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="m-un">Name</label>
              <input type="text" id="m-un" name="name" required autoFocus />
            </div>
            <div className="field">
              <label htmlFor="m-ue">Work email</label>
              <input type="email" id="m-ue" name="email" placeholder="name@agency.com" required />
            </div>
            <div className="field span2">
              <label htmlFor="m-ur">Role</label>
              <select id="m-ur" name="role" defaultValue="cs">
                {(Object.keys(ROLES) as Role[]).map((r) => (
                  <option key={r} value={r}>{ROLES[r].label}</option>
                ))}
              </select>
              <span className="hint">{ROLE_HINT}</span>
            </div>
          </div>
          <div className="banner info">
            <Icon n="info" />
            <div className="small">They get an email with a link to set their password.</div>
          </div>
        </ModalForm>
      ) : null}
    </>
  );
}

export function EditMemberButton({ user, isMe }: { user: { id: string; name: string; email: string; role: Role }; isMe: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, start] = useTransition();
  return (
    <>
      <button type="button" className="btn sm ghost" onClick={() => setOpen(true)} title="Edit member">
        <Icon n="edit" />
      </button>
      {open ? (
        <ModalForm title="Edit member" onClose={() => setOpen(false)} submitLabel="Save" busy={busy || isMe} action={(fd) => start(async () => { await setRole(user.id, fd); setOpen(false); })}>
          <div className="form-grid">
            <div className="field">
              <label>Name</label>
              <input type="text" value={user.name} disabled />
              <span className="hint">People change their own name under Settings.</span>
            </div>
            <div className="field">
              <label>Work email</label>
              <input type="email" value={user.email} disabled />
            </div>
            <div className="field span2">
              <label htmlFor="m-role">Role</label>
              <select id="m-role" name="role" defaultValue={user.role} disabled={isMe}>
                {(Object.keys(ROLES) as Role[]).map((r) => (
                  <option key={r} value={r}>{ROLES[r].label}</option>
                ))}
              </select>
              <span className="hint">{isMe ? "You can't change your own role." : ROLE_HINT}</span>
            </div>
          </div>
        </ModalForm>
      ) : null}
    </>
  );
}

export function ActiveSwitch({ userId, active, isMe }: { userId: string; active: boolean; isMe: boolean }) {
  const [busy, start] = useTransition();
  return (
    <label className="switch" style={{ opacity: busy ? 0.6 : 1 }}>
      <input type="checkbox" checked={active} disabled={isMe || busy} onChange={(e) => start(() => setActive(userId, e.target.checked))} />
      <i />
      <span className="small">{active ? "Active" : "Deactivated"}</span>
    </label>
  );
}
