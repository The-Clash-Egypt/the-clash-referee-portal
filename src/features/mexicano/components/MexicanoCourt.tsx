import React from "react";
import { Button } from "../../../ui/Button";
import { Match, sideDisplayName } from "../../matches/types/match";
import { matchWinner, scoreCells } from "../../matches/utils/matchDisplay";
import "./MexicanoCourt.scss";

interface MexicanoCourtProps {
  match: Match;
  /** Shows Score, which opens the score dialog for this court. */
  canScore: boolean;
  onScore: (match: Match) => void;
}

/**
 * One court of a Mexicano round (rest-of-portal.html phone 6: a `.slot` header and an `.mrow`): the court's name, both
 * sides with their points (winner bold, loser muted), a stripe (red while the court is open, green once scored), the
 * referee teams if any, and Score. Styled like the matches timeline rows; the row itself isn't a button because Score
 * sits inside it.
 */
const MexicanoCourt: React.FC<MexicanoCourtProps> = ({ match, canScore, onScore }) => {
  const headingId = `mexicano-court-${match.id}`;
  // Americano/Mexicano: one points game, so one cell (empty until a score is in).
  const points = scoreCells(match)[0];
  const winner = matchWinner(match);
  const refereeTeams = (match.refereeTeams ?? []).map((team) => team.teamName).filter(Boolean);

  const side = (key: "home" | "away", name: string, score?: number) => (
    <div
      className={`mexicano-court__team${winner === key ? " mexicano-court__team--win" : ""}${
        winner && winner !== key ? " mexicano-court__team--lose" : ""
      }`}
    >
      <span className="mexicano-court__team-name">{name}</span>
      {points && <span className={`mexicano-court__points mexicano-court__points--${points.state}`}>{score}</span>}
    </div>
  );

  return (
    <li className="mexicano-court">
      <h2 className="mexicano-court__name" id={headingId}>
        {match.venue || "—"}
      </h2>
      <div className={`mexicano-court__row${match.isCompleted ? " mexicano-court__row--done" : ""}`}>
        <span className="mexicano-court__stripe" aria-hidden="true" />
        <div className="mexicano-court__main">
          {side("home", sideDisplayName(match.homeTeamName, match.homeTeam2Name), points?.home)}
          {side("away", sideDisplayName(match.awayTeamName, match.awayTeam2Name), points?.away)}
          {refereeTeams.length > 0 && (
            <p className="mexicano-court__referees">
              {refereeTeams.length === 1 ? "Referee team" : "Referee teams"}: {refereeTeams.join(", ")}
            </p>
          )}
        </div>
        {canScore && (
          <div className="mexicano-court__act">
            <Button
              size="sm"
              variant={match.isCompleted ? "tint" : "primary"}
              className="mexicano-court__score"
              aria-describedby={headingId}
              onClick={() => onScore(match)}
            >
              Score
            </Button>
          </div>
        )}
      </div>
    </li>
  );
};

export default MexicanoCourt;
