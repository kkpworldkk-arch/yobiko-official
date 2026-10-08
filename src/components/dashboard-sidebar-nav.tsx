"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  History,
  LayoutDashboard,
  Mic,
  Settings,
  Stethoscope,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "ダッシュボード", icon: LayoutDashboard, href: "/dashboard" },
  { label: "生徒一覧", icon: Users, href: "/dashboard/students" },
  { label: "口頭試問", icon: Mic, href: "/dashboard/oral-exam" },
  { label: "無料弱点診断", icon: Stethoscope, href: "/dashboard/prospects" },
  { label: "質問履歴", icon: History, href: "/dashboard/history" },
  { label: "弱点分析", icon: BarChart3, href: "/dashboard/analysis" },
  { label: "設定", icon: Settings, href: "/dashboard/settings" },
];

export function DashboardSidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-body-sm transition-colors duration-300 ease-luxury",
              active
                ? "bg-sidebar-accent text-gold-400"
                : "text-slate-400 hover:bg-sidebar-accent/60 hover:text-ivory-200",
            )}
          >
            <item.icon className="size-4" strokeWidth={1.75} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
