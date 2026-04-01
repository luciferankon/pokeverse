"use client";

import { useState } from "react";
import Link from "next/link";
import { Pokemon } from "@/lib/types";
import { formatPokemonName, getPokemonImageUrl } from "@/lib/api";
import TypeBadge from "./TypeBadge";
import { typeColors } from "@/lib/typeColors";

interface PokemonCardProps {
  pokemon: Pokemon;
  onClick?: () => void;
  selected?: boolean;
  actionLabel?: string;
}

export default function PokemonCard({
  pokemon,
  onClick,
  selected,
  actionLabel,
}: PokemonCardProps) {
  const [imgError, setImgError] = useState(false);
  const primaryType = pokemon.types[0]?.type.name || "normal";
  const color = typeColors[primaryType] || "#9CA3AF";

  const inner = (
    <div
      className={`relative group cursor-pointer rounded-2xl border transition-all duration-300 overflow-hidden ${
        selected
          ? "border-white/30 bg-white/10"
          : "border-white/5 bg-[#111120] hover:border-white/15 hover:bg-[#1a1a2e]"
      }`}
      style={
        selected
          ? { boxShadow: `0 0 25px ${color}35` }
          : undefined
      }
      onClick={onClick}
    >
      {/* Colour wash */}
      <div
        className="absolute inset-0 opacity-[0.06] group-hover:opacity-[0.1] transition-opacity pointer-events-none"
        style={{
          background: `radial-gradient(circle at 65% 25%, ${color}, transparent 70%)`,
        }}
      />

      {/* Number */}
      <div className="absolute top-2.5 right-3 text-[10px] font-mono text-white/20">
        #{String(pokemon.id).padStart(4, "0")}
      </div>

      <div className="relative p-4 pt-5">
        {/* Sprite */}
        <div className="flex justify-center mb-3">
          <div className="w-20 h-20">
            {!imgError ? (
              <img
                src={getPokemonImageUrl(pokemon.id)}
                alt={pokemon.name}
                className="w-full h-full object-contain drop-shadow-lg group-hover:scale-110 transition-transform duration-300"
                onError={() => setImgError(true)}
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl opacity-50">
                ●
              </div>
            )}
          </div>
        </div>

        {/* Name */}
        <p className="text-center text-sm font-semibold text-white mb-2 truncate">
          {formatPokemonName(pokemon.name)}
        </p>

        {/* Types */}
        <div className="flex justify-center gap-1 flex-wrap">
          {pokemon.types.map(({ type }) => (
            <TypeBadge key={type.name} type={type.name} size="sm" />
          ))}
        </div>

        {/* Action label */}
        {actionLabel && (
          <div
            className="mt-3 text-center text-xs font-medium py-1 rounded-lg"
            style={{
              backgroundColor: `${color}15`,
              color: color,
            }}
          >
            {actionLabel}
          </div>
        )}
      </div>
    </div>
  );

  if (onClick) return inner;
  return <Link href={`/dex/${pokemon.id}`}>{inner}</Link>;
}