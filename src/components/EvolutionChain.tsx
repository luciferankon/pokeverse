"use client";

import { useState } from "react";
import Link from "next/link";
import { EvolutionChainLink } from "@/lib/types";
import { formatPokemonName, getPokemonIdFromUrl, getPokemonImageUrl } from "@/lib/api";

type EvoDetail = EvolutionChainLink["evolution_details"][0];

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function getEvoMethodLabel(d: EvoDetail): string {
  if (!d) return "";

  const t = d.trigger?.name;
  const parts: string[] = [];

  if (t === "level-up") {
    if (d.min_level) parts.push(`Lv. ${d.min_level}`);
    else if (d.min_happiness) parts.push("High Friendship");
    else if (d.min_beauty) parts.push("High Beauty");
    else if (d.min_affection) parts.push("High Affection");
    else if (d.known_move) parts.push(`Know ${formatPokemonName(d.known_move.name)}`);
    else if (d.known_move_type) parts.push(`Know ${cap(d.known_move_type.name)}-type`);
    else if (d.location) parts.push(formatPokemonName(d.location.name));
    else if (d.held_item) parts.push(`Hold ${formatPokemonName(d.held_item.name)}`);
    else if (d.party_species) parts.push(`With ${formatPokemonName(d.party_species.name)}`);
    else if (d.party_type) parts.push(`With ${cap(d.party_type.name)}-type`);
    else if (d.relative_physical_stats !== null && d.relative_physical_stats !== undefined) {
      if (d.relative_physical_stats > 0) parts.push("Atk > Def");
      else if (d.relative_physical_stats < 0) parts.push("Def > Atk");
      else parts.push("Atk = Def");
    } else if (d.needs_overworld_rain) parts.push("In Rain");
    else if (d.turn_upside_down) parts.push("Upside Down");
    else parts.push("Level Up");

    if (d.time_of_day === "day") parts.push("(Day)");
    else if (d.time_of_day === "night") parts.push("(Night)");
    if (d.gender === 1) parts.push("(♀)");
    else if (d.gender === 2) parts.push("(♂)");
  } else if (t === "trade") {
    parts.push("Trade");
    if (d.held_item) parts.push(`w/ ${formatPokemonName(d.held_item.name)}`);
    if (d.trade_species) parts.push(`for ${formatPokemonName(d.trade_species.name)}`);
  } else if (t === "use-item") {
    parts.push(d.item ? formatPokemonName(d.item.name) : "Use Item");
    if (d.gender === 1) parts.push("(♀)");
    else if (d.gender === 2) parts.push("(♂)");
  } else if (t === "shed") {
    parts.push("Shed (Lv. 20 + empty slot)");
  } else if (t === "spin") {
    parts.push("Spin");
  } else if (t === "tower-of-darkness") {
    parts.push("Tower of Darkness");
  } else if (t === "tower-of-waters") {
    parts.push("Tower of Waters");
  } else if (t === "three-critical-hits") {
    parts.push("3 Critical Hits");
  } else if (t === "take-damage") {
    parts.push("Take Damage");
  } else if (t === "agile-style-move") {
    parts.push("Agile Style");
  } else if (t === "strong-style-move") {
    parts.push("Strong Style");
  } else if (t === "recoil-damage") {
    parts.push("Recoil Damage");
  } else {
    parts.push(t?.replace(/-/g, " ") || "");
  }

  return parts.join(" ");
}

interface EvoNode {
  id: number;
  name: string;
  method: string;
}

function flattenChain(link: EvolutionChainLink, method = ""): EvoNode[][] {
  const id = getPokemonIdFromUrl(link.species.url);
  const node: EvoNode = { id, name: link.species.name, method };

  if (link.evolves_to.length === 0) return [[node]];

  return link.evolves_to.flatMap((next) => {
    const d = next.evolution_details[0];
    const nextMethod = d ? getEvoMethodLabel(d) : "";
    return flattenChain(next, nextMethod).map((chain) => [node, ...chain]);
  });
}

function EvoSprite({ id, name }: { id: number; name: string }) {
  const [err, setErr] = useState(false);
  return (
    <Link
      href={`/dex/${id}`}
      className="flex flex-col items-center gap-1.5 group hover:opacity-80 transition-opacity"
    >
      <div className="w-16 h-16 sm:w-20 sm:h-20">
        {!err ? (
          <img
            src={getPokemonImageUrl(id)}
            alt={name}
            className="w-full h-full object-contain drop-shadow-md group-hover:scale-110 transition-transform"
            onError={() => setErr(true)}
          />
        ) : (
          <div className="w-full h-full rounded-full bg-white/5 flex items-center justify-center text-2xl">
            ?
          </div>
        )}
      </div>
      <span className="text-xs font-medium text-white/70 text-center">
        {formatPokemonName(name)}
      </span>
      <span className="text-[10px] text-white/30 font-mono">
        #{String(id).padStart(3, "0")}
      </span>
    </Link>
  );
}

export default function EvolutionChainDisplay({
  chain,
}: {
  chain: EvolutionChainLink;
}) {
  const chains = flattenChain(chain);

  // Deduplicate by chain signature
  const seen = new Set<string>();
  const deduped = chains.filter((ch) => {
    const key = ch.map((n) => n.id).join("-");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (deduped[0]?.length === 1) {
    return (
      <div className="flex justify-center py-4">
        <EvoSprite id={deduped[0][0].id} name={deduped[0][0].name} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {deduped.map((ch, ci) => (
        <div
          key={ci}
          className="flex items-center justify-center gap-1 sm:gap-3 flex-wrap"
        >
          {ch.map((node, ni) => (
            <div key={node.id} className="flex items-center gap-1 sm:gap-3">
              {ni > 0 && (
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-white/30 text-base">→</span>
                  {node.method && (
                    <span className="text-[9px] text-white/35 max-w-[64px] text-center leading-tight capitalize">
                      {node.method}
                    </span>
                  )}
                </div>
              )}
              <EvoSprite id={node.id} name={node.name} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}