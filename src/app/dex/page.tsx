"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Pokemon } from "@/lib/types";
import { fetchPokemon, getPokemonIdFromUrl } from "@/lib/api";
import PokemonCard from "@/components/PokemonCard";
import { typeColors } from "@/lib/typeColors";

const ALL_TYPES = [
  "normal","fire","water","electric","grass","ice","fighting","poison",
  "ground","flying","psychic","bug","rock","ghost","dragon","dark","steel","fairy",
];
const PAGE_SIZE = 24;
const BASE = "https://pokeapi.co/api/v2";

interface ListItem { name: string; id: number }

export default function DexPage() {
  const [masterList, setMasterList] = useState<ListItem[]>([]);
  const [filteredList, setFilteredList] = useState<ListItem[]>([]);
  const [cards, setCards] = useState<Pokemon[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState("");
  const [activeType, setActiveType] = useState("");
  const [pageOffset, setPageOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentListRef = useRef<ListItem[]>([]);

  // Load full master list on mount
  useEffect(() => {
    fetch(`${BASE}/pokemon?limit=1025`)
      .then((r) => r.json())
      .then((d) => {
        const list: ListItem[] = d.results.map((p: { name: string; url: string }) => ({
          name: p.name,
          id: getPokemonIdFromUrl(p.url),
        }));
        setMasterList(list);
        setFilteredList(list);
        setTotalCount(d.count);
      });
  }, []);

  // Handle type filter change
  useEffect(() => {
    if (!activeType) {
      setFilteredList(masterList);
      return;
    }
    fetch(`${BASE}/type/${activeType}`)
      .then((r) => r.json())
      .then((d) => {
        const list: ListItem[] = d.pokemon
          .map((e: { pokemon: { name: string; url: string } }) => ({
            name: e.pokemon.name,
            id: getPokemonIdFromUrl(e.pokemon.url),
          }))
          .filter((p: ListItem) => p.id <= 1025)
          .sort((a: ListItem, b: ListItem) => a.id - b.id);
        setFilteredList(list);
      });
  }, [activeType, masterList]);

  // Search debounce: apply against filteredList
  const getSearchFiltered = useCallback(
    (base: ListItem[], q: string) => {
      if (!q) return base;
      const lq = q.toLowerCase().trim();
      return base.filter(
        (p) => p.name.includes(lq) || String(p.id) === lq
      );
    },
    []
  );

  // Load a page of pokemon cards
  const loadCards = useCallback(
    async (list: ListItem[], offset: number, existing: Pokemon[]) => {
      const slice = list.slice(offset, offset + PAGE_SIZE);
      if (slice.length === 0) {
        setHasMore(false);
        setLoading(false);
        return;
      }
      if (offset === 0) setLoading(true);
      else setLoadingMore(true);

      const results = await Promise.allSettled(slice.map((p) => fetchPokemon(p.id)));
      const loaded = results
        .filter((r): r is PromiseFulfilledResult<Pokemon> => r.status === "fulfilled")
        .map((r) => r.value);

      setCards(offset === 0 ? loaded : [...existing, ...loaded]);
      setHasMore(offset + PAGE_SIZE < list.length);
      setLoading(false);
      setLoadingMore(false);
    },
    []
  );

  // When filteredList changes, reset and load first page
  useEffect(() => {
    if (filteredList.length === 0 && masterList.length > 0) {
      setCards([]);
      setHasMore(false);
      setLoading(false);
      return;
    }
    if (filteredList.length === 0) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const toShow = getSearchFiltered(filteredList, search);
      currentListRef.current = toShow;
      setPageOffset(0);
      loadCards(toShow, 0, []);
    }, 300);
  }, [filteredList, search, getSearchFiltered, loadCards]);

  const handleLoadMore = () => {
    const next = pageOffset + PAGE_SIZE;
    setPageOffset(next);
    loadCards(currentListRef.current, next, cards);
  };

  const displayCount = getSearchFiltered(filteredList, search).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-1">📖 PokéDex</h1>
        <p className="text-white/30 text-sm">
          {totalCount > 0
            ? `${totalCount.toLocaleString()} Pokémon in the database`
            : "Loading database..."}
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <svg
          className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          placeholder="Search by name or number…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-11 pr-10 py-3.5 bg-[#111120] border border-white/5 rounded-xl text-white placeholder:text-white/20 focus:outline-none focus:border-[#dc2626]/40 focus:ring-1 focus:ring-[#dc2626]/20 transition-colors text-sm"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {/* Type filters */}
      <div className="flex flex-wrap gap-2 mb-8">
        <button
          onClick={() => setActiveType("")}
          className={`px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider border transition-all ${
            !activeType
              ? "bg-white/15 text-white border-white/25"
              : "text-white/35 border-white/8 hover:text-white/60"
          }`}
        >
          All
        </button>
        {ALL_TYPES.map((type) => {
          const c = typeColors[type];
          const active = activeType === type;
          return (
            <button
              key={type}
              onClick={() => setActiveType(active ? "" : type)}
              className="px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider transition-all"
              style={{
                backgroundColor: active ? `${c}25` : `${c}0d`,
                color: active ? c : `${c}70`,
                border: `1px solid ${active ? c + "50" : c + "20"}`,
              }}
            >
              {type}
            </button>
          );
        })}
      </div>

      {/* Count */}
      {!loading && (
        <p className="text-xs text-white/25 mb-5">
          Showing {cards.length} of {displayCount.toLocaleString()} Pokémon
          {(search || activeType) && " matching filters"}
        </p>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="skeleton h-44" />
          ))}
        </div>
      ) : cards.length === 0 ? (
        <div className="text-center py-24 text-white/30">
          <div className="text-5xl mb-4">🔍</div>
          <p className="font-medium">No Pokémon found</p>
          <p className="text-sm mt-1">Try a different search or filter</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {cards.map((pokemon) => (
              <PokemonCard key={pokemon.id} pokemon={pokemon} />
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center mt-10">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-8 py-3 bg-[#111120] border border-white/8 text-white/70 font-medium rounded-xl hover:border-white/15 hover:text-white transition-all disabled:opacity-40 text-sm"
              >
                {loadingMore ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="animate-spin w-4 h-4"
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
                    Loading…
                  </span>
                ) : (
                  "Load More"
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}