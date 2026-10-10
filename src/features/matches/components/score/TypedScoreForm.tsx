import React from "react";
// The components' own files, not the src/ui barrel: the barrel pulls in react-router-dom, which Jest can't resolve.
import { Button } from "../../../../ui/Button";
import { Icon } from "../../../../ui/Icon";
import Drawer from "../../../shared/components/Drawer";
import { Match } from "../../types/match";
import { featuredPlayers } from "./players";
import { ScoreState } from "./useScoreState";
import "./score.scss";

interface TypedScoreFormProps {
  isOpen: boolean;
  match: Match | null;
  score: ScoreState;
  /** The final save is on its way. */
  loading: boolean;
}

/**
 * Typed entry: today's per-set inputs in the responsive sheet (a bottom sheet on phones, the right-hand panel from
 * 768 px). Americano/Mexicano open here, and a typed points total fills in the other side. "Scoreboard" switches to
 * the big +1 view; Save Scores asks first, as the scoreboard's Finish match does.
 */
const TypedScoreForm: React.FC<TypedScoreFormProps> = ({ isOpen, match, score, loading }) => {
  const { gameScores, isUnauthorized, errors } = score;
  const completedSets = score.playedGames.length;

  // Escape while the confirm prompt is up backs out of the prompt only, as a tap beside it does.
  const closeDrawer = score.showConfirmation ? score.cancelConfirm : score.close;

  const teamCard = (side: "home" | "away") => {
    const players = match ? featuredPlayers(side === "home" ? match.homeTeamMembers : match.awayTeamMembers) : "";
    return (
      <div className={`score-typed__team score-typed__team--${side}`}>
        <b className="score-typed__name">{side === "home" ? score.homeName : score.awayName}</b>
        {players ? <small className="score-typed__players">{players}</small> : null}
      </div>
    );
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={closeDrawer}
      title="Enter Match Scores"
      subtitle={
        match ? (
          <span className="score-typed__format">
            <span>{score.formatLabel}</span>
            {!score.isBestOfOne ? (
              <span>
                {completedSets} of {score.bestOf} sets completed
              </span>
            ) : null}
          </span>
        ) : null
      }
      headerAction={
        match ? (
          <button
            type="button"
            className="drawer__link score-typed__to-board"
            onClick={score.showScoreboard}
            disabled={isUnauthorized}
          >
            Scoreboard
          </button>
        ) : null
      }
      size="md"
      className="score-typed"
      footer={
        <div className="score-typed__actions">
          <Button variant="ghost" size="lg" onClick={score.close} disabled={loading}>
            Cancel
          </Button>
          <Button size="lg" onClick={score.submit} loading={loading} disabled={isUnauthorized}>
            Save Scores
          </Button>
        </div>
      }
    >
      {match ? (
        <>
          <div className="score-typed__teams">
            {teamCard("home")}
            <span className="score-typed__vs" aria-hidden="true">
              vs
            </span>
            {teamCard("away")}
          </div>

          <ol className="score-typed__sets">
            {gameScores.map((set) => (
              <li key={set.gameNumber} className="score-typed__set">
                <span className="score-typed__label">Set {set.gameNumber}</span>
                <div className="score-typed__inputs">
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={set.homeScore === 0 ? "" : set.homeScore}
                    onChange={(event) => score.typeScore(set.gameNumber, "homeScore", event.target.value)}
                    onFocus={(event) => event.currentTarget.select()}
                    className={`score-typed__input score-typed__input--home${
                      set.homeScore > set.awayScore ? " score-typed__input--leading" : ""
                    }`}
                    placeholder="0"
                    aria-label={`${score.homeName}, set ${set.gameNumber}`}
                    disabled={isUnauthorized}
                  />
                  <span className="score-typed__dash" aria-hidden="true">
                    –
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={set.awayScore === 0 ? "" : set.awayScore}
                    onChange={(event) => score.typeScore(set.gameNumber, "awayScore", event.target.value)}
                    onFocus={(event) => event.currentTarget.select()}
                    className={`score-typed__input score-typed__input--away${
                      set.awayScore > set.homeScore ? " score-typed__input--leading" : ""
                    }`}
                    placeholder="0"
                    aria-label={`${score.awayName}, set ${set.gameNumber}`}
                    disabled={isUnauthorized}
                  />
                </div>
                {!score.isBestOfOne && gameScores.length > 1 ? (
                  <button
                    type="button"
                    className="score-typed__remove"
                    onClick={() => score.removeSet(set.gameNumber)}
                    aria-label={`Remove set ${set.gameNumber}`}
                    title="Remove set"
                    disabled={isUnauthorized}
                  >
                    <Icon name="close" size={16} />
                  </button>
                ) : null}
              </li>
            ))}
          </ol>

          {score.canAddSet ? (
            <Button variant="tint" block icon="plus" onClick={score.addSet} disabled={isUnauthorized}>
              Add another set
            </Button>
          ) : null}

          {errors.length > 0 ? (
            <div className={`score-typed__errors${isUnauthorized ? " score-typed__errors--link" : ""}`} role="alert">
              {errors.map((error) => (
                <p key={error} className="score-typed__error">
                  {error}
                </p>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </Drawer>
  );
};

export default TypedScoreForm;
