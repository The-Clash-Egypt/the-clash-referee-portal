import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
// The components' own files, not the src/ui barrel: the barrel pulls in react-router-dom, which Jest can't resolve.
import { Button } from "../../../../ui/Button";
import { Icon, IconName } from "../../../../ui/Icon";
import { Tag } from "../../../../ui/Tag";
import { Match } from "../../types/match";
import { lockPageScroll, takeFocus } from "../../../shared/layers";
import FinishConfirm from "./FinishConfirm";
import { featuredPlayers } from "./players";
import { useForcedLandscape } from "./useForcedLandscape";
import { LIVE_SCORE_FAILED, ScoreState, Side } from "./useScoreState";
import "./score.scss";

interface ScoreboardViewProps {
  match: Match;
  score: ScoreState;
  /** The final save is on its way. */
  loading: boolean;
}

/** "Won set 1", "Won sets 1, 3" */
const wonLabel = (sets: number[]): string | null =>
  sets.length === 0 ? null : `Won ${sets.length === 1 ? "set" : "sets"} ${sets.join(", ")}`;

const IconButton = ({
  icon,
  label,
  onClick,
  pressed,
  className,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  pressed?: boolean;
  className?: string;
}) => (
  <button
    type="button"
    className={["sb-ib", pressed ? "sb-ib--on" : "", className].filter(Boolean).join(" ")}
    onClick={onClick}
    aria-label={label}
    aria-pressed={pressed}
    title={label}
  >
    <Icon name={icon} size={18} />
  </button>
);

/**
 * The scoreboard (mockups scoreboard-landscape-v2.html and match-flow-v2.html phone 3): upright on a portrait phone —
 * the teams one above the other — and sideways when the phone is turned, when ⟳ forces it (rotation lock), or on a
 * desktop (a centred full-screen overlay). Every +1 / − updates the live score; Finish match confirms and saves.
 */
const ScoreboardView: React.FC<ScoreboardViewProps> = ({ match, score, loading }) => {
  const { forced, toggle, viewportPortrait, rotate } = useForcedLandscape();
  const sideways = !viewportPortrait || forced;
  const rootRef = useRef<HTMLDivElement>(null);

  // On screen it holds the page still and takes the focus, and gives both back when it goes. Both are shared with the
  // sheets (shared/layers): the match sheet whose Score button opened the board is still sliding out as it opens, and a
  // sheet can be open under it. The page scrolls again only once neither holds it.
  useEffect(() => {
    const releaseScroll = lockPageScroll();
    const releaseFocus = takeFocus(rootRef.current);
    return () => {
      releaseScroll();
      releaseFocus();
    };
  }, []);

  // Escape leaves the scoreboard, as the back arrow does (the confirm prompt handles its own Escape).
  const { showConfirmation, leaveScoreboard } = score;
  useEffect(() => {
    if (showConfirmation) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") leaveScoreboard();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showConfirmation, leaveScoreboard]);

  const title = [match.venue, match.round].filter(Boolean).join(" · ") || match.categoryName || "Scoreboard";
  const order: Side[] = score.sidesSwapped ? ["away", "home"] : ["home", "away"];
  const game = score.currentGame;
  const pointsOf = (side: Side) => (side === "home" ? game.homeScore : game.awayScore);
  const nameOf = (side: Side) => (side === "home" ? score.homeName : score.awayName);
  // A refused live update shows in the status line; the list is for why a save was refused.
  const errors = score.errors.filter((error) => error !== LIVE_SCORE_FAILED);
  const showSetTabs = score.gameScores.length > 1 || score.canAddSet;

  const back = <IconButton icon="back" label="Back" onClick={score.leaveScoreboard} />;
  const typeToggle = <IconButton icon="keyboard" label="Type scores" onClick={score.showTyped} />;
  const swap = (
    <IconButton
      icon="swap"
      label="Switch sides"
      onClick={score.swapSides}
      className={sideways ? undefined : "sb-ib--vertical"}
    />
  );

  const heading = (
    <div className="sb-title">
      <b className="sb-title__main">{title}</b>
      <small className="sb-title__sub">{score.formatLabel}</small>
    </div>
  );

  const setTabs = showSetTabs ? (
    <div className="sb-sets">
      {score.gameScores.map((set, index) => {
        const [first, second] = order.map((side) => (side === "home" ? set.homeScore : set.awayScore));
        const active = index === score.selectedSetIndex;
        return (
          <button
            key={set.gameNumber}
            type="button"
            className={`sb-sets__tab${active ? " sb-sets__tab--on" : ""}`}
            onClick={() => score.selectSet(index)}
            aria-current={active ? "true" : undefined}
          >
            <span className="sb-sets__label">Set {set.gameNumber}</span>{" "}
            <b className="sb-sets__score">{first > 0 || second > 0 ? `${first}–${second}` : "–"}</b>
          </button>
        );
      })}
      {score.canAddSet ? (
        <button
          type="button"
          className="sb-sets__add"
          onClick={score.addSet}
          aria-label={`Add set ${score.gameScores.length + 1}`}
          title={`Add set ${score.gameScores.length + 1}`}
        >
          <Icon name="plus" size={18} />
        </button>
      ) : null}
    </div>
  ) : null;

  const reminder =
    score.switchReminder !== null ? (
      <div className="sb-remind" role="status">
        <Icon name="swap" size={16} />
        <span className="sb-remind__text">Switch sides: {score.switchReminder} points played</span>
        <button type="button" className="sb-remind__done" onClick={score.dismissReminder}>
          Done
        </button>
      </div>
    ) : null;

  const live =
    score.liveStatus === "saved" ? (
      <p className="sb-live sb-live--saved" role="status">
        Live score saved
      </p>
    ) : score.liveStatus === "failed" ? (
      <p className="sb-live sb-live--failed" role="status">
        Couldn't save the live score
      </p>
    ) : (
      <p className="sb-live" aria-hidden="true" />
    );

  const errorList =
    errors.length > 0 ? (
      <div className="sb-errors" role="alert">
        {errors.map((error) => (
          <p key={error} className="sb-errors__line">
            {error}
          </p>
        ))}
      </div>
    ) : null;

  const finish = (
    <Button
      size={sideways ? "md" : "lg"}
      block={!sideways}
      className="sb-finish"
      onClick={score.submit}
      disabled={loading}
    >
      Finish match
    </Button>
  );

  const team = (side: Side) => {
    const name = nameOf(side);
    const points = pointsOf(side);
    const players = featuredPlayers(side === "home" ? match.homeTeamMembers : match.awayTeamMembers, { short: true });
    const won = wonLabel(score.setsWonBy(side));
    return (
      <section key={side} className={`sb-team sb-team--${side}`} aria-label={name}>
        <span className="sb-team__bar" aria-hidden="true" />
        <div className="sb-team__who">
          <b className="sb-team__name" title={name}>
            {name}
          </b>
          {players ? <small className="sb-team__players">{players}</small> : null}
          {won ? (
            <Tag tone="grey" className="sb-team__won">
              {won}
            </Tag>
          ) : null}
        </div>
        <span className="sb-team__score">{points}</span>
        <div className="sb-team__controls">
          <button
            type="button"
            className="sb-team__plus"
            onClick={() => score.addPoint(side)}
            aria-label={`Add point to ${name}`}
          >
            +1
          </button>
          <button
            type="button"
            className="sb-team__minus"
            onClick={() => score.removePoint(side)}
            disabled={points === 0}
            aria-label={`Remove point from ${name}`}
          >
            −
          </button>
        </div>
      </section>
    );
  };

  const classes = [
    "score-board",
    sideways ? "score-board--sideways" : "score-board--upright",
    rotate ? "is-rotated" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return createPortal(
    <div ref={rootRef} className={classes} role="dialog" aria-modal="true" aria-label="Scoreboard" tabIndex={-1}>
      <div className="score-board__frame">
        {sideways ? (
          <>
            <header className="sb-strip">
              {back}
              {heading}
              {setTabs}
              <div className="sb-strip__tools">
                {typeToggle}
                {forced ? <IconButton icon="upright" label="Upright" onClick={toggle} /> : null}
                {swap}
                {finish}
              </div>
            </header>
            <div className="sb-main">{order.map(team)}</div>
            <footer className="sb-bottom">
              {reminder}
              {errorList}
              {live}
            </footer>
          </>
        ) : (
          <>
            <header className="sb-head">
              {back}
              {heading}
              {typeToggle}
              <IconButton icon="rotate" label="Landscape" onClick={toggle} pressed={forced} />
              {swap}
            </header>
            {setTabs}
            {reminder}
            <div className="sb-main">{order.map(team)}</div>
            <footer className="sb-foot">
              {errorList}
              {live}
              {finish}
            </footer>
          </>
        )}
      </div>
      {score.showConfirmation ? (
        <FinishConfirm
          inline
          match={match}
          homeName={score.homeName}
          awayName={score.awayName}
          sets={score.playedGames}
          saving={loading}
          onCancel={score.cancelConfirm}
          onSave={score.confirmSave}
        />
      ) : null}
    </div>,
    document.body
  );
};

export default ScoreboardView;
