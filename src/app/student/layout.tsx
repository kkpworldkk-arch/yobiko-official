import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { StudentNav } from "@/components/student-nav";
import { StudentUserMenu } from "@/components/student-user-menu";
import { getSession } from "@/lib/session";
import { resolveStudentIdentity } from "@/lib/student-identity";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  const identity = resolveStudentIdentity(session);

  return (
    <div className="min-h-screen bg-navy-900">
      <header className="flex flex-col gap-4 border-b border-border px-6 py-4 sm:px-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
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

          <StudentUserMenu name={identity.name} initials={identity.initials} />
        </div>

        <StudentNav />
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10 sm:px-10">{children}</main>
    </div>
  );
}
