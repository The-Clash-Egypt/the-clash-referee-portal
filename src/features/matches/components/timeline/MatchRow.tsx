import React from "react";
import { Match, sideDisplayName } from "../../types/match";
import { Icon } from "../../../../ui/Icon";
import { Tag } from "../../../../ui/Tag";
import { courtShort, formatTime, isLive } from "../../utils/timeline";
import { categoryAndRound, liveTagLabel, matchWinner, refereeSummary, scoreCells, ScoreCell } from "../../utils/matchDisplay";
import "./MatchRow.scss";

interface MatchRowProps {
  match: Match;
  /** Tapping the row (opens the match sheet). */
  onOpen: (match: Match) => void;
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
 * One match on the timeline (mockup `.mrow`): court and time on the left; both sides with their set scores (winner
 * bold, loser muted, the set being played red while live); a live tag or "category · round"; who referees it, or an
 * orange "No referee". A red stripe marks a live match. The whole row opens the match sheet.
 */
const MatchRow: React.FC<MatchRowProps> = ({ match, onOpen }) => {
  const live = isLive(match);
  const cells = scoreCells(match);
  const winner = matchWinner(match);
  const referees = refereeSummary(match);
  const detail = categoryAndRound(match);
  const time = formatTime(match.startTime);

  const sideClass = (side: "home" | "away") =>
    `match-row__team${winner === side ? " match-row__team--win" : ""}${winner && winner !== side ? " match-row__team--lose" : ""}`;

  return (
    <button type="button" className={`match-row${live ? " match-row--live" : ""}`} onClick={() => onOpen(match)}>
      {live ? <span className="match-row__stripe" aria-hidden="true" /> : null}
      <span className="match-row__side">
        <span className="match-row__court" title={match.venue || undefined}>
          {courtShort(match.venue)}
        </span>
        <span className="match-row__time">{time || "—"}</span>
      </span>
      <span className="match-row__main">
        <span className={sideClass("home")}>
          <span className="match-row__name">{sideDisplayName(match.homeTeamName, match.homeTeam2Name)}</span>
          <Scores cells={cells} side="home" />
        </span>
        <span className={sideClass("away")}>
          <span className="match-row__name">{sideDisplayName(match.awayTeamName, match.awayTeam2Name)}</span>
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
      <span className="match-row__chev" aria-hidden="true">
        <Icon name="chevron-right" size={14} />
      </span>
    </button>
  );
};

export default MatchRow;
