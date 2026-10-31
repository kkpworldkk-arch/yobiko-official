"use client";

import { useSyncExternalStore } from "react";
import Form from "next/form";
import Link from "next/link";
import { Bell, LogOut, MessageSquareText, Search, Settings, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout } from "@/app/actions/auth";
import { formatRelativeTimeJa } from "@/lib/format";

export interface DashboardNotifications {
  pendingStudents: { id: string; name: string; count: number }[];
  unresolvedFeedback: { id: string; studentName: string; message: string; createdAt: string }[];
}

// サーバー（Render）は日本時間ではないため、日付は常に日本時間で数える
const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "short",
});

function formatToday() {
  return dateFormatter.format(new Date());
}

// iPad でアプリを開いたまま日をまたいでも表示が切り替わるよう、1分ごとに日付を確かめる
function subscribeToClock(onChange: () => void) {
  const timer = setInterval(onChange, 60_000);
  return () => clearInterval(timer);
}

export function DashboardTopbar({
  notifications,
  teacherName,
  mobileNav,
}: {
  notifications: DashboardNotifications;
  teacherName: string;
  mobileNav: React.ReactNode;
}) {
  const formattedDate = useSyncExternalStore(subscribeToClock, formatToday, formatToday);
  const { pendingStudents, unresolvedFeedback } = notifications;
  const hasNotifications = pendingStudents.length > 0 || unresolvedFeedback.length > 0;

  return (
    <header className="no-print flex items-center justify-between gap-3 border-b border-border px-4 py-4 sm:gap-6 sm:px-8 sm:py-5">
      <div className="flex items-center gap-3">
        {mobileNav}
        <div>
          <h1 className="text-h2 text-ivory-100 sm:text-h1">
            おかえりなさい、{teacherName}先生
          </h1>
          <p className="mt-1 text-caption text-slate-400">{formattedDate}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Form action="/dashboard/search" className="relative hidden sm:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            name="q"
            placeholder="生徒・教科・単元を検索"
            className="h-10 w-64 rounded-lg border border-border bg-navy-800/60 pl-9 pr-3 text-body-sm text-ivory-100 placeholder:text-slate-500 outline-none transition-colors duration-300 focus:border-gold-500/40"
          />
        </Form>

        {/* iPhone幅では検索欄を出す場所がないので、検索ページへのボタンにする */}
        <Link
          href="/dashboard/search"
          aria-label="検索"
          className="flex size-10 items-center justify-center rounded-lg border border-border text-slate-400 transition-colors duration-300 hover:border-gold-500/30 hover:text-ivory-200 sm:hidden"
        >
          <Search className="size-4" strokeWidth={1.75} />
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="通知"
            className="relative flex size-10 items-center justify-center rounded-lg border border-border text-slate-400 outline-none transition-colors duration-300 hover:border-gold-500/30 hover:text-ivory-200"
          >
            <Bell className="size-4" strokeWidth={1.75} />
            {hasNotifications && (
              <span className="absolute right-2 top-2 size-1.5 rounded-full bg-crimson-500" />
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-[70vh] w-80 max-w-[calc(100vw-2rem)]">
            {!hasNotifications && (
              <p className="px-2 py-6 text-center text-body-sm text-slate-500">
                新しいお知らせはありません
              </p>
            )}
            {pendingStudents.length > 0 && (
              <DropdownMenuGroup>
                <DropdownMenuLabel>講師確認待ち</DropdownMenuLabel>
                {pendingStudents.map((student) => (
                  <DropdownMenuItem
                    key={student.id}
                    render={<Link href={`/dashboard/students/${encodeURIComponent(student.id)}`} />}
                  >
                    <Sparkles className="size-4 text-crimson-500" strokeWidth={1.75} />
                    <span className="flex-1 truncate">{student.name}</span>
                    <span className="tabular-nums text-slate-400">{student.count}件</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            )}
            {pendingStudents.length > 0 && unresolvedFeedback.length > 0 && <DropdownMenuSeparator />}
            {unresolvedFeedback.length > 0 && (
              <DropdownMenuGroup>
                <DropdownMenuLabel>生徒からの要望（未対応）</DropdownMenuLabel>
                {unresolvedFeedback.slice(0, 5).map((item) => (
                  <DropdownMenuItem
                    key={item.id}
                    render={<Link href="/dashboard/settings#feedback" />}
                    className="items-start"
                  >
                    <MessageSquareText className="mt-0.5 size-4 text-slate-400" strokeWidth={1.75} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{item.message}</span>
                      <span className="block text-caption text-slate-500">
                        {item.studentName}・{formatRelativeTimeJa(item.createdAt)}
                      </span>
                    </span>
                  </DropdownMenuItem>
                ))}
                {unresolvedFeedback.length > 5 && (
                  <DropdownMenuItem render={<Link href="/dashboard/settings#feedback" />}>
                    <span className="w-full text-center text-gold-400">
                      ほか{unresolvedFeedback.length - 5}件を見る
                    </span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuGroup>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-full outline-none">
            <Avatar className="size-10 border border-white/[0.06] transition-colors duration-300 hover:border-gold-500/30">
              <AvatarFallback className="bg-navy-600 text-body-sm text-gold-400">
                {teacherName.slice(0, 1)}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem render={<Link href="/dashboard/settings" />}>
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
