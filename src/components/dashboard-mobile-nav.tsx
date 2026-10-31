"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

// iPhone幅（sm未満）ではサイドバーを常時表示すると本文が細い列に押し込まれるため、
// メニューボタンから左にスライドして開く。中身はサイドバーと同じものを受け取る。
export function DashboardMobileNav({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="メニューを開く"
        className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border text-slate-400 transition-colors duration-300 hover:border-gold-500/30 hover:text-ivory-200 sm:hidden"
      >
        <Menu className="size-4" strokeWidth={1.75} />
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-64 gap-0 border-sidebar-border bg-sidebar px-4 py-6"
        // リンクを押したらページ遷移と同時にメニューを閉じる
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("a")) setOpen(false);
        }}
      >
        <SheetTitle className="sr-only">メニュー</SheetTitle>
        {children}
      </SheetContent>
    </Sheet>
  );
}
