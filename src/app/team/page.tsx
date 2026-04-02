"use client";

import { useState, useEffect, useRef } from "react";
import { Pokemon } from "@/lib/types";
import { fetchPokemon, formatPokemonName, getPokemonImageUrl, getPokemonIdFromUrl } from "@/lib/api";
import TypeBadge from "@/components/TypeBadge";
import { typeColors, attackingChart } from "@/lib/typeColors";

const ALL_TYPES = [
  "normal","fire","water","electric","grass","ice","fighting","poison",
  "ground","flying","psychic","bug","rock","ghost","dragon","dark","steel","fairy",
];
const BASE = "https://pokeapi.co/api/v2";

function getAttackEff(attack: string, defense: string): number {
  return attackingChart[attack]?.[defense] ?? 1;
}

type Slot = Pokemon | null;

export default function TeamBuilderPage() {
  const [team, setTeam] = useState<Slot[]>(Array(6).fill(null));
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<{ name: string; id: number }[]>([]);
  const [loadingSlot, setLoadingSlot] = useState<number | null>(null);
  const [allNames, setAllNames] = useState<{ name: string; id: number }[]>([]);
  const [coverage, setCoverage] = useState<Record<string, number>>({});
  const [weaknessCounts, setWeaknessCounts] = useState<Record<string, number>>({});
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Load all names for search
  useEffect(() => {
    fetch(`${BASE}/pokemon?limit=1025`)
      .then((r) => r.json())
      .then((d) => {
        setAllNames(
          d.results.map((p: { name: string; url: string }) => ({
            name: p.name,
            id: getPokemonIdFromUrl(p.url),
          }))
        );
      });
  }, []);

  // Search filter
  useEffect(() => {
    if (!search || search.length < 2) {
      setResults([]);
      return;
    }
    const q = search.toLowerCase();
    const matches = allNames
      .filter(
        (p) => p.name.includes(q) || String(p.id).startsWith(q)
      )
      .slice(0, 8);
    setResults(matches);
  }, [search, allNames]);

  const addPokemon = async (id: number) => {
    if (activeSlot === null) return;
    setLoadingSlot(activeSlot);
    try {
      const poke = await fetchPokemon(id);
      const newTeam = [...team];
      newTeam[activeSlot] = poke;
      setTeam(newTeam);
      await analyseTeam(newTeam);
    } finally {
      setLoadingSlot(null);
      setSearch("");
      setResults([]);
      setActiveSlot(null);
    }
  };

  const removeFromTeam = async (slot: number) => {
    const newTeam = [...team];
    newTeam[slot] = null;
    setTeam(newTeam);
    await analyseTeam(newTeam);
    if (activeSlot === slot) setActiveSlot(null);
  };

  const analyseTeam = async (currentTeam: Slot[]) => {
    const active = currentTeam.filter(Boolean) as Pokemon[];
    if (active.length === 0) {
      setCoverage({});
      setWeaknessCounts({});
      return;
    }
    setLoadingAnalysis(true);
    try {
      // Offensive coverage: can any team member hit each type super-effectively?
      const covData: Record<string, number> = {};
      ALL_TYPES.forEach((defType) => {
        let best = 0;
        active.forEach((p) => {
          p.types.forEach(({ type }) => {
            const eff = getAttackEff(type.name, defType);
            if (eff > best) best = eff;
          });
        });
        covData[defType] = best;
      });
      setCoverage(covData);

      // Defensive weaknesses: for each attacking type, how many team members are weak?
      const weakData: Record<string, number> = {};
      await Promise.all(
        active.map(async (p) => {
          const typeData = await Promise.all(
            p.types.map(({ type }) =>
              fetch(`${BASE}/type/${type.name}`).then((r) => r.json())
            )
          );
          const eff: Record<string, number> = {};
          ALL_TYPES.forEach((t) => (eff[t] = 1));
          typeData.forEach((td) => {
            td.damage_relations.double_damage_from.forEach(
              (t: { name: string }) => (eff[t.name] *= 2)
            );
            td.damage_relations.half_damage_from.forEach(
              (t: { name: string }) => (eff[t.name] *= 0.5)
            );
            td.damage_relations.no_damage_from.forEach(
              (t: { name: string }) => (eff[t.name] *= 0)
            );
          });
          ALL_TYPES.forEach((t) => {
            if (eff[t] >= 2) {
              weakData[t] = (weakData[t] || 0) + 1;
            }
          });
        })
      );
      setWeaknessCounts(weakData);
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const teamSize = team.filter(Boolean).length;
  const coveredTypes = ALL_TYPES.filter((t) => (coverage[t] || 0) >= 2);
  const uncoveredTypes = ALL_TYPES.filter((t) => (coverage[t] || 0) < 2);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-1">⚔️ Team Builder</h1>
        <p className="text-white/30 text-sm">
          Build your team of 6 and analyse type coverage
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: Team slots */}
        <div className="xl:col-span-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
            {team.map((slot, i) => (
              <div
                key={i}
                className={`relative rounded-2xl border transition-all cursor-pointer overflow-hidden ${
                  activeSlot === i
                    ? "border-[#dc2626]/50 bg-[#dc2626]/5"
                    : slot
                    ? "border-white/10 bg-[#111120] hover:border-white/20"
                    : "border-dashed border-white/10 bg-[#111120]/50 hover:border-white/20"
                }`}
                onClick={() => {
                  if (!slot) {
                    setActiveSlot(i);
                    setTimeout(() => searchRef.current?.focus(), 50);
                  }
                }}
                style={
                  slot
                    ? {
                        boxShadow:
                          activeSlot === i
                            ? `0 0 20px ${typeColors[slot.types[0]?.type.name] || "#fff"}25`
                            : undefined,
                      }
                    : undefined
                }
              >
                {slot ? (
                  <div className="relative p-4">
                    {/* Type gradient */}
                    <div
                      className="absolute inset-0 pointer-events-none opacity-[0.07]"
                      style={{
                        background: `radial-gradient(circle at 70% 20%, ${
                          typeColors[slot.types[0]?.type.name] || "#fff"
                        }, transparent 70%)`,
                      }}
                    />
                    {/* Remove button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromTeam(i);
                      }}
                      className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white/5 hover:bg-white/15 text-white/30 hover:text-white transition-all text-xs flex items-center justify-center z-10"
                    >
                      ✕
                    </button>

                    <div className="flex justify-center mb-2 relative z-10">
                      <div className="w-16 h-16">
                        <img
                          src={getPokemonImageUrl(slot.id)}
                          alt={slot.name}
                          className="w-full h-full object-contain drop-shadow-lg"
                        />
                      </div>
                    </div>
                    <p className="text-center text-xs font-semibold text-white mb-1.5 relative z-10">
                      {formatPokemonName(slot.name)}
                    </p>
                    <div className="flex justify-center gap-1 flex-wrap relative z-10">
                      {slot.types.map(({ type }) => (
                        <TypeBadge key={type.name} type={type.name} size="sm" />
                      ))}
                    </div>

                    {/* Edit overlay */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveSlot(i);
                        setTimeout(() => searchRef.current?.focus(), 50);
                      }}
                      className="absolute inset-0 w-full h-full bg-black/0 hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 hover:opacity-100 rounded-2xl text-xs text-white font-medium"
                    >
                      Change
                    </button>
                  </div>
                ) : loadingSlot === i ? (
                  <div className="p-4 flex flex-col items-center justify-center h-32">
                    <svg
                      className="animate-spin w-5 h-5 text-white/30"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                  </div>
                ) : (
                  <div className="p-4 flex flex-col items-center justify-center h-32 text-white/20">
                    <div className="text-3xl mb-2 opacity-30">+</div>
                    <p className="text-xs">Slot {i + 1}</p>
                    {activeSlot === i && (
                      <p className="text-[10px] text-[#dc2626]/70 mt-1">
                        Search below ↓
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Search */}
          {activeSlot !== null && (
            <div className="relative">
              <input
                ref={searchRef}
                type="text"
                placeholder={`Search Pokémon for Slot ${activeSlot + 1}…`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-4 py-3.5 bg-[#111120] border border-[#dc2626]/30 rounded-xl text-white placeholder:text-white/20 focus:outline-none focus:border-[#dc2626]/50 text-sm"
              />
              {results.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#111120] border border-white/10 rounded-xl overflow-hidden z-30 shadow-2xl">
                  {results.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => addPokemon(p.id)}
                      className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-white/5 transition-colors text-left"
                    >
                      <img
                        src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png`}
                        alt={p.name}
                        className="w-8 h-8 object-contain"
                      />
                      <span className="text-sm text-white capitalize">
                        {formatPokemonName(p.name)}
                      </span>
                      <span className="ml-auto text-xs text-white/25 font-mono">
                        #{String(p.id).padStart(4, "0")}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {activeSlot === null && teamSize < 6 && (
            <p className="text-xs text-white/25 text-center">
              Click an empty slot to add a Pokémon
            </p>
          )}
        </div>

        {/* Right: Analysis */}
        <div className="space-y-4">
          {/* Summary */}
          <div className="rounded-2xl border border-white/5 bg-[#111120] p-5">
            <h3 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-3">
              Team
            </h3>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-black text-white">{teamSize}</span>
              <span className="text-white/30 mb-1">/ 6 Pokémon</span>
            </div>
            <div className="w-full h-1.5 bg-white/5 rounded-full mt-3 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#22C55E] transition-all duration-500"
                style={{ width: `${(teamSize / 6) * 100}%` }}
              />
            </div>
          </div>

          {/* Offensive Coverage */}
          {teamSize > 0 && (
            <div className="rounded-2xl border border-white/5 bg-[#111120] p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white/40 uppercase tracking-wider">
                  Offensive Coverage
                </h3>
                {loadingAnalysis && (
                  <svg
                    className="animate-spin w-4 h-4 text-white/30"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                )}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {ALL_TYPES.map((type) => {
                  const eff = coverage[type] || 0;
                  const covered = eff >= 2;
                  const c = typeColors[type];
                  return (
                    <div
                      key={type}
                      className="relative flex items-center justify-between px-2 py-1.5 rounded-lg text-[10px] font-semibold uppercase"
                      style={{
                        backgroundColor: covered ? `${c}18` : "rgba(255,255,255,0.02)",
                        border: `1px solid ${covered ? c + "35" : "rgba(255,255,255,0.05)"}`,
                        color: covered ? c : "rgba(255,255,255,0.2)",
                      }}
                    >
                      <span>{type}</span>
                      {covered && (
                        <span style={{ color: c }}>
                          {eff >= 4 ? "4×" : "2×"}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-white/25 mt-3">
                {coveredTypes.length}/{ALL_TYPES.length} types covered super-effectively
              </p>
            </div>
          )}

          {/* Team Weaknesses */}
          {teamSize > 0 && Object.keys(weaknessCounts).length > 0 && (
            <div className="rounded-2xl border border-white/5 bg-[#111120] p-5">
              <h3 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-4">
                Team Weaknesses
              </h3>
              <div className="space-y-1.5">
                {ALL_TYPES.filter((t) => weaknessCounts[t] > 0)
                  .sort((a, b) => weaknessCounts[b] - weaknessCounts[a])
                  .map((type) => {
                    const count = weaknessCounts[type];
                    const c = typeColors[type];
                    const pct = (count / teamSize) * 100;
                    return (
                      <div key={type} className="flex items-center gap-2">
                        <TypeBadge type={type} size="sm" />
                        <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: c,
                            }}
                          />
                        </div>
                        <span
                          className="text-xs font-bold w-4 text-right"
                          style={{ color: c }}
                        >
                          {count}
                        </span>
                      </div>
                    );
                  })}
              </div>
              <p className="text-[11px] text-white/25 mt-3">
                Number shows how many team members are weak to that type
              </p>
            </div>
          )}

          {teamSize === 0 && (
            <div className="rounded-2xl border border-dashed border-white/5 p-8 text-center">
              <p className="text-white/20 text-sm">
                Add Pokémon to see analysis
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}