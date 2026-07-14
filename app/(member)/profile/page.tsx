"use client";

import { FormEvent, useEffect, useState } from "react";
import { updateUserAttributes } from "aws-amplify/auth";
import { useAuth } from "@/components/auth-provider";
import { PageHeading } from "@/components/ui";
import { api } from "@/lib/api";

export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => setName(user?.name ?? ""), [user]);
  const initials = (user?.name ?? "Library member").split(" ").map(part=>part[0]).join("").slice(0,2).toUpperCase();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage("");
    try { await Promise.all([api.updateProfile(name), updateUserAttributes({ userAttributes: { name } })]); await refresh(); setMessage("Your profile has been updated."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Your profile could not be updated."); }
    finally { setPending(false); }
  }

  return <><PageHeading eyebrow="Account" title="Your profile" description="Keep your personal details up to date."/><div className="profile-grid"><section className="panel profile-card"><span className="profile-avatar">{initials}</span><h2>{user?.name}</h2><p>Library member</p><dl><div><dt>Books read</dt><dd>14</dd></div><div><dt>Currently borrowed</dt><dd>2</dd></div></dl></section><section className="panel form-panel"><h2>Personal information</h2><p>This information appears on your library account.</p><form onSubmit={submit}>{message && <div className="form-notice" role="status">{message}</div>}<label>Full name<input required maxLength={120} value={name} onChange={event=>setName(event.target.value)}/></label><label>Email address<input type="email" value={user?.email ?? ""} disabled readOnly/><small>Email is managed through your secure login.</small></label><button disabled={pending} className="button button-primary" type="submit">{pending ? "Saving…" : "Save changes"}</button></form></section></div></>;
}
