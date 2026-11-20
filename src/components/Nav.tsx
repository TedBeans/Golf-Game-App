"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Home" },
  { href: "/new", label: "New round" },
  { href: "/ledger", label: "Balances" },
  { href: "/players", label: "Players" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="nav">
      {items.map((i) => (
        <Link key={i.href} href={i.href} className={(i.href === "/" ? path === "/" : path.startsWith(i.href)) ? "on" : ""}>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
