"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "./icons";
import { Logo } from "./ui";
import { AuthGuard, useAuth } from "./auth-provider";

const memberLinks = [
  ["/dashboard", "home", "Overview"], ["/catalog", "search", "Discover"], ["/read", "book", "Read online"], ["/borrowed", "book", "My books"], ["/history", "history", "History"], ["/profile", "user", "Profile"],
];
const adminLinks = [
  ["/admin", "home", "Overview"], ["/admin/books", "book", "Books"], ["/admin/users", "users", "Members"], ["/admin/loans", "history", "Borrowing"], ["/admin/overdue", "warning", "Overdue"], ["/admin/reports", "chart", "Reports"],
];

export function AppShell({ children, admin = false }: { children: React.ReactNode; admin?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const links = admin ? adminLinks : memberLinks;
  const initials = (user?.name ?? "Library member").split(" ").map(part => part[0]).join("").slice(0, 2).toUpperCase();
  async function handleLogout() { await logout(); router.replace("/login"); }
  return <AuthGuard admin={admin}><div className="app-shell"><aside className="sidebar"><Logo inverse/><div className="sidebar-context"><span>{admin ? "Library workspace" : "Member account"}</span><strong>{admin ? "Mandstacks" : user?.name}</strong></div><nav aria-label={admin ? "Admin navigation" : "Member navigation"}>{links.map(([href, icon, label]) => { const active = href === (admin ? "/admin" : "/dashboard") ? pathname === href : pathname.startsWith(href); return <Link className={active ? "active" : ""} href={href} key={href}><Icon name={icon}/><span>{label}</span></Link>; })}</nav><div className="sidebar-footer">{(admin || user?.isAdmin) && <Link href={admin ? "/dashboard" : "/admin"} className="role-switch"><span className="avatar">{initials}</span><span><small>Switch workspace</small><strong>{admin ? "Member view" : "Admin view"}</strong></span></Link>}<button className="sidebar-logout" onClick={handleLogout}><Icon name="logout"/>Sign out</button></div></aside><div className="app-stage"><header className="mobile-app-header"><Logo/><span className="avatar">{initials}</span></header><nav className="mobile-nav" aria-label="Mobile navigation">{links.map(([href, icon, label]) => <Link className={pathname === href ? "active" : ""} href={href} key={href}><Icon name={icon}/><span>{label}</span></Link>)}</nav><main className="app-main">{children}</main></div></div></AuthGuard>;
}
