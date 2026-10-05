"use client";

import { useState } from "react";
import { AMENITY_ICONS } from "./amenity-icons";
import { useL } from "./LangProvider";
import type { Amenity } from "@/lib/property";

const VISIBLE = 9;

export function AllAmenities({ items }: { items: Amenity[] }) {
  const { lang, l } = useL();
  const [open, setOpen] = useState(false);
  const shown = open ? items : items.slice(0, VISIBLE);
  return (
    <div className="all-amenities">
      <h3 className="all-amenities-title">{l("Everything in the house", "Todo lo que hay en la casa")}</h3>
      <ul id="all-amenities-list">
        {shown.map((a) => {
          const Icon = AMENITY_ICONS[a.icon];
          const detail = lang === "es" ? a.detailEs : a.detail;
          return (
            <li key={a.title}>
              <Icon size={20} strokeWidth={1.6} aria-hidden="true" />
              <span>
                {lang === "es" ? a.titleEs : a.title}
                {detail && <small>{detail}</small>}
              </span>
            </li>
          );
        })}
      </ul>
      {items.length > VISIBLE && (
        <button
          type="button"
          className="more-reviews"
          aria-expanded={open}
          aria-controls="all-amenities-list"
          onClick={() => setOpen(!open)}
        >
          {open ? l("Show fewer", "Ver menos") : l(`Show all ${items.length} amenities`, `Ver las ${items.length} comodidades`)}
        </button>
      )}
    </div>
  );
}
