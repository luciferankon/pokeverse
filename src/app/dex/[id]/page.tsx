"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  fetchPokemon,
  fetchPokemonSpecies,
  fetchEvolutionChain,
  fetchAbility,
  formatPokemonName,
  getPokemonImageUrl,
  calculateTypeMatchups,
} from "@/lib/api";
import {
  Pokemon,
  PokemonSpecies,
  EvolutionChain,
  TypeMatchups,
  AbilityDetail,
} from "@/lib/types";
import TypeBadge from "@/components/TypeBadge";
import StatBar from "@/components/StatBar";
import EvolutionChainDisplay from "@/components/EvolutionChain";
import PokemonForms from "@/components/PokemonForms";
import PokemonMoves from "@/components/PokemonMoves";
import PokemonItems from "@/components/PokemonItems";
import { typeColors } from "@/lib/typeColors";
import { useFavourites } from "@/hooks/useFavourites";

export default function PokemonDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [pokemon, setPokemon] = useState<Pokemon | null>(null);
  const [species, setSpecies] = useState<PokemonSpecies | null>(null);
  const [evo, setEvo] = useState<EvolutionChain | null>(null);
  const [matchups, setMatchups] = useState<TypeMatchups | null>(null);
  const [abilityDetails, setAbilityDetails] = useState<Record<string, AbilityDetail>>({});
  const [expandedAbility, setExpandedAbility] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showShiny, setShowShiny] = useState(false);
  const [imgError, setImgError] = useState(false);

  const { isFavourite, toggle } = useFavourites();

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(false);
    setImgError(false);
    setShowShiny(false);
    setAbilityDetails({});
    setExpandedAbility(null);

    const load = async () => {
      try {
        const poke: Pokemon = await fetchPokemon(id);
        setPokemon(poke);

        const [spec, tm] = await Promise.all([
          fetchPokemonSpecies(poke.species.name),
          calculateTypeMatchups(poke.types.map((t) => t.type.name)),
        ]);
        setSpecies(spec);
        setMatchups(tm);

        const evoData = await fetchEvolutionChain(spec.evolution_chain.url);
        setEvo(evoData);

        // Fetch ability details in background (non-blocking)
        Promise.allSettled(
          poke.abilities.map((a) => fetchAbility(a.ability.name))
        ).then((results) => {
          const details: Record<string, AbilityDetail> = {};
          results.forEach((r, i) => {
            if (r.status === "fulfilled") {
              details[poke.abilities[i].ability.name] = r.value;
            }
          });
          setAbilityDetails(details);
        });
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) return <LoadingScreen />;
  if (error || !pokemon)
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="text-5xl mb-4">😢</div>
        <h2 className="text-xl font-bold text-white mb-2">Pokémon not found</h2>
        <p className="text-white/40 mb-6">Could not find #{id}</p>
        <Link href="/dex" className="px-6 py-2.5 bg-[#dc2626] text-white rounded-xl font-medium">
          Back to PokéDex
        </Link>
      </div>
    );

  const primaryType = pokemon.types[0]?.type.name || "normal";
  const accentColor = typeColors[primaryType] || "#9CA3AF";
  const flavorText =
    species?.flavor_text_entries
      .find((e) => e.language.name === "en")
      ?.flavor_text.replace(/\f/g, " ") || "";
  const genus = species?.genera.find((g) => g.language.name === "en")?.genus || "";
  const totalStats = pokemon.stats.reduce((s, st) => s + st.base_stat, 0);

  const imageUrl = showShiny
    ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${pokemon.id}.png`
    : getPokemonImageUrl(pokemon.id);

  const prevId = pokemon.id > 1 ? pokemon.id - 1 : null;
  const nextId = pokemon.id < 1025 ? pokemon.id + 1 : null;
  const fav = isFavourite(pokemon.id);

  const hasAltForms = (species?.varieties ?? []).filter((v) => !v.is_default).length > 0;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back + Navigation */}
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/dex"
          className="flex items-center gap-2 text-white/40 hover:text-white transition-colors text-sm"
        >
          ← PokéDex
        </Link>
        <div className="flex items-center gap-2">
          {prevId && (
            <Link
              href={`/dex/${prevId}`}
              className="px-3 py-1.5 bg-[#111120] border border-white/5 rounded-lg text-white/50 hover:text-white hover:border-white/15 transition-all text-xs"
            >
              ← #{String(prevId).padStart(4, "0")}
            </Link>
          )}
          {nextId && (
            <Link
              href={`/dex/${nextId}`}
              className="px-3 py-1.5 bg-[#111120] border border-white/5 rounded-lg text-white/50 hover:text-white hover:border-white/15 transition-all text-xs"
            >
              #{String(nextId).padStart(4, "0")} →
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Left column ── */}
        <div>
          {/* Hero card */}
          <div
            className="rounded-2xl border border-white/5 overflow-hidden mb-5"
            style={{ background: `linear-gradient(135deg, #111120, ${accentColor}18)` }}
          >
            <div className="relative p-8 flex flex-col items-center">
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: `radial-gradient(circle at 70% 30%, ${accentColor}20, transparent 60%)`,
                }}
              />

              {/* Number + rarity badges */}
              <div className="flex items-center gap-3 mb-4 relative z-10">
                <span className="text-xs font-mono text-white/25">
                  #{String(pokemon.id).padStart(4, "0")}
                </span>
                {species?.is_legendary && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/25 font-semibold uppercase tracking-wider">
                    Legendary
                  </span>
                )}
                {species?.is_mythical && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/25 font-semibold uppercase tracking-wider">
                    Mythical
                  </span>
                )}
              </div>

              {/* Sprite */}
              <div className="w-48 h-48 relative z-10 mb-4">
                {!imgError ? (
                  <img
                    key={imageUrl}
                    src={imageUrl}
                    alt={pokemon.name}
                    className="w-full h-full object-contain drop-shadow-2xl"
                    onError={() => setImgError(true)}
                    style={showShiny ? { imageRendering: "pixelated" } : {}}
                  />
                ) : (
                  <div className="w-full h-full rounded-full bg-white/5 flex items-center justify-center text-6xl">
                    ?
                  </div>
                )}
              </div>

              {/* Name + genus */}
              <h1 className="text-3xl font-black text-white mb-1 relative z-10">
                {formatPokemonName(pokemon.name)}
              </h1>
              {genus && (
                <p className="text-sm text-white/35 mb-3 relative z-10">{genus}</p>
              )}

              {/* Types */}
              <div className="flex gap-2 mb-4 relative z-10">
                {pokemon.types.map(({ type }) => (
                  <TypeBadge key={type.name} type={type.name} size="lg" />
                ))}
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 relative z-10 flex-wrap justify-center">
                <button
                  onClick={() => setShowShiny(!showShiny)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    showShiny
                      ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/40"
                      : "bg-white/5 text-white/40 border-white/10 hover:text-white/60"
                  }`}
                >
                  ✨ {showShiny ? "Shiny" : "Normal"}
                </button>
                <button
                  onClick={() => toggle(pokemon.id)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    fav
                      ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/40"
                      : "bg-white/5 text-white/40 border-white/10 hover:text-white/60"
                  }`}
                >
                  {fav ? "★ Saved" : "☆ Favourite"}
                </button>
                <Link
                  href={`/compare?a=${pokemon.id}`}
                  className="px-4 py-1.5 rounded-full text-xs font-semibold border bg-white/5 text-white/40 border-white/10 hover:text-white/60 transition-all"
                >
                  ⚖️ Compare
                </Link>
              </div>
            </div>
          </div>

          {/* Flavor text */}
          {flavorText && (
            <div className="rounded-2xl border border-white/5 bg-[#111120] p-5 mb-5">
              <p className="text-sm text-white/50 italic leading-relaxed">
                &ldquo;{flavorText}&rdquo;
              </p>
            </div>
          )}

          {/* Vitals */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            {[
              { label: "Height", value: `${(pokemon.height / 10).toFixed(1)} m` },
              { label: "Weight", value: `${(pokemon.weight / 10).toFixed(1)} kg` },
              {
                label: "Base XP",
                value: pokemon.base_experience?.toLocaleString() || "—",
              },
              {
                label: "Generation",
                value:
                  species?.generation.name
                    .replace("generation-", "Gen ")
                    .toUpperCase() || "—",
              },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="rounded-xl border border-white/5 bg-[#111120] p-4"
              >
                <p className="text-[11px] text-white/30 uppercase tracking-wider mb-1">
                  {label}
                </p>
                <p className="text-base font-bold text-white">{value}</p>
              </div>
            ))}
          </div>

          {/* Abilities with expandable descriptions */}
          <div className="rounded-2xl border border-white/5 bg-[#111120] p-5">
            <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-3">
              Abilities
            </h3>
            <div className="space-y-2">
              {pokemon.abilities.map(({ ability, is_hidden }) => {
                const detail = abilityDetails[ability.name];
                const isExpanded = expandedAbility === ability.name;
                const desc =
                  detail?.effect_entries.find((e) => e.language.name === "en")
                    ?.short_effect ||
                  detail?.flavor_text_entries.find((e) => e.language.name === "en")
                    ?.flavor_text ||
                  "";
                return (
                  <div
                    key={ability.name}
                    className={`rounded-xl border overflow-hidden ${
                      is_hidden ? "border-purple-500/20" : "border-white/8"
                    }`}
                  >
                    <button
                      className={`w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors ${
                        is_hidden
                          ? "bg-purple-500/10 hover:bg-purple-500/15"
                          : "bg-white/5 hover:bg-white/8"
                      }`}
                      onClick={() =>
                        setExpandedAbility(isExpanded ? null : ability.name)
                      }
                    >
                      <span
                        className={`text-sm font-medium capitalize ${
                          is_hidden ? "text-purple-300" : "text-white/70"
                        }`}
                      >
                        {ability.name.replace(/-/g, " ")}
                        {is_hidden && (
                          <span className="ml-2 text-[10px] text-purple-400/60 font-normal">
                            (Hidden Ability)
                          </span>
                        )}
                      </span>
                      <span className="text-white/25 text-xs shrink-0 ml-2">
                        {!detail ? "…" : isExpanded ? "▲" : "▼"}
                      </span>
                    </button>
                    {isExpanded && desc && (
                      <div
                        className={`px-3 py-2.5 border-t text-xs leading-relaxed ${
                          is_hidden
                            ? "border-purple-500/10 bg-purple-500/5 text-purple-200/55"
                            : "border-white/5 bg-white/[0.02] text-white/50"
                        }`}
                      >
                        {desc}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Right column ── */}
        <div className="space-y-5">
          {/* Base Stats */}
          <div className="rounded-2xl border border-white/5 bg-[#111120] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider">
                Base Stats
              </h3>
              <span className="text-sm font-bold text-white/60">
                Total: <span className="text-white">{totalStats}</span>
              </span>
            </div>
            <div className="space-y-2.5">
              {pokemon.stats.map((s) => (
                <StatBar key={s.stat.name} statName={s.stat.name} value={s.base_stat} />
              ))}
            </div>
          </div>

          {/* Type Matchups */}
          {matchups && (
            <div className="rounded-2xl border border-white/5 bg-[#111120] p-5">
              <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4">
                Type Matchups
              </h3>
              <div className="space-y-3">
                {matchups.doubleWeaknesses.length > 0 && (
                  <MatchupRow
                    label="4×"
                    types={matchups.doubleWeaknesses}
                    color="#EF4444"
                  />
                )}
                {matchups.weaknesses.length > 0 && (
                  <MatchupRow
                    label="2×"
                    types={matchups.weaknesses}
                    color="#F97316"
                  />
                )}
                {matchups.resistances.length > 0 && (
                  <MatchupRow
                    label="½×"
                    types={matchups.resistances}
                    color="#22C55E"
                  />
                )}
                {matchups.doubleResistances.length > 0 && (
                  <MatchupRow
                    label="¼×"
                    types={matchups.doubleResistances}
                    color="#3B82F6"
                  />
                )}
                {matchups.immunities.length > 0 && (
                  <MatchupRow
                    label="0×"
                    types={matchups.immunities}
                    color="#7C3AED"
                  />
                )}
              </div>
            </div>
          )}

          {/* Evolution Chain */}
          {evo && (
            <div className="rounded-2xl border border-white/5 bg-[#111120] p-5">
              <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4">
                Evolution Chain
              </h3>
              <EvolutionChainDisplay chain={evo.chain} />
            </div>
          )}
        </div>
      </div>

      {/* ── Below main grid: Forms / Items / Moves ── */}
      <div className="mt-6 space-y-5">
        {/* Alternate Forms (Mega, Primal, Gigantamax, Regional…) */}
        {hasAltForms && species && (
          <PokemonForms baseName={pokemon.name} varieties={species.varieties} />
        )}

        {/* Held Items + Berries */}
        {pokemon.held_items && pokemon.held_items.length > 0 && (
          <PokemonItems heldItems={pokemon.held_items} />
        )}

        {/* Learnable Moves (Level Up / TM / Egg / Tutor) */}
        {pokemon.moves && pokemon.moves.length > 0 && (
          <PokemonMoves moves={pokemon.moves} />
        )}
      </div>
    </div>
  );
}

function MatchupRow({
  label,
  types,
  color,
}: {
  label: string;
  types: string[];
  color: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="text-xs font-bold w-7 shrink-0 text-right"
        style={{ color }}
      >
        {label}
      </span>
      <div className="flex flex-wrap gap-1">
        {types.map((t) => (
          <TypeBadge key={t} type={t} size="sm" />
        ))}
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="h-6 w-24 skeleton mb-6" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-5">
          <div className="skeleton h-80 rounded-2xl" />
          <div className="skeleton h-24 rounded-2xl" />
          <div className="skeleton h-32 rounded-2xl" />
        </div>
        <div className="space-y-5">
          <div className="skeleton h-56 rounded-2xl" />
          <div className="skeleton h-48 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
