"use client";

import { useState } from "react";
import TypeBadge from "@/components/TypeBadge";
import { MoveDetail } from "@/lib/types";

type LearnMethod = "level-up" | "machine" | "egg" | "tutor";

const METHOD_LABELS: Record<LearnMethod, string> = {
  "level-up": "Level Up",
  "machine": "TM / HM",
  "egg": "Egg Moves",
  "tutor": "Move Tutor",
};

const DAMAGE_CLASS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  physical: { bg: "bg-orange-500/15", text: "text-orange-300", label: "Phys" },
  special:  { bg: "bg-blue-500/15",   text: "text-blue-300",   label: "Spec" },
  status:   { bg: "bg-gray-500/15",   text: "text-gray-400",   label: "Stat" },
};

const VERSION_PRIORITY: Record<string, number> = {
  "scarlet-violet": 50,
  "the-indigo-disk": 49,
  "the-teal-mask": 48,
  "isle-of-armor": 45,
  "the-crown-tundra": 44,
  "sword-shield": 43,
  "brilliant-diamond-and-shining-pearl": 42,
  "legends-arceus": 41,
  "ultra-sun-ultra-moon": 38,
  "sun-moon": 37,
  "omega-ruby-alpha-sapphire": 34,
  "x-y": 33,
  "black-2-white-2": 30,
  "black-white": 29,
  "heartgold-soulsilver": 26,
  "platinum": 25,
  "diamond-pearl": 24,
  "firered-leafgreen": 21,
  "emerald": 20,
  "ruby-sapphire": 19,
  "crystal": 14,
  "gold-silver": 13,
  "yellow": 10,
  "red-blue": 9,
};

interface MoveEntry {
  name: string;
  url: string;
  level: number;
}

interface Props {
  moves: {
    move: { name: string; url: string };
    version_group_details: {
      level_learned_at: number;
      move_learn_method: { name: string };
      version_group: { name: string };
    }[];
  }[];
}

export default function PokemonMoves({ moves }: Props) {
  const [activeTab, setActiveTab] = useState<LearnMethod>("level-up");
  const [expandedMove, setExpandedMove] = useState<string | null>(null);
  const [moveDetails, setMoveDetails] = useState<Record<string, MoveDetail>>({});
  const [loadingMove, setLoadingMove] = useState<string | null>(null);

  // Build move lists per method — a move can appear in multiple tabs
  const movesByMethod: Record<LearnMethod, MoveEntry[]> = {
    "level-up": [],
    "machine": [],
    "egg": [],
    "tutor": [],
  };

  moves.forEach((m) => {
    // Collect best entry per method for this move
    const bestPerMethod: Record<string, { level: number; versionPriority: number }> = {};
    m.version_group_details.forEach((vgd) => {
      const method = vgd.move_learn_method.name as LearnMethod;
      if (!(method in movesByMethod)) return;
      const prio = VERSION_PRIORITY[vgd.version_group.name] ?? 0;
      if (!bestPerMethod[method] || prio > bestPerMethod[method].versionPriority) {
        bestPerMethod[method] = { level: vgd.level_learned_at, versionPriority: prio };
      }
    });
    Object.entries(bestPerMethod).forEach(([method, best]) => {
      const list = movesByMethod[method as LearnMethod];
      if (!list.find((e) => e.name === m.move.name)) {
        list.push({ name: m.move.name, url: m.move.url, level: best.level });
      }
    });
  });

  movesByMethod["level-up"].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  (["machine", "egg", "tutor"] as LearnMethod[]).forEach((m) => {
    movesByMethod[m].sort((a, b) => a.name.localeCompare(b.name));
  });

  const tabs = (["level-up", "machine", "egg", "tutor"] as LearnMethod[]).filter(
    (m) => movesByMethod[m].length > 0
  );

  const loadMoveDetail = async (name: string, url: string) => {
    if (expandedMove === name) {
      setExpandedMove(null);
      return;
    }
    setExpandedMove(name);
    if (moveDetails[name]) return;
    setLoadingMove(name);
    try {
      const res = await fetch(url);
      const data: MoveDetail = await res.json();
      setMoveDetails((prev) => ({ ...prev, [name]: data }));
    } catch {
      // ignore
    } finally {
      setLoadingMove(null);
    }
  };

  const currentMoves = movesByMethod[activeTab];

  return (
    <div className="rounded-2xl border border-white/5 bg-[#111120] overflow-hidden">
      {/* Section heading */}
      <div className="px-5 pt-5 pb-3">
        <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider">
          Learnable Moves
        </h3>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-white/5 overflow-x-auto px-1">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              setExpandedMove(null);
            }}
            className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-all border-b-2 ${
              activeTab === tab
                ? "text-white border-[#dc2626]"
                : "text-white/40 border-transparent hover:text-white/60"
            }`}
          >
            {METHOD_LABELS[tab]}
            <span className="ml-1.5 opacity-50">({movesByMethod[tab].length})</span>
          </button>
        ))}
      </div>

      {/* Header row */}
      <div className="flex items-center gap-2 px-4 py-1.5 border-b border-white/3">
        {activeTab === "level-up" && (
          <span className="text-[10px] text-white/25 uppercase tracking-wider w-8 text-right shrink-0">Lv</span>
        )}
        <span className="flex-1 text-[10px] text-white/25 uppercase tracking-wider">Move</span>
        <span className="text-[10px] text-white/25 uppercase tracking-wider w-12 text-center">Type</span>
        <span className="text-[10px] text-white/25 uppercase tracking-wider w-10 text-center">Cat</span>
        <span className="text-[10px] text-white/25 uppercase tracking-wider w-16 text-right shrink-0">Pwr/Acc</span>
      </div>

      {/* Move rows */}
      <div className="max-h-[420px] overflow-y-auto">
        {currentMoves.length === 0 ? (
          <p className="text-center text-white/30 text-sm py-8">No moves in this category</p>
        ) : (
          <div className="divide-y divide-white/[0.03]">
            {currentMoves.map((entry) => {
              const detail = moveDetails[entry.name];
              const isExpanded = expandedMove === entry.name;
              const isLoading = loadingMove === entry.name;
              const isSignature = detail && detail.learned_by_pokemon.length <= 3;
              const dc = detail
                ? DAMAGE_CLASS_STYLE[detail.damage_class.name] ?? null
                : null;

              return (
                <div key={entry.name}>
                  <button
                    className="w-full flex items-center gap-2 px-4 py-2 hover:bg-white/[0.03] transition-colors text-left"
                    onClick={() => loadMoveDetail(entry.name, entry.url)}
                  >
                    {activeTab === "level-up" && (
                      <span className="text-[11px] font-mono text-white/30 w-8 text-right shrink-0">
                        {entry.level === 0 ? "—" : entry.level}
                      </span>
                    )}
                    <span className="flex-1 text-sm font-medium text-white/75 capitalize">
                      {entry.name.replace(/-/g, " ")}
                    </span>
                    {isSignature && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20 font-bold uppercase shrink-0">
                        Sig
                      </span>
                    )}
                    <span className="w-12 flex justify-center shrink-0">
                      {detail && <TypeBadge type={detail.type.name} size="sm" />}
                    </span>
                    <span className="w-10 flex justify-center shrink-0">
                      {dc && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${dc.bg} ${dc.text}`}>
                          {dc.label}
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-white/30 font-mono w-16 text-right shrink-0">
                      {detail ? `${detail.power ?? "—"}/${detail.accuracy ?? "—"}` : ""}
                    </span>
                    <span className="text-white/20 text-[10px] w-3">
                      {isExpanded ? "▲" : "▼"}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-3 pt-2 bg-white/[0.02] border-t border-white/[0.04]">
                      {isLoading ? (
                        <div className="space-y-2">
                          <div className="h-3 skeleton rounded w-2/3" />
                          <div className="h-3 skeleton rounded w-full" />
                        </div>
                      ) : detail ? (
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-x-4 gap-y-1">
                            <span className="text-[11px] text-white/40">
                              PP: <strong className="text-white/65">{detail.pp ?? "—"}</strong>
                            </span>
                            <span className="text-[11px] text-white/40">
                              Power: <strong className="text-white/65">{detail.power ?? "—"}</strong>
                            </span>
                            <span className="text-[11px] text-white/40">
                              Accuracy: <strong className="text-white/65">{detail.accuracy ?? "—"}%</strong>
                            </span>
                            <span className="text-[11px] text-white/40">
                              Priority:{" "}
                              <strong className="text-white/65">
                                {detail.priority > 0 ? `+${detail.priority}` : detail.priority}
                              </strong>
                            </span>
                            {detail.effect_chance && (
                              <span className="text-[11px] text-white/40">
                                Effect:{" "}
                                <strong className="text-white/65">{detail.effect_chance}%</strong>
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-white/55 leading-relaxed">
                            {detail.effect_entries
                              .find((e) => e.language.name === "en")
                              ?.short_effect.replace(
                                /\$effect_chance/g,
                                String(detail.effect_chance ?? "")
                              ) ||
                              detail.flavor_text_entries
                                .find((e) => e.language.name === "en")
                                ?.flavor_text ||
                              "No description available."}
                          </p>
                          {isSignature && (
                            <p className="text-[11px] text-amber-400/70">
                              ⭐ Signature move — only learnable by{" "}
                              {detail.learned_by_pokemon.length === 1
                                ? "this Pokémon"
                                : `${detail.learned_by_pokemon.length} Pokémon`}
                            </p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}