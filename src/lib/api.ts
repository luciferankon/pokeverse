const BASE = "https://pokeapi.co/api/v2";

export async function fetchPokemonList(limit = 20, offset = 0) {
  const res = await fetch(`${BASE}/pokemon?limit=${limit}&offset=${offset}`);
  if (!res.ok) throw new Error("Failed to fetch Pokémon list");
  return res.json();
}

export async function fetchPokemon(nameOrId: string | number) {
  const res = await fetch(`${BASE}/pokemon/${nameOrId}`);
  if (!res.ok) throw new Error(`Failed to fetch Pokémon: ${nameOrId}`);
  return res.json();
}

export async function fetchPokemonSpecies(nameOrId: string | number) {
  const res = await fetch(`${BASE}/pokemon-species/${nameOrId}`);
  if (!res.ok) throw new Error(`Failed to fetch species: ${nameOrId}`);
  return res.json();
}

export async function fetchEvolutionChain(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch evolution chain");
  return res.json();
}

export async function fetchType(typeName: string) {
  const res = await fetch(`${BASE}/type/${typeName}`);
  if (!res.ok) throw new Error(`Failed to fetch type: ${typeName}`);
  return res.json();
}

export async function fetchAbility(nameOrId: string | number) {
  const res = await fetch(`${BASE}/ability/${nameOrId}`);
  if (!res.ok) throw new Error(`Failed to fetch ability`);
  return res.json();
}

export async function fetchMove(nameOrId: string | number) {
  const res = await fetch(`${BASE}/move/${nameOrId}`);
  if (!res.ok) throw new Error(`Failed to fetch move: ${nameOrId}`);
  return res.json();
}

export async function fetchItem(nameOrId: string | number) {
  const res = await fetch(`${BASE}/item/${nameOrId}`);
  if (!res.ok) throw new Error(`Failed to fetch item: ${nameOrId}`);
  return res.json();
}

export function getPokemonIdFromUrl(url: string): number {
  const parts = url.split("/").filter(Boolean);
  return parseInt(parts[parts.length - 1]);
}

export function formatPokemonName(name: string): string {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getPokemonImageUrl(id: number, shiny = false): string {
  if (shiny) {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${id}.png`;
  }
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
}

export function getPokemonAnimatedUrl(id: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
}

export async function calculateTypeMatchups(types: string[]) {
  const typeData = await Promise.all(
    types.map((t) => fetch(`${BASE}/type/${t}`).then((r) => r.json()))
  );

  const ALL_TYPES = [
    "normal","fire","water","electric","grass","ice","fighting","poison",
    "ground","flying","psychic","bug","rock","ghost","dragon","dark","steel","fairy",
  ];

  const effectiveness: Record<string, number> = {};
  ALL_TYPES.forEach((t) => (effectiveness[t] = 1));

  typeData.forEach((td) => {
    td.damage_relations.double_damage_from.forEach(
      (t: { name: string }) => (effectiveness[t.name] *= 2)
    );
    td.damage_relations.half_damage_from.forEach(
      (t: { name: string }) => (effectiveness[t.name] *= 0.5)
    );
    td.damage_relations.no_damage_from.forEach(
      (t: { name: string }) => (effectiveness[t.name] *= 0)
    );
  });

  return {
    doubleWeaknesses: ALL_TYPES.filter((t) => effectiveness[t] >= 4),
    weaknesses: ALL_TYPES.filter((t) => effectiveness[t] === 2),
    resistances: ALL_TYPES.filter((t) => effectiveness[t] === 0.5),
    doubleResistances: ALL_TYPES.filter((t) => effectiveness[t] === 0.25),
    immunities: ALL_TYPES.filter((t) => effectiveness[t] === 0),
  };
}