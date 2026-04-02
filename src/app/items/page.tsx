"use client";

import { useState, useEffect } from "react";

const BASE = "https://pokeapi.co/api/v2";

interface ItemBasic {
  name: string;
  url: string;
}

interface ItemFull {
  name: string;
  sprite: string | null;
  description: string;
  category: string;
  cost: number;
  fling_power: number | null;
}

interface BerryExtra {
  natural_gift_power: number;
  natural_gift_type: { name: string };
  growth_time: number;
  firmness: { name: string };
  flavors: { potency: number; flavor: { name: string } }[];
}

type TabId =
  | "berries"
  | "evolution"
  | "held"
  | "medicine"
  | "balls"
  | "battle"
  | "mega"
  | "machines";

const TABS: { id: TabId; label: string; icon: string; categories: string[] }[] = [
  { id: "berries", label: "Berries", icon: "\ud83c\udf53", categories: [] },
  { id: "evolution", label: "Evolution", icon: "\u2728", categories: ["evolution"] },
  {
    id: "held",
    label: "Held Items",
    icon: "\ud83d\udc8e",
    categories: ["held-items", "choice", "effort-training", "type-enhancement", "species-specific"],
  },
  {
    id: "medicine",
    label: "Medicine",
    icon: "\ud83d\udc8a",
    categories: ["healing", "status-cures", "revival", "pp-recovery", "vitamins"],
  },
  {
    id: "balls",
    label: "Pok\u00e9 Balls",
    icon: "\u26aa",
    categories: ["standard-balls", "special-balls", "apricorn-balls"],
  },
  {
    id: "battle",
    label: "Battle",
    icon: "\u2694\ufe0f",
    categories: ["stat-boosts", "in-a-pinch", "type-protection", "bad-held-items"],
  },
  {
    id: "mega",
    label: "Mega / Z",
    icon: "\ud83d\udca0",
    categories: ["mega-stones", "z-crystals"],
  },
  {
    id: "machines",
    label: "TMs",
    icon: "\ud83d\udcbf",
    categories: ["all-machines"],
  },
];

export default function ItemsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("berries");
  const [items, setItems] = useState<ItemBasic[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [itemDetails, setItemDetails] = useState<Record<string, ItemFull>>({});
  const [berryExtras, setBerryExtras] = useState<Record<string, BerryExtra>>({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);

  // ── Fetch item list for active tab ──
  useEffect(() => {
    setItems([]);
    setLoadingList(true);
    setSearch("");
    setExpandedItem(null);

    const tab = TABS.find((t) => t.id === activeTab);
    if (!tab) return;

    if (activeTab === "berries") {
      fetch(`${BASE}/berry?limit=100`)
        .then((r) => r.json())
        .then((data) => {
          Promise.allSettled(
            data.results.map((b: { url: string }) =>
              fetch(b.url).then((r) => r.json())
            )
          ).then((results) => {
            const berryItems: ItemBasic[] = [];
            const extras: Record<string, BerryExtra> = {};
            results.forEach((r) => {
              if (r.status !== "fulfilled") return;
              const b = r.value;
              berryItems.push({ name: b.item.name, url: b.item.url });
              extras[b.item.name] = {
                natural_gift_power: b.natural_gift_power,
                natural_gift_type: b.natural_gift_type,
                growth_time: b.growth_time,
                firmness: b.firmness,
                flavors: b.flavors,
              };
            });
            setItems(berryItems.sort((a, b) => a.name.localeCompare(b.name)));
            setBerryExtras(extras);
            setLoadingList(false);
          });
        })
        .catch(() => setLoadingList(false));
    } else {
      Promise.allSettled(
        tab.categories.map((cat) =>
          fetch(`${BASE}/item-category/${cat}`).then((r) => r.json())
        )
      ).then((results) => {
        const allItems: ItemBasic[] = [];
        const seen = new Set<string>();
        results.forEach((r) => {
          if (r.status !== "fulfilled") return;
          (r.value.items ?? []).forEach(
            (item: { name: string; url: string }) => {
              if (!seen.has(item.name)) {
                seen.add(item.name);
                allItems.push(item);
              }
            }
          );
        });
        setItems(allItems.sort((a, b) => a.name.localeCompare(b.name)));
        setLoadingList(false);
      });
    }
  }, [activeTab]);

  // ── Batch-load first 30 item details for sprites ──
  useEffect(() => {
    if (items.length === 0) return;
    const toLoad = items.slice(0, 30).filter((i) => !itemDetails[i.name]);
    if (toLoad.length === 0) return;

    Promise.allSettled(
      toLoad.map((i) => fetch(i.url).then((r) => r.json()))
    ).then((results) => {
      const batch: Record<string, ItemFull> = {};
      results.forEach((r, idx) => {
        if (r.status !== "fulfilled") return;
        const d = r.value;
        batch[toLoad[idx].name] = parseItemDetail(d);
      });
      setItemDetails((prev) => ({ ...prev, ...batch }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, activeTab]);

  // ── Toggle / lazy-load detail ──
  const toggleItem = async (name: string, url: string) => {
    if (expandedItem === name) {
      setExpandedItem(null);
      return;
    }
    setExpandedItem(name);
    if (itemDetails[name]) return;
    setLoadingDetail(name);
    try {
      const res = await fetch(url);
      const d = await res.json();
      setItemDetails((prev) => ({ ...prev, [name]: parseItemDetail(d) }));
    } catch {
      // ignore
    } finally {
      setLoadingDetail(null);
    }
  };

  const filtered = search
    ? items.filter((i) =>
        i.name.replace(/-/g, " ").includes(search.toLowerCase())
      )
    : items;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <h1 className="text-3xl font-black text-white mb-2">
        Items <span className="text-white/30">&amp;</span> Berries
      </h1>
      <p className="text-sm text-white/35 mb-6">
        Browse every item in the Pok\u00e9mon world — berries, evolution stones,
        held items, TMs, and more.
      </p>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search items..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[#111120] border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-white/25 transition-colors"
        />
      </div>

      {/* Category tabs */}
      <div className="flex gap-1.5 mb-5 overflow-x-auto pb-2 scrollbar-hide">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? "bg-[#dc2626] text-white"
                : "bg-[#111120] text-white/40 hover:text-white/60 border border-white/5"
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Count */}
      <p className="text-xs text-white/25 mb-3">
        {loadingList ? "Loading..." : `${filtered.length} items`}
      </p>

      {/* Items list */}
      {loadingList ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 skeleton rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-4xl mb-3">\ud83d\udd0d</p>
          <p className="text-white/40">No items found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {filtered.map((item) => {
            const detail = itemDetails[item.name];
            const isExpanded = expandedItem === item.name;
            const berry = berryExtras[item.name];
            const isLoading = loadingDetail === item.name;

            return (
              <div
                key={item.name}
                className={`rounded-xl border overflow-hidden transition-all ${
                  isExpanded
                    ? "border-white/15 bg-[#111120]"
                    : "border-white/5 bg-[#111120] hover:border-white/10"
                }`}
              >
                {/* Row */}
                <button
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                  onClick={() => toggleItem(item.name, item.url)}
                >
                  {/* Sprite */}
                  <div className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg bg-white/5">
                    {detail?.sprite ? (
                      <img
                        src={detail.sprite}
                        alt={item.name}
                        className="w-8 h-8 object-contain"
                        style={{ imageRendering: "pixelated" }}
                      />
                    ) : (
                      <span className="text-base">
                        {activeTab === "berries"
                          ? "\ud83c\udf53"
                          : activeTab === "balls"
                          ? "\u26aa"
                          : activeTab === "machines"
                          ? "\ud83d\udcbf"
                          : "\ud83c\udf92"}
                      </span>
                    )}
                  </div>

                  {/* Name + preview */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white/80 capitalize truncate">
                      {item.name.replace(/-/g, " ")}
                    </p>
                    {detail && (
                      <p className="text-[11px] text-white/30 truncate">
                        {detail.description}
                      </p>
                    )}
                  </div>

                  {/* Berry badge */}
                  {berry && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 border border-green-500/20 font-bold uppercase shrink-0">
                      Berry
                    </span>
                  )}

                  <span className="text-white/20 text-xs shrink-0">
                    {isExpanded ? "\u25b2" : "\u25bc"}
                  </span>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-3 pb-3 pt-1.5 border-t border-white/5">
                    {isLoading && !detail ? (
                      <div className="space-y-2">
                        <div className="h-3 skeleton rounded w-full" />
                        <div className="h-3 skeleton rounded w-2/3" />
                      </div>
                    ) : detail ? (
                      <div className="space-y-2.5">
                        <p className="text-xs text-white/55 leading-relaxed">
                          {detail.description}
                        </p>

                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          {detail.cost > 0 && (
                            <span className="text-[11px] text-white/35">
                              Cost:{" "}
                              <strong className="text-yellow-400/70">
                                \u20bd{detail.cost.toLocaleString()}
                              </strong>
                            </span>
                          )}
                          {detail.fling_power !== null && detail.fling_power > 0 && (
                            <span className="text-[11px] text-white/35">
                              Fling Power:{" "}
                              <strong className="text-white/60">
                                {detail.fling_power}
                              </strong>
                            </span>
                          )}
                          {detail.category && (
                            <span className="text-[11px] text-white/35">
                              Category:{" "}
                              <strong className="text-white/60 capitalize">
                                {detail.category.replace(/-/g, " ")}
                              </strong>
                            </span>
                          )}
                        </div>

                        {/* Berry-specific data */}
                        {berry && (
                          <div className="p-2.5 rounded-lg bg-green-500/5 border border-green-500/10">
                            <p className="text-[11px] font-semibold text-green-400/80 uppercase tracking-wider mb-2">
                              Berry Data
                            </p>
                            <div className="flex flex-wrap gap-x-4 gap-y-1">
                              <span className="text-[11px] text-white/40">
                                Natural Gift:{" "}
                                <strong className="text-white/65 capitalize">
                                  {berry.natural_gift_type.name}
                                </strong>
                              </span>
                              <span className="text-[11px] text-white/40">
                                Gift Power:{" "}
                                <strong className="text-white/65">
                                  {berry.natural_gift_power}
                                </strong>
                              </span>
                              <span className="text-[11px] text-white/40">
                                Growth:{" "}
                                <strong className="text-white/65">
                                  {berry.growth_time}h
                                </strong>
                              </span>
                              <span className="text-[11px] text-white/40">
                                Firmness:{" "}
                                <strong className="text-white/65 capitalize">
                                  {berry.firmness.name}
                                </strong>
                              </span>
                            </div>
                            {berry.flavors.filter((f) => f.potency > 0)
                              .length > 0 && (
                              <div className="flex gap-1.5 mt-2 flex-wrap">
                                {berry.flavors
                                  .filter((f) => f.potency > 0)
                                  .map((f) => (
                                    <span
                                      key={f.flavor.name}
                                      className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/50 capitalize"
                                    >
                                      {f.flavor.name}: {f.potency}
                                    </span>
                                  ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Helper ──
function parseItemDetail(d: Record<string, unknown>): ItemFull {
  const entries = d.effect_entries as
    | { language: { name: string }; short_effect: string }[]
    | undefined;
  const flavors = d.flavor_text_entries as
    | { language: { name: string }; text: string }[]
    | undefined;
  const desc =
    entries?.find((e) => e.language.name === "en")?.short_effect ||
    flavors?.find((e) => e.language.name === "en")?.text ||
    "No description available.";
  const sprites = d.sprites as { default: string | null } | undefined;
  const category = d.category as { name: string } | undefined;
  return {
    name: d.name as string,
    sprite: sprites?.default || null,
    description: desc,
    category: category?.name || "",
    cost: (d.cost as number) || 0,
    fling_power: (d.fling_power as number) || null,
  };
}
