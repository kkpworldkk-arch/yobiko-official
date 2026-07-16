import Link from "next/link";
import {
  BarChart3,
  History,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { totalPendingChecks, teacher } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { DashboardTopbar } from "@/components/dashboard-topbar";

const NAV_ITEMS = [
  { label: "ダッシュボード", icon: LayoutDashboard, href: "/dashboard", active: true },
  { label: "生徒一覧", icon: Users, href: "#", active: false },
  { label: "質問履歴", icon: History, href: "#", active: false },
  { label: "弱点分析", icon: BarChart3, href: "#", active: false },
  { label: "設定", icon: Settings, href: "#", active: false },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full bg-navy-900">
      <aside className="flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-4 py-6">
        <div className="mb-8 flex items-center gap-2.5 px-2">
          <div className="flex size-9 items-center justify-center rounded-full border border-gold-500/30 bg-gold-500/[0.08]">
            <ShieldCheck className="size-4 text-gold-400" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-h3 leading-none text-ivory-100">滝原塾</p>
            <p className="mt-1 text-eyebrow uppercase tracking-[0.16em] text-slate-500">
              Concierge
            </p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-body-sm transition-colors duration-300 ease-luxury",
                item.active
                  ? "bg-sidebar-accent text-gold-400"
                  : "text-slate-400 hover:bg-sidebar-accent/60 hover:text-ivory-200",
              )}
            >
              <item.icon className="size-4" strokeWidth={1.75} />
              {item.label}
            </Link>
          ))}
        </nav>

        {totalPendingChecks > 0 && (
          <div className="mb-4 rounded-lg border border-crimson-500/20 bg-crimson-500/[0.06] px-3.5 py-3">
            <p className="text-eyebrow uppercase tracking-[0.16em] text-crimson-500">
              講師確認待ち
            </p>
            <p className="mt-1 text-h2 font-semibold tabular-nums text-ivory-100">
              {totalPendingChecks}
              <span className="ml-1 text-body-sm font-normal text-slate-400">
                件
              </span>
            </p>
          </div>
        )}

        <div className="flex items-center gap-3 border-t border-sidebar-border pt-4">
          <Avatar className="size-9 border border-white/[0.06]">
            <AvatarFallback className="bg-navy-600 text-body-sm text-gold-400">
              松
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-body-sm font-medium text-ivory-100">
              {teacher.name}
            </p>
            <p className="truncate text-caption text-slate-500">
              {teacher.role}
            </p>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardTopbar />
        <main className="flex-1 px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
