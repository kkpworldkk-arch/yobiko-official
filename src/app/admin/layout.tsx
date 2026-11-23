import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-navy-900">
      <header className="flex items-center justify-between border-b border-border px-6 py-4 sm:px-10">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-vertical.png" alt="" width={36} height={36} className="size-9 rounded-[22%]" />
          <div>
            <p className="text-h3 leading-none text-ivory-100">滝原塾</p>
            <p className="mt-1 text-eyebrow tracking-[0.04em] text-slate-500">管理者用</p>
          </div>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-body-sm text-ivory-200 transition-colors hover:bg-navy-600"
          >
            <LogOut className="size-4" strokeWidth={1.75} />
            ログアウト
          </button>
        </form>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10 sm:px-10">{children}</main>
    </div>
  );
}
