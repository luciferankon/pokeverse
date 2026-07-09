"use client";

import { useState, useEffect } from "react";
import {
  fetchPokemon,
  formatPokemonName,
  getPokemonImageUrl,
  getPokemonIdFromUrl,
} from "@/lib/api";
import { Pokemon } from "@/lib/types";
import TypeBadge from "@/components/TypeBadge";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const BASE = "https://pokeapi.co/api/v2";

const STAT_LABELS: Record<string, string> = {
  "hp": "HP",
  "attack": "ATK",
  "defense": "DEF",
  "special-attack": "Sp.Atk",
  "special-defense": "Sp.Def",
  "speed": "Speed",
};
const STAT_KEYS = ["hp", "attack", "defense", "special-attack", "special-defense", "speed"];

interface PickerItem { name: string; id: number }

interface PickerProps {
  label: string;
  color: string;
  pokemon: Pokemon | null;
  loading: boolean;
  search: string;
  setSearch: (s: string) => void;
  results: PickerItem[];
  onSelect: (id: number) => void;
  onClear: () => void;
}

export default function ComparePage() {
  const [allNames, setAllNames] = useState<PickerItem[]>([]);
  const [searchA, setSearchA] = useState("");
  const [searchB, setSearchB] = useState("");
  const [resultsA, setResultsA] = useState<PickerItem[]>([]);
  const [resultsB, setResultsB] = useState<PickerItem[]>([]);
  const [pokemonA, setPokemonA] = useState<Pokemon | null>(null);
  const [pokemonB, setPokemonB] = useState<Pokemon | null>(null);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);

  useEffect(() => {
    fetch(`${BASE}/pokemon?limit=1025`)
      .then(r => r.json())
      .then(d => {
        setAllNames(
          d.results.map((p: { name: string; url: string }) => ({
            name: p.name,
            id: getPokemonIdFromUrl(p.url),
          }))
        );
      });
  }, []);

  useEffect(() => {
    if (!searchA || searchA.length < 2) { setResultsA([]); return; }
    const lq = searchA.toLowerCase();
    setResultsA(allNames.filter(p => p.name.includes(lq) || String(p.id).startsWith(lq)).slice(0, 8));
  }, [searchA, allNames]);

  useEffect(() => {
    if (!searchB || searchB.length < 2) { setResultsB([]); return; }
    const lq = searchB.toLowerCase();
    setResultsB(allNames.filter(p => p.name.includes(lq) || String(p.id).startsWith(lq)).slice(0, 8));
  }, [searchB, allNames]);

  const selectA = async (id: number) => {
    setLoadingA(true); setSearchA(""); setResultsA([]);
    try { setPokemonA(await fetchPokemon(id)); } finally { setLoadingA(false); }
  };

  const selectB = async (id: number) => {
    setLoadingB(true); setSearchB(""); setResultsB([]);
    try { setPokemonB(await fetchPokemon(id)); } finally { setLoadingB(false); }
  };

  const radarData = STAT_KEYS.map(key => ({
    stat: STAT_LABELS[key] || key,
    a: pokemonA?.stats.find(s => s.stat.name === key)?.base_stat ?? 0,
    b: pokemonB?.stats.find(s => s.stat.name === key)?.base_stat ?? 0,
  }));

  const hasBoth = pokemonA && pokemonB;
  const hasAny = pokemonA || pokemonB;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-1">⚖️ Compare</h1>
        <p className="text-white/30 text-sm">Compare two Pokémon side by side</p>
      </div>

      {/* Pickers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
        <Picker
          label="Pokémon A"
          color="#3B82F6"
          pokemon={pokemonA}
          loading={loadingA}
          search={searchA}
          setSearch={setSearchA}
          results={resultsA}
          onSelect={selectA}
          onClear={() => setPokemonA(null)}
        />
        <Picker
          label="Pokémon B"
          color="#EC4899"
          pokemon={pokemonB}
          loading={loadingB}
          search={searchB}
          setSearch={setSearchB}
          results={resultsB}
          onSelect={selectB}
          onClear={() => setPokemonB(null)}
        />
      </div>

      {!hasAny && (
        <div className="text-center py-24 text-white/20">
          <div className="text-6xl mb-4">⚖️</div>
          <p className="text-lg font-medium text-white/30">Search for two Pokémon to compare</p>
          <p className="text-sm mt-2">Radar chart, stat bars, and type analysis</p>
        </div>
      )}

      {hasAny && (
        <>
          {/* Radar Chart */}
          {hasBoth && (
            <div className="rounded-2xl border border-white/5 bg-[#111120] p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-white/40 uppercase tracking-wider">Stat Radar</h2>
                <div className="flex gap-4">
                  <span className="flex items-center gap-2 text-xs text-[#3B82F6]">
                    <span className="w-3 h-0.5 rounded bg-[#3B82F6] inline-block" />
                    {formatPokemonName(pokemonA!.name)}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-[#EC4899]">
                    <span className="w-3 h-0.5 rounded bg-[#EC4899] inline-block" />
                    {formatPokemonName(pokemonB!.name)}
                  </span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                  <PolarGrid stroke="rgba(255,255,255,0.07)" />
                  <PolarAngleAxis dataKey="stat" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
                  <Radar
                    name={formatPokemonName(pokemonA!.name)}
                    dataKey="a"
                    stroke="#3B82F6"
                    fill="#3B82F6"
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                  <Radar
                    name={formatPokemonName(pokemonB!.name)}
                    dataKey="b"
                    stroke="#EC4899"
                    fill="#EC4899"
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#111120",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                      color: "white",
                      fontSize: 12,
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Stat bars */}
          <div className="rounded-2xl border border-white/5 bg-[#111120] p-6 mb-6">
            <h2 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-4">Base Stats</h2>
            <div className="space-y-3">
              {STAT_KEYS.map(key => {
                const a = pokemonA?.stats.find(s => s.stat.name === key)?.base_stat ?? null;
                const b = pokemonB?.stats.find(s => s.stat.name === key)?.base_stat ?? null;
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-[11px] text-white/30 uppercase tracking-wider w-14 shrink-0">
                      {STAT_LABELS[key]}
                    </span>
                    <div className="flex-1 space-y-1">
                      {a !== null && (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#3B82F6] transition-all duration-700"
                              style={{ width: `${(a / 255) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-[#3B82F6] w-8 text-right">{a}</span>
                        </div>
                      )}
                      {b !== null && (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#EC4899] transition-all duration-700"
                              style={{ width: `${(b / 255) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-[#EC4899] w-8 text-right">{b}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {/* Totals */}
              <div className="pt-3 border-t border-white/5 flex items-center gap-3">
                <span className="text-[11px] text-white/40 uppercase tracking-wider w-14 shrink-0 font-semibold">Total</span>
                <div className="flex-1 flex justify-end gap-4">
                  {pokemonA && (
                    <span className="text-sm font-black text-[#3B82F6]">
                      {pokemonA.stats.reduce((s, st) => s + st.base_stat, 0)}
                    </span>
                  )}
                  {pokemonB && (
                    <span className="text-sm font-black text-[#EC4899]">
                      {pokemonB.stats.reduce((s, st) => s + st.base_stat, 0)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Types + Vitals */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {([
              { poke: pokemonA, color: "#3B82F6" },
              { poke: pokemonB, color: "#EC4899" },
            ] as { poke: Pokemon | null; color: string }[]).map(({ poke, color }, idx) =>
              poke ? (
                <div key={idx} className="rounded-2xl border border-white/5 bg-[#111120] p-5">
                  <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color }}>
                    {formatPokemonName(poke.name)}
                  </h3>
                  <div className="flex gap-2 mb-4 flex-wrap">
                    {poke.types.map(({ type }) => (
                      <TypeBadge key={type.name} type={type.name} size="lg" />
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Height", value: `${(poke.height / 10).toFixed(1)} m` },
                      { label: "Weight", value: `${(poke.weight / 10).toFixed(1)} kg` },
                      { label: "Base XP", value: poke.base_experience?.toString() ?? "—" },
                      { label: "Dex #", value: String(poke.id).padStart(4, "0") },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-lg bg-white/[0.03] p-3">
                        <p className="text-[10px] text-white/30 mb-0.5">{label}</p>
                        <p className="text-sm font-bold text-white">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Picker({ label, color, pokemon, loading, search, setSearch, results, onSelect, onClear }: PickerProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color }}>{label}</span>
        {pokemon && (
          <button onClick={onClear} className="text-xs text-white/30 hover:text-white/60 transition-colors">
            Clear
          </button>
        )}
      </div>

      {pokemon ? (
        <div className="rounded-2xl border bg-[#111120] p-5 flex items-center gap-4" style={{ borderColor: `${color}30` }}>
          <img src={getPokemonImageUrl(pokemon.id)} alt={pokemon.name} className="w-20 h-20 object-contain drop-shadow-lg flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white/30 font-mono mb-0.5">#{String(pokemon.id).padStart(4, "0")}</p>
            <p className="text-lg font-bold text-white truncate">{formatPokemonName(pokemon.name)}</p>
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {pokemon.types.map(({ type }) => <TypeBadge key={type.name} type={type.name} size="sm" />)}
            </div>
          </div>
          <button onClick={onClear} className="text-white/20 hover:text-white/50 transition-colors text-lg self-start flex-shrink-0">✕</button>
        </div>
      ) : (
        <div className="relative">
          <input
            type="text"
            placeholder={`Search for ${label}…`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-4 py-3.5 bg-[#111120] border border-white/5 rounded-xl text-white placeholder:text-white/20 focus:outline-none text-sm"
          />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-[#111120]/80">
              <svg className="animate-spin w-5 h-5 text-white/30" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}
          {results.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#111120] border border-white/10 rounded-xl overflow-hidden z-30 shadow-2xl">
              {results.map(p => (
                <button key={p.id} onClick={() => onSelect(p.id)} className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-white/5 transition-colors text-left">
                  <img src={`https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/${p.id}.png`} alt={p.name} className="w-8 h-8 object-contain" />
                  <span className="text-sm text-white capitalize">{formatPokemonName(p.name)}</span>
                  <span className="ml-auto text-xs text-white/25 font-mono">#{String(p.id).padStart(4, "0")}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
