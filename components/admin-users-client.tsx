"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { formatLibraryDate } from "@/lib/dates";
import type { UserProfile } from "@/lib/types";
import { Icon } from "./icons";
import { EmptyState, PageHeading, Status } from "./ui";

export function AdminUsersClient() {
  const [users, setUsers] = useState<UserProfile[]>([]); const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true); const [pending, setPending] = useState(""); const [error, setError] = useState("");
  useEffect(() => { api.users().then(result => setUsers(result.items)).catch(caught => setError(caught instanceof Error ? caught.message : "Members could not be loaded.")).finally(() => setLoading(false)); }, []);
  const visible = useMemo(() => { const term = search.toLowerCase(); return users.filter(user => `${user.name} ${user.email}`.toLowerCase().includes(term)); }, [search, users]);
  async function toggleRole(user: UserProfile) { const role = user.role === "ADMIN" ? "MEMBER" : "ADMIN"; setPending(user.userId); setError(""); try { const updated = await api.updateUserRole(user.userId, role); setUsers(items => items.map(item => item.userId === updated.userId ? updated : item)); } catch (caught) { setError(caught instanceof Error ? caught.message : "The member role could not be updated."); } finally { setPending(""); } }
  return <><PageHeading eyebrow="Community" title="Members" description="View accounts, borrowing activity, and librarian access."/>{error && <div className="form-error" role="alert">{error}</div>}<div className="admin-tools"><label className="search-box"><Icon name="search"/><input aria-label="Search members" placeholder="Search members" value={search} onChange={event => setSearch(event.target.value)}/></label></div><section className="panel table-panel">{loading ? <div className="page-loading compact"><span className="auth-spinner"/></div> : visible.length === 0 ? <EmptyState icon="users" title="No members found" copy="Confirmed accounts will appear here."/> : <table><thead><tr><th>Member</th><th>Current loans</th><th>Joined</th><th>Role</th><th></th></tr></thead><tbody>{visible.map(user => <tr key={user.userId}><td><div className="member-cell"><span className="avatar">{user.name.split(" ").map(part => part[0]).join("").slice(0, 2)}</span><span><strong>{user.name}</strong><small>{user.email}</small></span></div></td><td>{user.currentLoanCount} {user.currentLoanCount === 1 ? "book" : "books"}</td><td>{user.createdAt ? formatLibraryDate(user.createdAt) : "—"}</td><td><Status status={user.role === "ADMIN" ? "ACTIVE" : "AVAILABLE"}/><small>{user.role === "ADMIN" ? "Librarian" : "Member"}</small></td><td><button disabled={pending === user.userId} onClick={() => toggleRole(user)} className="table-action">{pending === user.userId ? "Updating…" : user.role === "ADMIN" ? "Make member" : "Make librarian"}</button></td></tr>)}</tbody></table>}</section></>;
}
