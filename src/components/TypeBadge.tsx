import { typeColors } from "@/lib/typeColors";
import clsx from "clsx";

interface TypeBadgeProps {
  type: string;
  size?: "sm" | "md" | "lg";
}

export default function TypeBadge({ type, size = "md" }: TypeBadgeProps) {
  const color = typeColors[type] || "#9CA3AF";
  return (
    <span
      className={clsx(
        "inline-flex items-center font-semibold rounded-full uppercase tracking-wider",
        {
          "text-[10px] px-2 py-0.5": size === "sm",
          "text-xs px-3 py-1": size === "md",
          "text-sm px-4 py-1.5": size === "lg",
        }
      )}
      style={{
        backgroundColor: `${color}20`,
        color: color,
        border: `1px solid ${color}45`,
      }}
    >
      {type}
    </span>
  );
}