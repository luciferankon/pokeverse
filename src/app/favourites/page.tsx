"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useFavourites } from "@/hooks/useFavourites";
import { fetchPokemon } from "@/lib/api";
import { Pokemon } from "@/lib/types";
import PokemonCard from "@/components/PokemonCard";

export default function FavouritesPage() {
  const { favourites, toggle } = useFavourites();
  const [pokemons, setPokemons] = useState<Pokemon[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (favourites.length === 0) {
      setPokemons([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.allSettled(favourites.map(id => fetchPokemon(id)))
      .then(results => {
        const loaded = results
          .filter((r): r is PromiseFulfilledResult<Pokemon> => r.status === "fulfilled")
          .map(r => r.value);
        setPokemons(loaded);
      })
      .finally(() => setLoading(false));
  }, [favourites]);

  const clearAll = () => {
    [...favourites].forEach(id => toggle(id));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">⭐ Favourites</h1>
          <p className="text-white/30 text-sm">
            {favourites.length > 0
              ? `${favourites.length} Pokémon saved`
              : "No favourites yet"}
          </p>
        </div>
        {favourites.length > 0 && (
          <button
            onClick={clearAll}
            className="text-xs text-white/30 hover:text-red-400 transition-colors mt-1"
          >
            Clear All
          </button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: Math.max(favourites.length, 6) }).map((_, i) => (
            <div key={i} className="skeleton h-44" />
          ))}
        </div>
      ) : pokemons.length === 0 ? (
        <div className="text-center py-24">
          <div className="text-6xl mb-4 opacity-30">⭐</div>
          <h2 className="text-xl font-bold text-white mb-2">No favourites yet</h2>
          <p className="text-white/30 text-sm mb-8 max-w-sm mx-auto">
            Open any Pokémon in the PokéDex and tap ☆ Favourite to save it here.
          </p>
          <Link
            href="/dex"
            className="px-6 py-3 bg-[#dc2626] hover:bg-[#ef4444] text-white font-semibold rounded-xl transition-colors text-sm"
          >
            Browse PokéDex
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {pokemons.map(pokemon => (
            <PokemonCard key={pokemon.id} pokemon={pokemon} />
          ))}
        </div>
      )}
    </div>
  );
}
