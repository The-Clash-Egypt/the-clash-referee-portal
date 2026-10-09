import React, { useCallback, useEffect, useRef, useState } from "react";
import MatchCard from "../../shared/components/MatchCard";
import UpdateScoreDialog from "../../matches/components/UpdateScoreDialog";
import { UnknownMatchFormatError, updateMatchByFormat } from "../../matches/api/matches";
import { Match, MatchGameScore } from "../../matches/types/match";
import VolleyballLoading from "../../../components/VolleyballLoading";
import {
  createMexicanoUnit,
  dissolveMexicanoUnit,
  finishMexicano,
  getMexicanoSession,
  mexicanoErrorMessage,
  startNextMexicanoRound,
  undoMexicanoRound,
  updateMexicanoPlayers,
} from "../api/mexicano";
import { roundLabel, statusLine } from "../sessionText";
import { MexicanoSession, MexicanoStatus } from "../types";
import { NewTeamTray, UnpairedList } from "./TeamFormation";
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

/** How long a just-made team keeps its Undo button. */
const UNDO_MS = 6000;

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
  const [savingStatuses, setSavingStatuses] = useState(0);
  // Team forming (unit size 2+). Picks live here so they survive tab switches and polls.
  const [picked, setPicked] = useState<string[]>([]);
  const [pairing, setPairing] = useState<string[]>([]); // members hidden while their team is being made
  const [justMade, setJustMade] = useState<string | null>(null); // the team that gets Undo for a moment
  const searchInput = useRef<HTMLInputElement>(null);
  // A save or action in flight: polling must not overwrite its optimistic state.
  const pending = useRef(0);
  // Every request that returns a session takes a number; only the newest one's answer is applied,
  // so a slow poll or save can never put back an older view.
  const requestSeq = useRef(0);

  const refresh = useCallback(async () => {
    const seq = ++requestSeq.current;
    try {
      const next = await getMexicanoSession(formatId);
      if (seq !== requestSeq.current) return;
      setSession(next);
      setLoadError(null);
    } catch (error) {
      if (seq === requestSeq.current) setLoadError(mexicanoErrorMessage(error, "Couldn't load this Mexicano stage."));
    }
  }, [formatId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // A pick that left the pool (paired on another device, or by this one) is dropped.
  useEffect(() => {
    if (!session) return;
    setPicked((current) => {
      const next = current.filter((id) => session.unpaired.some((u) => u.memberId === id));
      return next.length === current.length ? current : next;
    });
  }, [session]);

  useEffect(() => {
    if (!justMade) return;
    const timer = window.setTimeout(() => setJustMade(null), UNDO_MS);
    return () => window.clearTimeout(timer);
  }, [justMade]);

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
    setMenuOpen(false);
    const seq = ++requestSeq.current;
    try {
      const next = await action();
      if (seq === requestSeq.current) setSession(next);
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
    const seq = ++requestSeq.current;
    pending.current += 1;
    setSavingStatuses((n) => n + 1); // Start waits: the round must see this change
    try {
      const next = await updateMexicanoPlayers(formatId, updates);
      if (seq === requestSeq.current) setSession(next); // a later tap's answer wins
    } catch (error) {
      apply(new Map(updates.map((u) => [u.teamId, previous.get(u.teamId)!])));
      window.alert(mexicanoErrorMessage(error, "Couldn't save that change."));
    } finally {
      pending.current -= 1;
      setSavingStatuses((n) => n - 1);
    }
  };

  const startRound = () =>
    runAction(() => startNextMexicanoRound(formatId), "Couldn't start the round.", () => {
      setViewedRound(null);
      setTab("round");
    });

  /** Optimistic: the players leave the pool at once and come back if the server refuses. */
  const makeTeam = async (memberIds: string[]) => {
    if (!session) return;
    const names = memberIds.map((id) => session.unpaired.find((u) => u.memberId === id)?.name ?? "");
    const before = new Set(session.players.map((p) => p.teamId));
    setPairing((current) => [...current, ...memberIds]);
    const seq = ++requestSeq.current;
    pending.current += 1;
    try {
      const next = await createMexicanoUnit(formatId, memberIds);
      const made = next.players.filter((p) => !before.has(p.teamId));
      const mine = made.find((p) => [...p.members].sort().join("|") === [...names].sort().join("|")) ?? made[0];
      if (seq === requestSeq.current) setSession(next);
      else await refresh(); // a later pairing's answer may predate this team
      if (mine) setJustMade(mine.teamId);
    } catch (error) {
      window.alert(mexicanoErrorMessage(error, "Couldn't make that team."));
    } finally {
      setPairing((current) => current.filter((id) => !memberIds.includes(id)));
      pending.current -= 1;
    }
  };

  /** Tapping the last player a team needs makes the team; no extra button. */
  const togglePick = (memberId: string) => {
    if (!session) return;
    if (picked.includes(memberId)) {
      setPicked(picked.filter((id) => id !== memberId));
      return;
    }
    const next = [...picked, memberId];
    if (next.length < session.unitSize) {
      setPicked(next);
      return;
    }
    setPicked([]);
    if (search) {
      setSearch("");
      searchInput.current?.focus();
    }
    makeTeam(next);
  };

  const undoTeam = (teamId: string) => {
    setJustMade(null);
    runAction(() => dissolveMexicanoUnit(formatId, teamId), "Couldn't undo that team.");
  };

  const breakUpTeam = (teamId: string, name: string) => {
    if (!window.confirm(`Break up ${name}? The players go back to the unpaired list.`)) return;
    runAction(() => dissolveMexicanoUnit(formatId, teamId), "Couldn't break up that team.");
  };

  const undoRound = () => {
    setMenuOpen(false);
    if (!session) return;
    if (
      !window.confirm(
        `Undo Round ${session.currentRound}? Its matches are deleted and you can start it again. ` +
          "Anyone who was on Sit out for it is back to Playing, so mark them again if needed."
      )
    )
      return;
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
      await updateMatchByFormat(scoreMatch.formatType, scoreMatch.id, {
        gameScores,
      });
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
  // By name, not rank: rows must not move under the organizer's thumb when scores come in.
  const visiblePlayers = (
    query
      ? session.players.filter((p) => [p.name, ...p.members].some((n) => n.toLowerCase().includes(query)))
      : session.players
  )
    .slice()
    // The team just made goes on top, so its Undo is where the organizer is looking.
    .sort((a, b) => Number(b.teamId === justMade) - Number(a.teamId === justMade) || a.name.localeCompare(b.name));
  const statusesLocked = !canRun || session.ended;
  // Teams of 2+ are paired here, just before play (spec 2026-10-10).
  const canFormTeams = canRun && !session.ended && session.unitSize > 1;
  const waiting = canFormTeams ? session.unpaired.filter((u) => !pairing.includes(u.memberId)) : [];
  const visibleWaiting = query ? waiting.filter((u) => u.name.toLowerCase().includes(query)) : waiting;
  const pickedPlayers = picked
    .map((id) => session.unpaired.find((u) => u.memberId === id))
    .filter((u): u is NonNullable<typeof u> => !!u);
  // Fewer left than a team needs: say who, so nobody is forgotten.
  const leftover =
    waiting.length > 0 && waiting.length < session.unitSize && picked.length === 0
      ? `${waiting.map((u) => u.name).join(" and ")} ${waiting.length === 1 ? "still needs" : "still need"} ${
          session.unitSize === 2 ? "a partner" : "a team"
        }.`
      : null;
  const pillTone = session.ended
    ? "done"
    : session.currentRound > 0 && session.currentRoundScored < session.currentRoundTotal
      ? "waiting"
      : "ready";
  const unitLabel = session.unitSize === 1 ? "Player" : "Team";
  const searchLabel = canFormTeams ? "Search players and teams" : `Search ${unitLabel.toLowerCase()}s`;
  // Until someone picks a tab: Players before round 1 (check-in), the Round afterwards.
  const activeTab: Tab = tab ?? (session.currentRound > 0 ? "round" : "players");

  return (
    <div
      className={`mexicano-runner ${canRun && !session.ended ? "mexicano-runner--with-bar" : ""} ${
        canFormTeams && pickedPlayers.length > 0 ? "mexicano-runner--with-tray" : ""
      }`}
    >
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
                onClick={() =>
                  saveStatuses(
                    notHere.map((p) => ({
                      teamId: p.teamId,
                      status: MexicanoStatus.Playing,
                    }))
                  )
                }
              >
                Mark everyone playing
              </button>
            )}
          </div>
          <input
            ref={searchInput}
            type="search"
            className="mexicano-runner__search"
            placeholder={searchLabel}
            aria-label={searchLabel}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {waiting.length > 0 && (
            <UnpairedList
              unitSize={session.unitSize}
              players={visibleWaiting}
              total={waiting.length}
              picked={picked}
              disabled={busy}
              search={search}
              onToggle={togglePick}
            />
          )}
          {leftover && <p className="mexicano-runner__leftover">{leftover}</p>}
          {canFormTeams && <h2 className="mexicano-runner__section">Teams · {session.players.length}</h2>}
          <ul className="mexicano-runner__players">
            {visiblePlayers.map((p) => (
              <li
                key={p.teamId}
                className={`mexicano-runner__player ${p.teamId === justMade ? "mexicano-runner__player--new" : ""}`}
              >
                <div className="mexicano-runner__player-name">
                  <span>{p.name}</span>
                  {/* Teams formed here are named after their players; don't say it twice. */}
                  {session.unitSize > 1 && p.members.length > 0 && p.members.join(" / ") !== p.name && (
                    <span className="mexicano-runner__player-members">{p.members.join(", ")}</span>
                  )}
                </div>
                <div className="mexicano-runner__player-actions">
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
                  {canFormTeams && !p.hasMatches && p.teamId === justMade && (
                    <button
                      type="button"
                      className="mexicano-runner__secondary"
                      aria-label={`Undo ${p.name}`}
                      disabled={busy}
                      onClick={() => undoTeam(p.teamId)}
                    >
                      Undo
                    </button>
                  )}
                  {canFormTeams && !p.hasMatches && p.teamId !== justMade && (
                    <button
                      type="button"
                      className="mexicano-runner__quiet"
                      aria-label={`Break up ${p.name}`}
                      disabled={busy}
                      onClick={() => breakUpTeam(p.teamId, p.name)}
                    >
                      Break up
                    </button>
                  )}
                </div>
              </li>
            ))}
            {session.players.length === 0 ? (
              <li className="mexicano-runner__none">
                {canFormTeams
                  ? "No teams yet. Tap players above to pair them."
                  : "No players yet. Set up this stage in the dashboard first."}
              </li>
            ) : (
              visiblePlayers.length === 0 && <li className="mexicano-runner__none">No one matches "{search}".</li>
            )}
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
          {canFormTeams && pickedPlayers.length > 0 && (
            <NewTeamTray
              unitSize={session.unitSize}
              picked={pickedPlayers}
              onRemove={(id) => setPicked((current) => current.filter((x) => x !== id))}
            />
          )}
          <div className="mexicano-runner__bar-main">
            <button
              type="button"
              className="mexicano-runner__start"
              disabled={busy || savingStatuses > 0 || !session.canStartNextRound}
              onClick={startRound}
            >
              {busy ? "Working..." : `Start round ${session.currentRound + 1}`}
            </button>
            {session.nextRoundBlockedReason && (
              <p className="mexicano-runner__reason" title={session.nextRoundBlockedReason}>
                {session.nextRoundBlockedReason}
              </p>
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
                    <button type="button" onClick={undoRound} disabled={busy}>
                      Undo round
                    </button>
                  )}
                  {session.canFinish && (
                    <button type="button" onClick={finishEarly} disabled={busy}>
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
