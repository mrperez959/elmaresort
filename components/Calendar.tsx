"use client";

import type { PublicDay } from "@/lib/types";
import { a11yDate, monthLabel, moneyShort } from "@/lib/format";
import { useL } from "./LangProvider";

const WEEKDAYS = { en: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"], es: ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"] };

type Props = {
  year: number;
  month: number; // 0-11
  dayMap: Map<string, PublicDay>;
  today: string;
  checkIn: string | null;
  checkOut: string | null;
  isSelectable: (date: string) => boolean;
  onSelect: (date: string) => void;
};

function iso(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}

export function Month({ year, month, dayMap, today, checkIn, checkOut, isSelectable, onSelect }: Props) {
  const { lang, l } = useL();
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const cells: Array<string | null> = Array.from({ length: firstWeekday }, () => null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(iso(year, month, d));

  return (
    <div className="month">
      <h3 className="month-name">{monthLabel(year, month, lang)}</h3>
      <div className="grid" role="grid" aria-label={monthLabel(year, month, lang)}>
        {WEEKDAYS[lang].map((w) => (
          <div key={w} className="weekday" aria-hidden="true">
            {w}
          </div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={`blank-${i}`} className="cell blank" />;
          const day = dayMap.get(date);
          const past = date < today;
          const booked = !past && (!day || !day.available);
          const selectable = !past && isSelectable(date);
          const isStart = date === checkIn;
          const isEnd = date === checkOut;
          const inRange = Boolean(checkIn && checkOut && date > checkIn && date < checkOut);

          const classes = [
            "cell",
            past && "past",
            booked && "booked",
            inRange && "in-range",
            isStart && "start",
            isEnd && "end",
            !selectable && "muted",
          ]
            .filter(Boolean)
            .join(" ");

          const status = past ? l("past", "pasado") : booked ? l("booked", "reservado") : day ? moneyShort(day.price) : "";
          return (
            <button
              key={date}
              type="button"
              className={classes}
              disabled={!selectable}
              aria-pressed={isStart || isEnd || inRange}
              aria-label={`${a11yDate(date, lang)}, ${status}${isStart ? l(", check-in", ", llegada") : ""}${isEnd ? l(", check-out", ", salida") : ""}`}
              onClick={() => onSelect(date)}
            >
              <span className="num">{Number(date.slice(8))}</span>
              {!past && day?.available && (
                <span className={`price${day.regular ? " deal" : ""}`} title={day.regular ? `${moneyShort(day.regular)} → ${moneyShort(day.price)}` : undefined}>
                  {moneyShort(day.price)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
