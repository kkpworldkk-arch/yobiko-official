import { redirect } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getAllStudentFeedback } from "@/lib/db";
import { getLiveTotalPendingChecks, getPendingCheckStudents } from "@/lib/roster";
import { getSession } from "@/lib/session";
import { DashboardTopbar } from "@/components/dashboard-topbar";
import { DashboardSidebarNav } from "@/components/dashboard-sidebar-nav";
import { DashboardMobileNav } from "@/components/dashboard-mobile-nav";

// SQLiteから毎回最新の講師確認件数を読むため、静的レンダリングのキャッシュを無効化する
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const totalPendingChecks = getLiveTotalPendingChecks();
  const notifications = {
    pendingStudents: getPendingCheckStudents(),
    unresolvedFeedback: getAllStudentFeedback()
      .filter((item) => !item.resolved)
      .map(({ id, studentName, message, createdAt }) => ({ id, studentName, message, createdAt })),
  };

  // サイドバーの中身。iPad・PCでは左に常時表示し、iPhone幅ではメニューから開く
  const sidebarBody = (
    <>
      <div className="mb-8 flex items-center gap-2.5 px-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-vertical.png" alt="" width={36} height={36} className="size-9 rounded-[22%]" />
        <div>
          <p className="text-h3 leading-none text-ivory-100">滝原塾</p>
          <p className="mt-1 text-eyebrow uppercase tracking-[0.16em] text-slate-500">
            Concierge
          </p>
        </div>
      </div>

      <DashboardSidebarNav />

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
            {session.name.slice(0, 1)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-body-sm font-medium text-ivory-100">
            {session.name}
          </p>
          <p className="truncate text-caption text-slate-500">講師</p>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen w-full bg-navy-900">
      <aside className="no-print hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-4 py-6 sm:flex">
        {sidebarBody}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardTopbar
          notifications={notifications}
          teacherName={session.name}
          mobileNav={<DashboardMobileNav>{sidebarBody}</DashboardMobileNav>}
        />
        <main className="flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
