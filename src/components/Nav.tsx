"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconCoin, IconFlag, IconUsers } from "./ui";

const items = [
  { href: "/", label: "PLAY", Icon: IconFlag },
  { href: "/ledger", label: "BALANCES", Icon: IconCoin },
  { href: "/players", label: "PLAYERS", Icon: IconUsers },
];

export default function Nav() {
  const path = usePathname();
  const on = (h: string) => (h === "/" ? path === "/" || path.startsWith("/new") || path.startsWith("/round") : path.startsWith(h));
  return (
    <nav className="nav"><div className="in">
      {items.map(({ href, label, Icon }) => (
        <Link key={href} href={href} className={on(href) ? "on" : ""}><Icon />{label}</Link>
      ))}
    </div></nav>
  );
}
