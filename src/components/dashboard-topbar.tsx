"use client";

import { Bell, LogOut, Search, Settings } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout } from "@/app/actions/auth";

const today = new Date();
const formattedDate = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "short",
}).format(today);

export function DashboardTopbar({
  totalPendingChecks,
  teacherName,
}: {
  totalPendingChecks: number;
  teacherName: string;
}) {
  return (
    <header className="no-print flex items-center justify-between gap-6 border-b border-border px-8 py-5">
      <div>
        <h1 className="text-h1 text-ivory-100">
          おかえりなさい、{teacherName}先生
        </h1>
        <p className="mt-1 text-caption text-slate-400">{formattedDate}</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative hidden sm:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            placeholder="生徒・教科・単元を検索"
            className="h-10 w-64 rounded-lg border border-border bg-navy-800/60 pl-9 pr-3 text-body-sm text-ivory-100 placeholder:text-slate-500 outline-none transition-colors duration-300 focus:border-gold-500/40"
          />
        </div>

        <button
          type="button"
          aria-label="通知"
          className="relative flex size-10 items-center justify-center rounded-lg border border-border text-slate-400 transition-colors duration-300 hover:border-gold-500/30 hover:text-ivory-200"
        >
          <Bell className="size-4" strokeWidth={1.75} />
          {totalPendingChecks > 0 && (
            <span className="absolute right-2 top-2 size-1.5 rounded-full bg-crimson-500" />
          )}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-full outline-none">
            <Avatar className="size-10 border border-white/[0.06] transition-colors duration-300 hover:border-gold-500/30">
              <AvatarFallback className="bg-navy-600 text-body-sm text-gold-400">
                {teacherName.slice(0, 1)}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem>
              <Settings className="size-4" strokeWidth={1.75} />
              設定
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { void logout(); }}>
              <LogOut className="size-4" strokeWidth={1.75} />
              ログアウト
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
