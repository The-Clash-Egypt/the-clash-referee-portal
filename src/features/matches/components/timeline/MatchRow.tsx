import React from "react";
import { Match, sideDisplayName } from "../../types/match";
import { Checkbox } from "../../../../ui/Checkbox";
import { Icon } from "../../../../ui/Icon";
import { Tag } from "../../../../ui/Tag";
import { useLongPress } from "../../hooks/useLongPress";
import { courtName, formatTime, isLive } from "../../utils/timeline";
import { categoryAndRound, liveTagLabel, matchWinner, refereeSummary, scoreCells, ScoreCell } from "../../utils/matchDisplay";
import "./MatchRow.scss";

interface MatchRowProps {
  match: Match;
  /** Tapping the row (opens the match sheet). */
  onOpen: (match: Match) => void;
  /** Full access: holding the row for 500 ms starts select mode with it. */
  onLongPress?: (match: Match) => void;
  /** Select mode: the row is a checkbox, and tapping it toggles it instead of opening the sheet. */
  selecting?: boolean;
  selected?: boolean;
  onToggle?: (match: Match) => void;
}

const Scores = ({ cells, side }: { cells: ScoreCell[]; side: "home" | "away" }) =>
  cells.length > 0 ? (
    <span className="match-row__sets">
      {cells.map((cell) => (
        <span key={cell.key} className={`match-row__set match-row__set--${cell.state}`}>
          {cell[side]}
        </span>
      ))}
    </span>
  ) : null;

/**
 * One match on the timeline (mockup `.mrow`): the court's name as stored ("Court 2", two lines at most) and the time
 * on the left; both sides with their set scores (winner bold, loser muted, the set being played red while live); a
 * live tag or "category · round"; who referees it, or an orange "No referee". A red stripe marks a live match. The
 * whole row opens the match sheet; in select mode it is a checkbox with a tick on the left (mockup match-flow-v2.html
 * phone 5).
 */
const MatchRow: React.FC<MatchRowProps> = ({
  match,
  onOpen,
  onLongPress,
  selecting = false,
  selected = false,
  onToggle,
}) => {
  const press = useLongPress(onLongPress && !selecting ? () => onLongPress(match) : undefined);
  const live = isLive(match);
  const cells = scoreCells(match);
  const winner = matchWinner(match);
  const referees = refereeSummary(match);
  const detail = categoryAndRound(match);
  const time = formatTime(match.startTime);
  const home = sideDisplayName(match.homeTeamName, match.homeTeam2Name);
  const away = sideDisplayName(match.awayTeamName, match.awayTeam2Name);

  const sideClass = (side: "home" | "away") =>
    `match-row__team${winner === side ? " match-row__team--win" : ""}${winner && winner !== side ? " match-row__team--lose" : ""}`;

  const content = (
    <>
      {live ? <span className="match-row__stripe" aria-hidden="true" /> : null}
      <span className="match-row__side">
        <span className="match-row__court" title={match.venue?.trim() || undefined}>
          {courtName(match.venue)}
        </span>
        <span className="match-row__time">{time || "—"}</span>
      </span>
      <span className="match-row__main">
        <span className={sideClass("home")}>
          <span className="match-row__name">{home}</span>
          <Scores cells={cells} side="home" />
        </span>
        <span className={sideClass("away")}>
          <span className="match-row__name">{away}</span>
          <Scores cells={cells} side="away" />
        </span>
        <span className="match-row__bot">
          {live ? (
            <Tag tone="live" className="match-row__tag">
              {liveTagLabel(match)}
            </Tag>
          ) : detail ? (
            <Tag tone="grey" className="match-row__tag">
              <span className="match-row__tag-text">{detail}</span>
            </Tag>
          ) : (
            <span />
          )}
          {referees.length > 0 ? (
            <span className="match-row__ref">
              <span className="ui-visually-hidden">Referee: </span>
              {referees.join(", ")}
            </span>
          ) : (
            <span className="match-row__ref match-row__ref--none">No referee</span>
          )}
        </span>
      </span>
    </>
  );

  if (selecting) {
    return (
      <Checkbox
        className={`match-row match-row--select${selected ? " match-row--selected" : ""}${live ? " match-row--live" : ""}`}
        checked={selected}
        onChange={() => onToggle?.(match)}
        label={[`${home} vs ${away}`, match.venue, time].filter(Boolean).join(", ")}
      >
        {content}
      </Checkbox>
    );
  }

  return (
    <button
      type="button"
      className={`match-row${live ? " match-row--live" : ""}${onLongPress ? " match-row--pressable" : ""}`}
      onClick={() => onOpen(match)}
      {...press}
    >
      {content}
      <span className="match-row__chev" aria-hidden="true">
        <Icon name="chevron-right" size={14} />
      </span>
    </button>
  );
};

export default MatchRow;
