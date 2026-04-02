"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatPokemonName } from "@/lib/api";
import TypeBadge from "@/components/TypeBadge";

interface FormData {
  name: string;
  id: number;
  sprite: string | null;
  types: string[];
  statTotal: number;
}

const FORM_LABELS: Record<string, string> = {
  "mega": "Mega",
  "mega-x": "Mega X",
  "mega-y": "Mega Y",
  "primal": "Primal",
  "gmax": "Gigantamax",
  "alola": "Alolan",
  "galar": "Galarian",
  "hisui": "Hisuian",
  "paldea": "Paldean",
  "origin": "Origin Forme",
  "sky": "Sky Forme",
  "therian": "Therian Forme",
  "black": "Black Kyurem",
  "white": "White Kyurem",
  "attack": "Attack Forme",
  "defense": "Defense Forme",
  "speed": "Speed Forme",
  "blade": "Blade Forme",
  "shield": "Shield Forme",
  "10": "10% Forme",
  "50": "50% Forme",
  "complete": "Complete Forme",
  "dusk-mane": "Dusk Mane",
  "dawn-wings": "Dawn Wings",
  "ultra": "Ultra",
  "eternamax": "Eternamax",
  "hero": "Hero of Many Battles",
  "crowned": "Crowned",
  "ice": "Ice Rider",
  "shadow": "Shadow Rider",
};

function getFormLabel(baseName: string, formName: string): string {
  const suffix = formName.replace(baseName + "-", "");
  return FORM_LABELS[suffix] || formatPokemonName(suffix);
}

interface Props {
  baseName: string;
  varieties: { is_default: boolean; pokemon: { name: string; url: string } }[];
}

export default function PokemonForms({ baseName, varieties }: Props) {
  const [forms, setForms] = useState<FormData[]>([]);
  const [loading, setLoading] = useState(true);

  const altVarieties = varieties.filter((v) => !v.is_default);

  useEffect(() => {
    if (altVarieties.length === 0) {
      setLoading(false);
      return;
    }
    setForms([]);
    setLoading(true);
    Promise.allSettled(
      altVarieties.map((v) =>
        fetch(`https://pokeapi.co/api/v2/pokemon/${v.pokemon.name}`).then((r) => r.json())
      )
    ).then((results) => {
      const loaded: FormData[] = [];
      results.forEach((r) => {
        if (r.status === "fulfilled") {
          const p = r.value;
          loaded.push({
            name: p.name,
            id: p.id,
            sprite:
              p.sprites?.other?.["official-artwork"]?.front_default ||
              p.sprites?.front_default ||
              null,
            types: p.types.map((t: { type: { name: string } }) => t.type.name),
            statTotal: p.stats.reduce(
              (s: number, st: { base_stat: number }) => s + st.base_stat,
              0
            ),
          });
        }
      });
      setForms(loaded);
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseName]);

  if (altVarieties.length === 0) return null;

  return (
    <div className="rounded-2xl border border-white/5 bg-[#111120] p-5">
      <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4">
        Alternate Forms
      </h3>
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {altVarieties.map((v) => (
            <div key={v.pokemon.name} className="skeleton h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {forms.map((form) => (
            <Link
              key={form.name}
              href={`/dex/${form.id}`}
              className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/3 border border-white/5 hover:border-white/20 hover:bg-white/5 transition-all group"
            >
              <div className="w-16 h-16">
                {form.sprite ? (
                  <img
                    src={form.sprite}
                    alt={form.name}
                    className="w-full h-full object-contain group-hover:scale-110 transition-transform"
                  />
                ) : (
                  <div className="w-full h-full rounded-full bg-white/5 flex items-center justify-center text-2xl">
                    ?
                  </div>
                )}
              </div>
              <p className="text-xs font-semibold text-white/80 text-center leading-tight">
                {getFormLabel(baseName, form.name)}
              </p>
              <div className="flex gap-1 flex-wrap justify-center">
                {form.types.map((t) => (
                  <TypeBadge key={t} type={t} size="sm" />
                ))}
              </div>
              <p className="text-[10px] text-white/30 font-mono">BST {form.statTotal}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}