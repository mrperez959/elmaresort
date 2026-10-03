"use client";

import { useState } from "react";
import { AMENITY_ICONS } from "./amenity-icons";
import type { AmenityIcon } from "@/lib/property";

const VISIBLE = 9;

export function AllAmenities({ items }: { items: Array<{ icon: AmenityIcon; title: string; detail?: string }> }) {
  const [open, setOpen] = useState(false);
  const shown = open ? items : items.slice(0, VISIBLE);
  return (
    <div className="all-amenities">
      <h3 className="all-amenities-title">Everything in the house</h3>
      <ul id="all-amenities-list">
        {shown.map((a) => {
          const Icon = AMENITY_ICONS[a.icon];
          return (
            <li key={a.title}>
              <Icon size={20} strokeWidth={1.6} aria-hidden="true" />
              <span>
                {a.title}
                {a.detail && <small>{a.detail}</small>}
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
          {open ? "Show fewer" : `Show all ${items.length} amenities`}
        </button>
      )}
    </div>
  );
}
