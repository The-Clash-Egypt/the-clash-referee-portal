import React from "react";
import Drawer from "../../../shared/components/Drawer";
import { Button } from "../../../../ui/Button";
import { Icon, IconName } from "../../../../ui/Icon";
import { Tag } from "../../../../ui/Tag";
import { Match, Referee, sideDisplayName } from "../../types/match";
import { formatTime, formatWhen, isLive } from "../../utils/timeline";
import { initials, liveTagLabel, matchWinner, playersLine, scoreCells, ScoreCell, setsWon } from "../../utils/matchDisplay";
import { getMatchDuration } from "../../../../utils/durationUtils";
import "./MatchSheet.scss";

interface MatchSheetProps {
  isOpen: boolean;
  /** The match as the list has it now (it refreshes under the open sheet). */
  match: Match | null;
  onClose: () => void;
  /** Superadmins and referee admins: Referee, QR code, Edit, the referees' WhatsApp and remove, durations. */
  fullAccess: boolean;
  onScore: (match: Match) => void;
  onAssignReferee: (match: Match) => void;
  onShare: (match: Match) => void;
  onShowQR: (match: Match) => void;
  onEdit: (match: Match) => void;
  onShareWithReferee: (match: Match, referee: Referee) => void;
  onUnassignReferee: (refereeId: string, matchId: string) => void | Promise<void>;
  onUnassignTeam: (matchId: string, teamId: string) => void | Promise<void>;
}

const timeOf = (iso?: string) => (iso ? formatTime(iso) : "");

/** A finished points game (or a result without sets) is the result itself; finished sets are quiet. */
const cellLook = (cell: ScoreCell): string =>
  cell.state === "final" && (cell.key === "points" || cell.key === "result") ? "result" : cell.state;

const StatusTag = ({ match }: { match: Match }) => {
  if (isLive(match)) return <Tag tone="live">{liveTagLabel(match)}</Tag>;
  if (match.isCompleted) return <Tag tone="ok">Completed</Tag>;
  return <Tag tone="grey">Upcoming</Tag>;
};

const Tile = ({ icon, label, onClick }: { icon: IconName; label: string; onClick: () => void }) => (
  <button type="button" className="match-sheet__tile" onClick={onClick}>
    <Icon name={icon} size={20} />
    {label}
  </button>
);

/**
 * Everything about one match, opened by tapping its row (mockup match-flow-v2.html phone 2): status and where/when,
 * both sides with their players and scores, a big Score button, then Referee · Share · QR code · Edit and who
 * referees it. A plain referee gets Share, and Score while the match isn't completed.
 */
const MatchSheet: React.FC<MatchSheetProps> = ({
  isOpen,
  match,
  onClose,
  fullAccess,
  onScore,
  onAssignReferee,
  onShare,
  onShowQR,
  onEdit,
  onShareWithReferee,
  onUnassignReferee,
  onUnassignTeam,
}) => {
  if (!match) return <Drawer isOpen={false} onClose={onClose} title="" />;

  const cells = scoreCells(match);
  const winner = matchWinner(match);
  const won = match.isCompleted ? setsWon(match) : null;
  const where = [match.venue, formatWhen(match.startTime), match.categoryName, match.round].filter(Boolean).join(" · ");
  const referees = match.referees ?? [];
  const teams = match.refereeTeams ?? [];
  const duration = fullAccess && match.startedAt && match.endedAt ? getMatchDuration(match) : null;

  const side = (key: "home" | "away") => {
    const name =
      key === "home"
        ? sideDisplayName(match.homeTeamName, match.homeTeam2Name)
        : sideDisplayName(match.awayTeamName, match.awayTeam2Name);
    const players = playersLine(key === "home" ? match.homeTeamMembers : match.awayTeamMembers);
    return (
      <div className={`match-sheet__team${winner && winner !== key ? " match-sheet__team--lose" : ""}`}>
        <div className="match-sheet__who">
          <b className="match-sheet__name">{name}</b>
          {players ? <small className="match-sheet__players">{players}</small> : null}
        </div>
        {cells.length > 0 ? (
          <div className="match-sheet__scores">
            {cells.map((cell) => (
              <span key={cell.key} className={`match-sheet__score match-sheet__score--${cellLook(cell)}`}>
                {cell[key]}
              </span>
            ))}
            {won && cells[0]?.key !== "result" ? (
              <span className="match-sheet__score match-sheet__score--won">{won[key]}</span>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  const tiles: React.ReactNode[] = [
    fullAccess ? <Tile key="referee" icon="person" label="Referee" onClick={() => onAssignReferee(match)} /> : null,
    <Tile key="share" icon="share" label="Share" onClick={() => onShare(match)} />,
    fullAccess ? <Tile key="qr" icon="qr" label="QR code" onClick={() => onShowQR(match)} /> : null,
    fullAccess ? <Tile key="edit" icon="edit" label="Edit" onClick={() => onEdit(match)} /> : null,
  ].filter(Boolean);

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      className="match-sheet"
      title={
        <span className="match-sheet__eyebrow">
          <StatusTag match={match} />
          {where ? <span className="match-sheet__where">{where}</span> : null}
        </span>
      }
    >
      <div className="match-sheet__teams">
        {side("home")}
        {side("away")}
      </div>
      {duration ? (
        <p className="match-sheet__duration">
          Started {timeOf(match.startedAt)} · Ended {timeOf(match.endedAt)} · Duration {duration}
        </p>
      ) : null}

      {!match.isCompleted || fullAccess ? (
        <Button size="lg" block icon="plus" className="match-sheet__score-btn" onClick={() => onScore(match)}>
          Score
        </Button>
      ) : null}

      <div className="match-sheet__tiles" style={{ gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))` }}>
        {tiles}
      </div>

      <section className="match-sheet__people" aria-label="Referees">
        <h3 className="match-sheet__label">Referees</h3>
        {referees.length === 0 && teams.length === 0 ? (
          <p className="match-sheet__none">No referees assigned for this match</p>
        ) : null}
        <ul className="match-sheet__list">
          {referees.map((referee) => (
            <li key={referee.id} className="match-sheet__person">
              <span className="match-sheet__avatar" aria-hidden="true">
                {initials(referee.fullName)}
              </span>
              <span className="match-sheet__person-who">
                {referee.fullName}
                <small>{fullAccess ? referee.phoneNumber || referee.email : referee.email}</small>
              </span>
              {fullAccess && referee.phoneNumber ? (
                <button
                  type="button"
                  className="match-sheet__round match-sheet__round--wa"
                  onClick={() => onShareWithReferee(match, referee)}
                  aria-label={`Share this match with ${referee.fullName} on WhatsApp`}
                  title="Share this match on WhatsApp"
                >
                  <Icon name="whatsapp" size={17} />
                </button>
              ) : null}
              {fullAccess ? (
                <button
                  type="button"
                  className="match-sheet__round"
                  onClick={() => onUnassignReferee(referee.id, match.id)}
                  aria-label={`Unassign ${referee.fullName}`}
                  title="Unassign referee"
                >
                  <Icon name="close" size={17} />
                </button>
              ) : null}
            </li>
          ))}
          {teams.map((team) => (
            <li key={`team-${team.teamId}`} className="match-sheet__person">
              <span className="match-sheet__avatar match-sheet__avatar--team" aria-hidden="true">
                {initials(team.teamName)}
              </span>
              <span className="match-sheet__person-who">
                {team.teamName}
                <small>Referee team</small>
              </span>
              {fullAccess ? (
                <button
                  type="button"
                  className="match-sheet__round"
                  onClick={() => onUnassignTeam(match.id, team.teamId)}
                  aria-label={`Unassign ${team.teamName}`}
                  title="Unassign referee team"
                >
                  <Icon name="close" size={17} />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </Drawer>
  );
};

export default MatchSheet;
