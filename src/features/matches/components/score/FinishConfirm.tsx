import React, { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
// The components' own files, not the src/ui barrel: the barrel pulls in react-router-dom, which Jest can't resolve.
import { Button } from "../../../../ui/Button";
import { Match, MatchGameScore } from "../../types/match";
import { playersLine } from "../../utils/matchDisplay";

interface FinishConfirmProps {
  match: Match;
  homeName: string;
  awayName: string;
  /** The sets that will be saved (the played ones). */
  sets: MatchGameScore[];
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
  /**
   * Rendered in place, inside the scoreboard, so it turns with it when the scoreboard is sideways. Otherwise it is
   * portalled beside the typed-entry drawer, never inside it: inside, it would be part of the drawer's last frame and
   * ride out on the slide-out after every save.
   */
  inline?: boolean;
}

/**
 * The confirmation before the final save (mockup: Finish match → teams, players and the set summary). Save takes the
 * focus when it opens and hands it back when it goes; Escape and a tap beside it back out.
 */
const FinishConfirm: React.FC<FinishConfirmProps> = ({
  match,
  homeName,
  awayName,
  sets,
  saving,
  onCancel,
  onSave,
  inline = false,
}) => {
  const titleId = useId();
  const textId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    sheetRef.current?.querySelector<HTMLButtonElement>(".score-confirm__save")?.focus();
    return () => {
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  const row = (side: "home" | "away") => {
    const players = playersLine(side === "home" ? match.homeTeamMembers : match.awayTeamMembers);
    return (
      <tr className={`score-confirm__team score-confirm__team--${side}`}>
        <th scope="row" className="score-confirm__who">
          <b className="score-confirm__name">{side === "home" ? homeName : awayName}</b>
          {players ? <small className="score-confirm__players">{players}</small> : null}
        </th>
        {sets.map((set) => (
          <td key={set.gameNumber} className="score-confirm__score">
            {side === "home" ? set.homeScore : set.awayScore}
          </td>
        ))}
      </tr>
    );
  };

  const prompt = (
    <div className={`score-confirm${inline ? " score-confirm--inline" : ""}`}>
      <div className="score-confirm__scrim" aria-hidden="true" onClick={onCancel} />
      <div
        ref={sheetRef}
        className="score-confirm__sheet"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={textId}
      >
        <div className="score-confirm__handle" aria-hidden="true" />
        <h2 id={titleId} className="score-confirm__title">
          Confirm Save
        </h2>
        <p id={textId} className="score-confirm__text">
          Are you sure you want to save these scores?
        </p>
        <table className="score-confirm__table">
          <thead>
            <tr>
              <th scope="col">
                <span className="ui-visually-hidden">Team</span>
              </th>
              {sets.map((set) => (
                <th key={set.gameNumber} scope="col" className="score-confirm__set">
                  Set {set.gameNumber}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {row("home")}
            {row("away")}
          </tbody>
        </table>
        <div className="score-confirm__actions">
          <Button variant="ghost" size="lg" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="lg" className="score-confirm__save" loading={saving} onClick={onSave}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );

  return inline ? prompt : createPortal(prompt, document.body);
};

export default FinishConfirm;
