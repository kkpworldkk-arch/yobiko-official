import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatTileProps {
  label: string;
  value: string;
  icon: LucideIcon;
  delta?: {
    value: string;
    direction: "up" | "down";
    isPositive: boolean;
  };
  emphasis?: boolean;
}

export function StatTile({
  label,
  value,
  icon: Icon,
  delta,
  emphasis,
}: StatTileProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-panel transition-colors duration-300 ease-luxury",
        emphasis && "border-gold-500/25",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-eyebrow uppercase tracking-[0.16em] text-slate-400">
          {label}
        </span>
        <Icon
          className={cn(
            "size-4",
            emphasis ? "text-gold-400" : "text-slate-400",
          )}
          strokeWidth={1.75}
        />
      </div>
      <div className="flex items-end justify-between">
        <span
          className={cn(
            "text-h1 font-semibold tabular-nums",
            emphasis ? "text-gold-300" : "text-ivory-100",
          )}
        >
          {value}
        </span>
        {delta && (
          <span
            className={cn(
              "mb-1 flex items-center gap-0.5 text-caption font-medium tabular-nums",
              delta.isPositive ? "text-sage-500" : "text-rust-500",
            )}
          >
            {delta.direction === "up" ? (
              <ArrowUpRight className="size-3.5" strokeWidth={2.25} />
            ) : (
              <ArrowDownRight className="size-3.5" strokeWidth={2.25} />
            )}
            {delta.value}
          </span>
        )}
      </div>
    </div>
  );
}
