import Link from "next/link";
import { Logo } from "./ui";

export function PublicHeader() {
  return <header className="public-header"><div className="public-nav"><Logo/><nav aria-label="Main navigation"><Link href="/catalog">Browse</Link><Link href="/about">About</Link></nav><div className="nav-actions"><Link href="/login" className="text-link">Log in</Link><Link href="/register" className="button button-dark">Join the library</Link></div></div></header>;
}

export function PublicFooter() {
  return <footer className="public-footer"><div><Logo inverse/><p>A quieter way to discover, borrow, and keep track of the books that matter.</p></div><div><strong>Explore</strong><Link href="/catalog">Browse books</Link><Link href="/about">About Mandstacks</Link></div><div><strong>Account</strong><Link href="/login">Log in</Link><Link href="/register">Create account</Link></div><small>© 2026 Mandstacks</small></footer>;
}
