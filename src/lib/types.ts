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

export interface PokemonMoveEntry {
  move: { name: string; url: string };
  version_group_details: {
    level_learned_at: number;
    move_learn_method: { name: string };
    version_group: { name: string };
  }[];
}

export interface HeldItem {
  item: { name: string; url: string };
  version_details: { rarity: number; version: { name: string } }[];
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
  moves: PokemonMoveEntry[];
  held_items: HeldItem[];
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
  varieties: {
    is_default: boolean;
    pokemon: { name: string; url: string };
  }[];
}

export interface EvolutionChainLink {
  species: { name: string; url: string };
  evolves_to: EvolutionChainLink[];
  evolution_details: {
    min_level: number | null;
    item: { name: string } | null;
    trigger: { name: string };
    min_happiness: number | null;
    min_beauty: number | null;
    min_affection: number | null;
    time_of_day: string;
    held_item: { name: string } | null;
    known_move: { name: string } | null;
    known_move_type: { name: string } | null;
    location: { name: string } | null;
    needs_overworld_rain: boolean;
    party_species: { name: string } | null;
    party_type: { name: string } | null;
    relative_physical_stats: number | null;
    trade_species: { name: string } | null;
    gender: number | null;
    turn_upside_down: boolean;
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

export interface MoveDetail {
  name: string;
  type: { name: string };
  damage_class: { name: string };
  power: number | null;
  accuracy: number | null;
  pp: number | null;
  priority: number;
  effect_chance: number | null;
  flavor_text_entries: {
    flavor_text: string;
    language: { name: string };
    version_group: { name: string };
  }[];
  effect_entries: {
    effect: string;
    short_effect: string;
    language: { name: string };
  }[];
  learned_by_pokemon: { name: string; url: string }[];
}

export interface AbilityDetail {
  name: string;
  flavor_text_entries: {
    flavor_text: string;
    language: { name: string };
    version_group: { name: string };
  }[];
  effect_entries: {
    effect: string;
    short_effect: string;
    language: { name: string };
  }[];
}

export interface ItemDetail {
  name: string;
  sprites: { default: string | null };
  flavor_text_entries: {
    text: string;
    language: { name: string };
    version_group: { name: string };
  }[];
  effect_entries: {
    effect: string;
    short_effect: string;
    language: { name: string };
  }[];
  category: { name: string };
}