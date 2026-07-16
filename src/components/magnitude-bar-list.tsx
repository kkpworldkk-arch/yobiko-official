import { cn } from "@/lib/utils";

interface BarListItem {
  label: string;
  value: number;
}

interface MagnitudeBarListProps {
  items: BarListItem[];
  /**
   * "uniform"  — 単純な大小比較（教科別件数など）。全バー同一色相・彩度で、
   *              長さだけが値を語る。
   * "emphasis" — 1位のみアクセント色、他は低彩度に沈める（優先復習ランキング等、
   *              「この1件が重要」という物語がある場合に使う）。
   */
  variant?: "uniform" | "emphasis";
  unit?: string;
}

export function MagnitudeBarList({
  items,
  variant = "uniform",
  unit = "件",
}: MagnitudeBarListProps) {
  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="flex flex-col gap-3.5">
      {items.map((item, index) => {
        const widthPct = Math.max((item.value / max) * 100, 6);
        const isTop = variant === "emphasis" && index === 0;

        return (
          <div key={item.label} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span
                className={cn(
                  "text-body-sm truncate",
                  isTop ? "font-medium text-ivory-100" : "text-ivory-200",
                )}
              >
                {item.label}
              </span>
              <span className="shrink-0 text-caption tabular-nums text-slate-400">
                {item.value}
                {unit}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={cn(
                  "h-full rounded-r-full transition-[width] duration-500 ease-luxury",
                  variant === "uniform" && "bg-gold-500/70",
                  variant === "emphasis" &&
                    (isTop ? "bg-gold-400" : "bg-slate-500/45"),
                )}
                style={{ width: `${widthPct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
