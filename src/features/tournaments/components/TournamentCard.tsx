import React from "react";
import { useNavigate } from "react-router-dom";
import { Tournament } from "../types";
import { Icon, Tag } from "../../../ui";
import type { TagTone } from "../../../ui";
import "./TournamentCard.scss";

interface TournamentCardProps {
  tournament: Tournament;
  onSelect?: (tournament: Tournament) => void;
  showActions?: boolean;
}

type SportAccent = "beach" | "padel" | "other";

/** Beach volleyball is yellow, padel blue, everything else orange (the brand's sport accents). */
const sportAccent = (sport?: string): SportAccent => {
  const name = (sport || "").toLowerCase();
  if (name.includes("beach")) return "beach";
  if (name.includes("padel")) return "padel";
  return "other";
};

const SPORT_TAG: Record<SportAccent, TagTone> = { beach: "yellow", padel: "blue", other: "orange" };

const MONTH = (date: Date) => date.toLocaleDateString("en-US", { month: "short" });

/** "11 – 13 Oct", "30 Sep – 2 Oct", "12 Oct"; the year only when it isn't this year. */
const formatDateRange = (startDate: string, endDate: string): string => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime())) return "";
  const thisYear = new Date().getFullYear();
  const year = (date: Date) => (date.getFullYear() !== thisYear ? ` ${date.getFullYear()}` : "");
  const day = (date: Date) => `${date.getDate()} ${MONTH(date)}`;

  if (Number.isNaN(end.getTime()) || end.toDateString() === start.toDateString()) return `${day(start)}${year(start)}`;
  if (start.getFullYear() !== end.getFullYear()) return `${day(start)} ${start.getFullYear()} – ${day(end)} ${end.getFullYear()}`;
  if (start.getMonth() === end.getMonth()) return `${start.getDate()} – ${day(end)}${year(end)}`;
  return `${day(start)} – ${day(end)}${year(end)}`;
};

/** The calendar day of a date, as a day number (time of day and DST don't matter). */
const dayNumber = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;

/** How many days it runs, both ends counted (mockup: "11 – 13 Oct · 3 days", "12 Oct · 1 day"). */
const calculateDuration = (startDate: string, endDate: string) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffDays = Number.isNaN(end.getTime()) ? 1 : Math.abs(dayNumber(end) - dayNumber(start)) + 1;

  if (diffDays === 1) {
    return "1 day";
  } else if (diffDays < 7) {
    return `${diffDays} days`;
  } else {
    const weeks = Math.floor(diffDays / 7);
    const remainingDays = diffDays % 7;
    if (remainingDays === 0) {
      return weeks === 1 ? "1 week" : `${weeks} weeks`;
    } else {
      return `${weeks}w ${remainingDays}d`;
    }
  }
};

/**
 * A tournament on the home page (mockup rest-of-portal.html phone 2 `.tcard`): sport stripe, Live and sport tags,
 * name, dates, up to two categories (each opens the matches filtered by it) and a chevron. The whole card opens it.
 */
const TournamentCard: React.FC<TournamentCardProps> = ({ tournament, onSelect }) => {
  const navigate = useNavigate();

  const handleSelect = () => {
    if (onSelect) {
      onSelect(tournament);
    }
  };

  const handleCategoryClick = (e: React.MouseEvent, category: string) => {
    e.stopPropagation();
    // Navigate to tournament matches page filtered by the clicked category
    const params = new URLSearchParams();
    params.set("name", tournament.name || "Tournament");
    params.set("category", category);
    navigate(`/tournaments/${tournament.id}/matches?${params.toString()}`);
  };

  const sport = tournament.sport || tournament.type;
  const accent = sportAccent(sport);
  const categories = tournament.categories || [];
  const dates = formatDateRange(tournament.startDate, tournament.endDate);

  return (
    <article className={`tournament-card tournament-card--${accent}`}>
      <span className="tournament-card__stripe" aria-hidden="true" />

      {(tournament.status === "active" || sport) && (
        <div className="tournament-card__tags">
          {tournament.status === "active" && <Tag tone="live">Live</Tag>}
          {sport && <Tag tone={SPORT_TAG[accent]}>{sport}</Tag>}
        </div>
      )}

      <h2 className="tournament-card__name">
        <button type="button" className="tournament-card__open" onClick={handleSelect}>
          {tournament.name}
        </button>
      </h2>

      {dates && (
        <p className="tournament-card__meta">
          <Icon name="calendar" size={14} />
          <span>
            {dates} · {calculateDuration(tournament.startDate, tournament.endDate)}
          </span>
        </p>
      )}

      {categories.length > 0 && (
        <div className="tournament-card__cats">
          {categories.slice(0, 2).map((category, index) => (
            <button
              key={index}
              type="button"
              className="tournament-card__cat"
              onClick={(e) => handleCategoryClick(e, category)}
            >
              {category}
            </button>
          ))}
          {categories.length > 2 && (
            <button
              type="button"
              className="tournament-card__cat"
              onClick={(e) => handleCategoryClick(e, categories[2])}
            >
              +{categories.length - 2}
            </button>
          )}
        </div>
      )}

      <Icon name="chevron-right" size={16} className="tournament-card__chevron" />
    </article>
  );
};

export default TournamentCard;
