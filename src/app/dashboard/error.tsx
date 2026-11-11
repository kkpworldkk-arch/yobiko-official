"use client";

import { Button } from "@/components/ui/button";

// ページの読み込みで例外が出たときに、画面が固まったように見えず再試行できるようにする
export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <p className="text-body text-ivory-100">ページを読み込めませんでした。</p>
      <p className="text-body-sm text-slate-400">通信状態を確認して、もう一度お試しください。</p>
      <Button type="button" onClick={() => reset()}>
        再読み込み
      </Button>
    </div>
  );
}
