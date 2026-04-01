"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { EvolutionChainLink } from "@/lib/types";
import { formatPokemonName, getPokemonIdFromUrl, getPokemonImageUrl } from "@/lib/api";
import TypeBadge from "./TypeBadge";

interface EvoNode {
  id: number;
  name: string;
  details: string;
}

function flattenChain(link: EvolutionChainLink, detail = ""): EvoNode[][] {
  const id = getPokemonIdFromUrl(link.species.url);
  const node: EvoNode = { id, name: link.species.name, details: detail };

  if (link.evolves_to.length === 0) return [[node]];

  return link.evolves_to.flatMap((next) => {
    const d = next.evolution_details[0];
    let method = "";
    if (d) {
      if (d.min_level) method = `Lv. ${d.min_level}`;
      else if (d.item) method = d.item.name.replace(/-/g, " ");
      else if (d.min_happiness) method = "Friendship";
      else if (d.trigger?.name === "use-item" && d.held_item)
        method = d.held_item.name.replace(/-/g, " ");
      else method = d.trigger?.name?.replace(/-/g, " ") || "";
    }
    return flattenChain(next, method).map((chain) => [node, ...chain]);
  });
}

function EvoSprite({ id, name }: { id: number; name: string }) {
  const [err, setErr] = useState(false);
  return (
    <Link
      href={`/dex/${id}`}
      className="flex flex-col items-center gap-2 group hover:opacity-80 transition-opacity"
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
  const uniqueIds = new Set<number>();
  const dedupedChains = chains.filter((ch) => {
    const key = ch.map((n) => n.id).join("-");
    if (uniqueIds.has(parseInt(key))) return false;
    uniqueIds.add(parseInt(key));
    return true;
  });

  if (chains[0]?.length === 1) {
    return (
      <div className="flex justify-center py-4">
        <EvoSprite id={chains[0][0].id} name={chains[0][0].name} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {dedupedChains.map((chain, ci) => (
        <div key={ci} className="flex items-center justify-center gap-2 sm:gap-4 flex-wrap">
          {chain.map((node, ni) => (
            <div key={node.id} className="flex items-center gap-2 sm:gap-4">
              {ni > 0 && (
                <div className="flex flex-col items-center">
                  <span className="text-white/30 text-lg">→</span>
                  {node.details && (
                    <span className="text-[9px] text-white/30 capitalize max-w-[60px] text-center leading-tight">
                      {node.details}
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