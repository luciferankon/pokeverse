"use client";

import { useEffect, useState } from "react";
import { statColors, statShortNames } from "@/lib/typeColors";

interface StatBarProps {
  statName: string;
  value: number;
  max?: number;
}

export default function StatBar({ statName, value, max = 255 }: StatBarProps) {
  const [width, setWidth] = useState(0);
  const color = statColors[statName] || "#9CA3AF";
  const short = statShortNames[statName] || statName.slice(0, 3).toUpperCase();
  const pct = Math.min((value / max) * 100, 100);

  useEffect(() => {
    const t = setTimeout(() => setWidth(pct), 150);
    return () => clearTimeout(t);
  }, [pct]);

  const valueColor =
    value >= 120
      ? "text-green-400"
      : value >= 90
      ? "text-yellow-400"
      : value >= 60
      ? "text-orange-400"
      : "text-red-400";

  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] font-mono text-white/40 w-8 text-right shrink-0">
        {short}
      </span>
      <span className={`text-sm font-bold w-8 text-right shrink-0 ${valueColor}`}>
        {value}
      </span>
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${width}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}