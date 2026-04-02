"use client";

import { useState, useEffect } from "react";

interface ItemData {
  name: string;
  sprite: string | null;
  description: string;
  category: string;
  isBerry: boolean;
}

interface HeldItemProp {
  item: { name: string; url: string };
  version_details: { rarity: number; version: { name: string } }[];
}

interface Props {
  heldItems: HeldItemProp[];
}

export default function PokemonItems({ heldItems }: Props) {
  const [items, setItems] = useState<ItemData[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (heldItems.length === 0) {
      setLoaded(true);
      return;
    }
    setLoaded(false);
    Promise.allSettled(
      heldItems.map((hi) => fetch(hi.item.url).then((r) => r.json()))
    ).then((results) => {
      const loaded: ItemData[] = [];
      results.forEach((r) => {
        if (r.status !== "fulfilled") return;
        const d = r.value;
        const desc =
          d.effect_entries?.find(
            (e: { language: { name: string }; short_effect: string }) =>
              e.language.name === "en"
          )?.short_effect ||
          d.flavor_text_entries?.find(
            (e: { language: { name: string }; text: string }) =>
              e.language.name === "en"
          )?.text ||
          "No description available.";
        const isBerry =
          d.category?.name?.includes("berry") ||
          (d.name as string).endsWith("-berry");
        loaded.push({
          name: d.name,
          sprite: d.sprites?.default || null,
          description: desc,
          category: d.category?.name || "",
          isBerry,
        });
      });
      setItems(loaded);
      setLoaded(true);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heldItems.map((h) => h.item.name).join(",")]);

  if (heldItems.length === 0) return null;

  return (
    <div className="rounded-2xl border border-white/5 bg-[#111120] p-5">
      <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4">
        Held Items
      </h3>
      {!loaded ? (
        <div className="space-y-3">
          {heldItems.map((hi) => (
            <div key={hi.item.name} className="h-16 skeleton rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.name}
              className={`flex gap-3 p-3 rounded-xl border ${
                item.isBerry
                  ? "bg-green-500/5 border-green-500/15"
                  : "bg-white/3 border-white/5"
              }`}
            >
              <div className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg bg-white/5">
                {item.sprite ? (
                  <img
                    src={item.sprite}
                    alt={item.name}
                    className="w-8 h-8 object-contain"
                    style={{ imageRendering: "pixelated" }}
                  />
                ) : (
                  <span className="text-xl">{item.isBerry ? "🍓" : "🎒"}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <p className="text-sm font-semibold text-white/80 capitalize">
                    {item.name.replace(/-/g, " ")}
                  </p>
                  {item.isBerry && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 border border-green-500/20 font-bold uppercase">
                      Berry
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/45 leading-relaxed">{item.description}</p>
                {item.version_details && (
                  <p className="text-[10px] text-white/20 mt-1">
                    Found in:{" "}
                    {[...new Set(
                      (heldItems.find((h) => h.item.name === item.name)?.version_details ?? [])
                        .map((v) => v.version.name)
                    )]
                      .slice(0, 3)
                      .join(", ")}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}