import React, { useCallback, useEffect, useRef, useState } from "react";
import MatchCard from "../../shared/components/MatchCard";
import UpdateScoreDialog from "../../matches/components/UpdateScoreDialog";
import { UnknownMatchFormatError, updateMatchByFormat } from "../../matches/api/matches";
import { Match, MatchGameScore } from "../../matches/types/match";
import VolleyballLoading from "../../../components/VolleyballLoading";
import {
  finishMexicano,
  getMexicanoSession,
  mexicanoErrorMessage,
  startNextMexicanoRound,
  undoMexicanoRound,
  updateMexicanoPlayers,
} from "../api/mexicano";
import { roundLabel, statusLine } from "../sessionText";
import { MexicanoSession, MexicanoStatus } from "../types";
import "./MexicanoRunner.scss";

type Tab = "round" | "players" | "leaderboard";

interface MexicanoRunnerProps {
  formatId: string;
  /** Organizer controls (the MexicanoRunPolicy roles). Everyone else only enters scores. */
  canRun: boolean;
  onBack: () => void;
  /** How often to re-read the session while the page is visible; 0 turns polling off. */
  pollMs?: number;
}

const STATUS_OPTIONS: { status: MexicanoStatus; label: string }[] = [
  { status: MexicanoStatus.NotHere, label: "Not here" },
  { status: MexicanoStatus.Playing, label: "Playing" },
  { status: MexicanoStatus.SitOut, label: "Sit out" },
];

type StatusUpdate = { teamId: string; status: MexicanoStatus };

/**
 * One Mexicano stage, run live (spec 2026-09-29 §4): check players in, start / undo / finish
 * rounds, and enter each court's score. Router-free so it can be tested on its own.
 */
const MexicanoRunner: React.FC<MexicanoRunnerProps> = ({ formatId, canRun, onBack, pollMs = 15000 }) => {
  const [session, setSession] = useState<MexicanoSession | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab | null>(null); // null = the default for where the event is
  const [viewedRound, setViewedRound] = useState<number | null>(null); // null = follow the current round
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [scoreMatch, setScoreMatch] = useState<Match | null>(null);
  const [savingScore, setSavingScore] = useState(false);
  // A save or action in flight: polling must not overwrite its optimistic state.
  const pending = useRef(0);
  const saveSeq = useRef(0);

  const refresh = useCallback(async () => {
    try {
      setSession(await getMexicanoSession(formatId));
      setLoadError(null);
    } catch (error) {
      setLoadError(mexicanoErrorMessage(error, "Couldn't load this Mexicano stage."));
    }
  }, [formatId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Scores come in from several courts: keep the page current while it's on screen.
  useEffect(() => {
    if (!pollMs) return;
    const tick = () => {
      if (document.visibilityState === "visible" && pending.current === 0) refresh();
    };
    const interval = window.setInterval(tick, pollMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [pollMs, refresh]);

  const runAction = async (action: () => Promise<MexicanoSession>, fallback: string, after?: () => void) => {
    pending.current += 1;
    setBusy(true);
    try {
      setSession(await action());
      after?.();
    } catch (error) {
      window.alert(mexicanoErrorMessage(error, fallback));
      await refresh();
    } finally {
      pending.current -= 1;
      setBusy(false);
    }
  };

  /** Optimistic: the toggle moves at once and moves back if the server refuses. */
  const saveStatuses = async (updates: StatusUpdate[]) => {
    if (!session || updates.length === 0) return;
    const previous = new Map(session.players.map((p) => [p.teamId, p.status]));
    const apply = (changes: Map<string, MexicanoStatus>) =>
      setSession((current) =>
        current && {
          ...current,
          players: current.players.map((p) => (changes.has(p.teamId) ? { ...p, status: changes.get(p.teamId)! } : p)),
        }
      );

    apply(new Map(updates.map((u) => [u.teamId, u.status])));
    const seq = ++saveSeq.current;
    pending.current += 1;
    try {
      const next = await updateMexicanoPlayers(formatId, updates);
      if (seq === saveSeq.current) setSession(next); // a later tap's answer wins
    } catch (error) {
      apply(new Map(updates.map((u) => [u.teamId, previous.get(u.teamId)!])));
      window.alert(mexicanoErrorMessage(error, "Couldn't save that change."));
    } finally {
      pending.current -= 1;
    }
  };

  const startRound = () =>
    runAction(() => startNextMexicanoRound(formatId), "Couldn't start the round.", () => {
      setViewedRound(null);
      setTab("round");
    });

  const undoRound = () => {
    setMenuOpen(false);
    if (!session) return;
    if (!window.confirm(`Undo Round ${session.currentRound}? Its matches are deleted, and you can start it again.`)) return;
    runAction(() => undoMexicanoRound(formatId), "Couldn't undo the round.", () => setViewedRound(null));
  };

  const finishEarly = () => {
    setMenuOpen(false);
    if (!session) return;
    if (
      !window.confirm(
        `Finish the event after Round ${session.currentRound}? No more rounds can be started, and the current leaderboard is final.`
      )
    )
      return;
    runAction(() => finishMexicano(formatId), "Couldn't finish the event.");
  };

  const submitScore = async (gameScores: MatchGameScore[]) => {
    if (!scoreMatch) return;
    setSavingScore(true);
    try {
      await updateMatchByFormat(scoreMatch.formatType, scoreMatch.id, { gameScores });
      setScoreMatch(null);
      await refresh();
    } catch (error) {
      window.alert(
        error instanceof UnknownMatchFormatError
          ? error.message
          : mexicanoErrorMessage(error, "Failed to update scores. Please try again.")
      );
    } finally {
      setSavingScore(false);
    }
  };

  if (!session) {
    return (
      <div className="mexicano-runner">
        <div className="mexicano-runner__state">
          {loadError ? (
            <>
              <p>{loadError}</p>
              <button type="button" className="mexicano-runner__secondary" onClick={refresh}>
                Try again
              </button>
            </>
          ) : (
            <VolleyballLoading message="Loading Mexicano..." size="medium" />
          )}
        </div>
      </div>
    );
  }

  const nameById = new Map(session.players.map((p) => [p.teamId, p.name]));
  const counts = {
    playing: session.players.filter((p) => p.status === MexicanoStatus.Playing).length,
    sittingOut: session.players.filter((p) => p.status === MexicanoStatus.SitOut).length,
    notHere: session.players.filter((p) => p.status === MexicanoStatus.NotHere).length,
  };
  const notHere = session.players.filter((p) => p.status === MexicanoStatus.NotHere);
  const shownRound =
    session.rounds.find((r) => r.number === (viewedRound ?? session.currentRound)) ??
    session.rounds[session.rounds.length - 1];
  const query = search.trim().toLowerCase();
  const visiblePlayers = query
    ? session.players.filter((p) => [p.name, ...p.members].some((n) => n.toLowerCase().includes(query)))
    : session.players;
  const statusesLocked = !canRun || session.ended;
  const pillTone = session.ended
    ? "done"
    : session.currentRound > 0 && session.currentRoundScored < session.currentRoundTotal
      ? "waiting"
      : "ready";
  const unitLabel = session.unitSize === 1 ? "Player" : "Team";
  // Until someone picks a tab: Players before round 1 (check-in), the Round afterwards.
  const activeTab: Tab = tab ?? (session.currentRound > 0 ? "round" : "players");

  return (
    <div className={`mexicano-runner ${canRun && !session.ended ? "mexicano-runner--with-bar" : ""}`}>
      <button type="button" className="mexicano-runner__back" onClick={onBack}>
        ← Back to matches
      </button>

      <header className="mexicano-runner__header">
        <div className="mexicano-runner__titles">
          <h1>{session.categoryName || "Mexicano"}</h1>
          <p>
            {session.stageName} · {roundLabel(session)}
          </p>
        </div>
        <span className={`mexicano-runner__pill mexicano-runner__pill--${pillTone}`}>{statusLine(session)}</span>
      </header>

      <div className="mexicano-runner__tabs" role="tablist">
        {(
          [
            ["round", "Round"],
            ["players", "Players"],
            ["leaderboard", "Leaderboard"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={activeTab === key}
            className={`mexicano-runner__tab ${activeTab === key ? "active" : ""}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "round" && (
        <section className="mexicano-runner__panel">
          {!shownRound ? (
            <div className="mexicano-runner__empty">
              <p className="mexicano-runner__empty-title">No round has started yet</p>
              <p>
                {canRun
                  ? "Mark who's here on the Players tab, then press Start round 1."
                  : "The organizer starts each round. Courts show up here as soon as it does."}
              </p>
            </div>
          ) : (
            <>
              {session.rounds.length > 1 && (
                <label className="mexicano-runner__round-picker">
                  <span>Showing</span>
                  <select
                    aria-label="Round"
                    value={shownRound.number}
                    onChange={(e) => setViewedRound(Number(e.target.value))}
                  >
                    {session.rounds.map((r) => (
                      <option key={r.number} value={r.number}>
                        Round {r.number}
                        {r.number === session.currentRound ? " (current)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="mexicano-runner__courts">
                {shownRound.matches.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    onUpdateScore={setScoreMatch}
                    showUpdateScore={!match.isCompleted || canRun}
                    showAssignReferee={false}
                    showRefereeTeams
                  />
                ))}
              </div>
              {shownRound.sittingOut.length > 0 && (
                <p className="mexicano-runner__sitting-out">
                  Sitting out this round: {shownRound.sittingOut.map((id) => nameById.get(id) ?? "Unknown").join(", ")}
                </p>
              )}
            </>
          )}
        </section>
      )}

      {activeTab === "players" && (
        <section className="mexicano-runner__panel">
          <div className="mexicano-runner__players-head">
            <p className="mexicano-runner__counts">
              {counts.playing} playing · {counts.sittingOut} sitting out · {counts.notHere} not here
            </p>
            {canRun && !session.ended && (
              <button
                type="button"
                className="mexicano-runner__secondary"
                disabled={notHere.length === 0}
                onClick={() => saveStatuses(notHere.map((p) => ({ teamId: p.teamId, status: MexicanoStatus.Playing })))}
              >
                Mark everyone playing
              </button>
            )}
          </div>
          <input
            type="search"
            className="mexicano-runner__search"
            placeholder={`Search ${unitLabel.toLowerCase()}s`}
            aria-label={`Search ${unitLabel.toLowerCase()}s`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <ul className="mexicano-runner__players">
            {visiblePlayers.map((p) => (
              <li key={p.teamId} className="mexicano-runner__player">
                <div className="mexicano-runner__player-name">
                  <span>{p.name}</span>
                  {session.unitSize > 1 && p.members.length > 0 && (
                    <span className="mexicano-runner__player-members">{p.members.join(", ")}</span>
                  )}
                </div>
                <div className="mexicano-runner__segmented" role="group" aria-label={`${p.name} status`}>
                  {STATUS_OPTIONS.map((option) => (
                    <button
                      key={option.status}
                      type="button"
                      aria-pressed={p.status === option.status}
                      className={`mexicano-runner__segment mexicano-runner__segment--${option.status} ${
                        p.status === option.status ? "active" : ""
                      }`}
                      disabled={statusesLocked}
                      onClick={() =>
                        p.status !== option.status && saveStatuses([{ teamId: p.teamId, status: option.status }])
                      }
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </li>
            ))}
            {visiblePlayers.length === 0 && <li className="mexicano-runner__none">No one matches "{search}".</li>}
          </ul>
        </section>
      )}

      {activeTab === "leaderboard" && (
        <section className="mexicano-runner__panel">
          <table className="mexicano-runner__table">
            <thead>
              <tr>
                <th>#</th>
                <th>{unitLabel}</th>
                <th>Played</th>
                <th>Pts</th>
                <th>Sat out</th>
              </tr>
            </thead>
            <tbody>
              {session.players.map((p) => (
                <tr key={p.teamId}>
                  <td>{p.rank}</td>
                  <td>{p.name}</td>
                  <td>{p.played}</td>
                  <td className="mexicano-runner__points">{p.points}</td>
                  <td>{p.sitOuts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {canRun && !session.ended && (
        <div className="mexicano-runner__bar">
          <div className="mexicano-runner__bar-main">
            <button
              type="button"
              className="mexicano-runner__start"
              disabled={busy || !session.canStartNextRound}
              onClick={startRound}
            >
              {busy ? "Working..." : `Start round ${session.currentRound + 1}`}
            </button>
            {session.nextRoundBlockedReason && (
              <p className="mexicano-runner__reason">{session.nextRoundBlockedReason}</p>
            )}
          </div>
          {(session.canUndoRound || session.canFinish) && (
            <div className="mexicano-runner__more">
              <button
                type="button"
                className="mexicano-runner__more-toggle"
                aria-label="More actions"
                aria-expanded={menuOpen}
                disabled={busy}
                onClick={() => setMenuOpen((open) => !open)}
              >
                ⋯
              </button>
              {menuOpen && (
                <div className="mexicano-runner__menu">
                  {session.canUndoRound && (
                    <button type="button" onClick={undoRound}>
                      Undo round
                    </button>
                  )}
                  {session.canFinish && (
                    <button type="button" onClick={finishEarly}>
                      Finish early
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <UpdateScoreDialog
        isOpen={!!scoreMatch}
        match={scoreMatch}
        onClose={() => {
          setScoreMatch(null);
          refresh();
        }}
        onSubmit={submitScore}
        openInFullscreen={false}
        loading={savingScore}
      />
    </div>
  );
};

export default MexicanoRunner;
