import Link from "next/link";
import { LogOut, ShieldCheck } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { demoStudent } from "@/lib/mock-data";

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-navy-900">
      <header className="flex items-center justify-between border-b border-border px-6 py-4 sm:px-10">
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

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-full outline-none">
            <span className="hidden text-body-sm text-ivory-200 sm:inline">
              {demoStudent.name} 様
            </span>
            <Avatar className="size-9 border border-white/[0.06] transition-colors duration-300 hover:border-gold-500/30">
              <AvatarFallback className="bg-navy-600 text-body-sm text-gold-400">
                {demoStudent.initials}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem render={<Link href="/login" />}>
              <LogOut className="size-4" strokeWidth={1.75} />
              ログアウト
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10 sm:px-10">{children}</main>
    </div>
  );
}
