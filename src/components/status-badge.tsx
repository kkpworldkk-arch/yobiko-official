import { CheckCircle2, TriangleAlert, CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudentHealth } from "@/lib/types";

/**
 * 生徒の状態色は sage(順調) / rust(要観察) / crimson(要対応) の3段階に固定。
 * 色だけで意味を伝えず、必ずアイコン + ラベルを併記する。
 */
const HEALTH_CONFIG: Record<
  StudentHealth,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  good: {
    label: "順調",
    icon: CheckCircle2,
    className: "border-sage-500/30 bg-sage-500/10 text-sage-500",
  },
  watch: {
    label: "要観察",
    icon: TriangleAlert,
    className: "border-rust-500/30 bg-rust-500/10 text-rust-500",
  },
  urgent: {
    label: "要対応",
    icon: CircleAlert,
    className: "border-crimson-500/30 bg-crimson-500/10 text-crimson-500",
  },
};

export function StatusBadge({
  health,
  className,
}: {
  health: StudentHealth;
  className?: string;
}) {
  const config = HEALTH_CONFIG[health];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1",
        config.className,
        className,
      )}
    >
      <Icon className="size-3.5" strokeWidth={2.25} />
      <span className="text-caption font-medium text-ivory-200">
        {config.label}
      </span>
    </span>
  );
}
