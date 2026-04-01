export interface PokemonListItem {
  name: string;
  url: string;
}

export interface PokemonType {
  slot: number;
  type: { name: string; url: string };
}

export interface PokemonStat {
  base_stat: number;
  effort: number;
  stat: { name: string; url: string };
}

export interface PokemonAbility {
  ability: { name: string; url: string };
  is_hidden: boolean;
  slot: number;
}

export interface PokemonSprites {
  front_default: string | null;
  front_shiny: string | null;
  back_default: string | null;
  other: {
    "official-artwork": {
      front_default: string | null;
      front_shiny: string | null;
    };
    showdown?: {
      front_default: string | null;
      front_shiny: string | null;
    };
  };
}

export interface Pokemon {
  id: number;
  name: string;
  base_experience: number;
  height: number;
  weight: number;
  sprites: PokemonSprites;
  stats: PokemonStat[];
  types: PokemonType[];
  abilities: PokemonAbility[];
  species: { name: string; url: string };
}

export interface PokemonSpecies {
  id: number;
  name: string;
  flavor_text_entries: {
    flavor_text: string;
    language: { name: string };
    version: { name: string };
  }[];
  evolution_chain: { url: string };
  color: { name: string };
  is_legendary: boolean;
  is_mythical: boolean;
  generation: { name: string };
  genera: { genus: string; language: { name: string } }[];
}

export interface EvolutionChainLink {
  species: { name: string; url: string };
  evolves_to: EvolutionChainLink[];
  evolution_details: {
    min_level: number | null;
    item: { name: string } | null;
    trigger: { name: string };
    min_happiness: number | null;
    time_of_day: string;
    held_item: { name: string } | null;
  }[];
}

export interface EvolutionChain {
  id: number;
  chain: EvolutionChainLink;
}

export interface TypeMatchups {
  doubleWeaknesses: string[];
  weaknesses: string[];
  resistances: string[];
  doubleResistances: string[];
  immunities: string[];
}