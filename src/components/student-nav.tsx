"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mic, MessagesSquare, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "AIチューター", icon: MessagesSquare, href: "/student" },
  { label: "AI口頭試問", icon: Mic, href: "/student/oral-exam" },
  { label: "設定", icon: Settings, href: "/student/settings" },
];

export function StudentNav() {
  const pathname = usePathname();

  return (
    // スマホ幅でも項目名が途中で折り返さないよう、1行に並べて収まらなければ横にスクロールする
    <nav className="flex gap-1 overflow-x-auto sm:gap-1.5">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-body-sm transition-colors duration-300 ease-luxury sm:px-3",
              active
                ? "bg-navy-700/60 text-gold-400"
                : "text-slate-400 hover:bg-navy-700/40 hover:text-ivory-200",
            )}
          >
            <item.icon className="size-3.5" strokeWidth={1.75} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
