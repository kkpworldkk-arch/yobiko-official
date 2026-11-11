import { Skeleton } from "@/components/ui/skeleton";

// 講師画面のページはどれも毎回サーバーでDBを読むため、遷移に時間がかかると
// 「リンクを押しても何も起きない」ように見える。ここで即座に枠を出して、押したことが伝わるようにする。
export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="読み込み中">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
