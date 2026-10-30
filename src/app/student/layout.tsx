import { redirect } from "next/navigation";
import { AiConsentGate } from "@/components/ai-consent-gate";
import { NativeAppBridge } from "@/components/native-app-bridge";
import { StudentNav } from "@/components/student-nav";
import { StudentUserMenu } from "@/components/student-user-menu";
import { hasUserAiConsent } from "@/lib/db";
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
      <NativeAppBridge />
      <header className="flex flex-col gap-4 border-b border-border px-6 py-4 sm:px-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-vertical.png" alt="" width={36} height={36} className="size-9 rounded-[22%]" />
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

      <main className="mx-auto max-w-3xl px-6 py-10 sm:px-10">
        <AiConsentGate consented={hasUserAiConsent(session.userId)}>{children}</AiConsentGate>
      </main>
    </div>
  );
}
