"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./icons";

export function NavLink({ href, icon, children, count }: { href: string; icon: string; children: React.ReactNode; count?: number }) {
  const path = usePathname();
  const active = href === "/accounts" ? path === "/accounts" || /^\/accounts\/(?!new)/.test(path) : path === href || path.startsWith(href + "/");
  return (
    <Link href={href} className={active ? "active" : ""}>
      <Icon n={icon} />
      <span>{children}</span>
      {count != null ? <span className="count">{count}</span> : null}
    </Link>
  );
}
