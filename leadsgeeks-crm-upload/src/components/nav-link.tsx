"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const path = usePathname();
  const active = href === "/accounts" ? path === "/accounts" || /^\/accounts\/(?!new)/.test(path) : path === href || path.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 px-3 h-9 rounded-[var(--radius)] transition-colors ${active ? "bg-white/10 text-white border-l-2 border-accent" : "text-white/70 hover:bg-white/5 hover:text-white"}`}
    >
      {children}
    </Link>
  );
}
