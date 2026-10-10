import React, { useCallback, useEffect, useRef, useState } from "react";
import UpdateScoreDialog from "../../matches/components/UpdateScoreDialog";
import { UnknownMatchFormatError, updateMatchByFormat } from "../../matches/api/matches";
import { Match, MatchGameScore } from "../../matches/types/match";
// The UI kit's own files, not its barrel: the barrel pulls in react-router-dom, which these router-free tests can't load.
import { AppBar } from "../../../ui/AppBar";
import { Button } from "../../../ui/Button";
import { EmptyState } from "../../../ui/EmptyState";
import { Icon } from "../../../ui/Icon";
import { SearchInput } from "../../../ui/SearchInput";
import { Spinner } from "../../../ui/Spinner";
import { Tag } from "../../../ui/Tag";
import { UnderlineTabs } from "../../../ui/UnderlineTabs";
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
import MexicanoCourt from "./MexicanoCourt";
import { NewTeamTray, UnpairedList } from "./TeamFormation";
import "./MexicanoRunner.scss";

type Tab = "round" | "players" | "leaderboard";

const TABS: { value: Tab; label: string }[] = [
  { value: "round", label: "Round" },
  { value: "players", label: "Players" },
  { value: "leaderboard", label: "Leaderboard" },
];

interface MexicanoRunnerProps {
  formatId: string;
  /** Organizer controls (the MexicanoRunPolicy roles). Everyone else only enters scores. */
  canRun: boolean;
  onBack: () => void;
  /** How often to re-read the session while the page is visible; 0 turns polling off. */
  pollMs?: number;
}

/** The three-way switch: grey when Not here is on, green for Playing, orange for Sit out (mockup `.tri`). */
const STATUS_OPTIONS: { status: MexicanoStatus; label: string; tone: "away" | "play" | "out" }[] = [
  { status: MexicanoStatus.NotHere, label: "Not here", tone: "away" },
  { status: MexicanoStatus.Playing, label: "Playing", tone: "play" },
  { status: MexicanoStatus.SitOut, label: "Sit out", tone: "out" },
];

const BACK_LABEL = "Back to Mexicano";

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
  const searchBox = useRef<HTMLDivElement>(null); // around the SearchInput, which takes no ref
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
      searchBox.current?.querySelector("input")?.focus();
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
        <div className="mexicano-runner__top">
          <AppBar title="Mexicano" onBack={onBack} backLabel={BACK_LABEL} />
        </div>
        <main className="mexicano-runner__body">
          {loadError ? (
            <div className="mexicano-runner__state">
              <EmptyState icon="alert" title={loadError} action={<Button onClick={refresh}>Try again</Button>} />
            </div>
          ) : (
            <Spinner label="Loading Mexicano..." />
          )}
        </main>
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
  // The status, split as in the mockup: while scores are due the bar's tag says how many are in ("2 of 4 in") and
  // the Round tab says "Waiting for scores"; otherwise the tag carries the whole status line.
  const waitingForScores =
    !session.ended && session.currentRound > 0 && session.currentRoundScored < session.currentRoundTotal;
  const statusTag = waitingForScores
    ? `${session.currentRoundScored} of ${session.currentRoundTotal} in`
    : statusLine(session);
  const unitLabel = session.unitSize === 1 ? "Player" : "Team";
  const searchLabel = canFormTeams ? "Search players and teams" : `Search ${unitLabel.toLowerCase()}s`;
  // Until someone picks a tab: Players before round 1 (check-in), the Round afterwards.
  const activeTab: Tab = tab ?? (session.currentRound > 0 ? "round" : "players");
  const hasBar = canRun && !session.ended;
  const hasTray = canFormTeams && pickedPlayers.length > 0;

  return (
    <div
      className={["mexicano-runner", hasBar && "mexicano-runner--with-bar", hasTray && "mexicano-runner--with-tray"]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="mexicano-runner__top">
        <AppBar
          eyebrow={`${session.stageName || "Mexicano"} · ${roundLabel(session)}`}
          title={session.categoryName || "Mexicano"}
          onBack={onBack}
          backLabel={BACK_LABEL}
          right={<Tag tone="glass">{statusTag}</Tag>}
        />
        <div className="mexicano-runner__tabs">
          <UnderlineTabs ariaLabel="Mexicano" options={TABS} value={activeTab} onChange={(v) => setTab(v as Tab)} />
        </div>
      </div>

      <main className="mexicano-runner__body">
        {activeTab === "round" && (
          <section className="mexicano-runner__panel">
            {!shownRound ? (
              <div className="mexicano-runner__state">
                <EmptyState
                  icon="mexicano"
                  title="No round has started yet"
                  body={
                    canRun
                      ? "Mark who's here on the Players tab, then press Start round 1."
                      : "The organizer starts each round. Courts show up here as soon as it does."
                  }
                />
              </div>
            ) : (
              <>
                <div className="mexicano-runner__round-head">
                  {session.rounds.length > 1 ? (
                    // A native select (the phone's own picker) laid invisibly over the round chip.
                    <span className="mexicano-runner__round-pick">
                      <span aria-hidden="true">Round {shownRound.number}</span>
                      <Icon name="chevron-down" size={12} />
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
                    </span>
                  ) : (
                    <span className="mexicano-runner__round-pick">Round {shownRound.number}</span>
                  )}
                  {waitingForScores && shownRound.number === session.currentRound && (
                    <span className="mexicano-runner__round-status">Waiting for scores</span>
                  )}
                </div>
                <ul className="mexicano-runner__courts">
                  {shownRound.matches.map((match) => (
                    <MexicanoCourt
                      key={match.id}
                      match={match}
                      canScore={!match.isCompleted || canRun}
                      onScore={setScoreMatch}
                    />
                  ))}
                </ul>
                {shownRound.sittingOut.length > 0 && (
                  <p className="mexicano-runner__sitting-out">
                    Sitting out: <b>{shownRound.sittingOut.map((id) => nameById.get(id) ?? "Unknown").join(", ")}</b>
                  </p>
                )}
              </>
            )}
          </section>
        )}

        {activeTab === "players" && (
          <section className="mexicano-runner__panel">
            <div className="mexicano-runner__players-head">
              <div className="mexicano-runner__counts">
                <Tag tone="ok">{counts.playing} playing</Tag>
                <Tag tone="warn">{counts.sittingOut} sitting out</Tag>
                <Tag tone="grey">{counts.notHere} not here</Tag>
              </div>
              {canRun && !session.ended && (
                <Button
                  variant="tint"
                  size="sm"
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
                </Button>
              )}
            </div>
            <div className="mexicano-runner__search" ref={searchBox}>
              <SearchInput value={search} onChange={setSearch} placeholder={searchLabel} />
            </div>
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
                  className={`mexicano-runner__player${p.teamId === justMade ? " mexicano-runner__player--new" : ""}`}
                >
                  <div className="mexicano-runner__player-name">
                    <span className="mexicano-runner__player-title">{p.name}</span>
                    {/* Teams formed here are named after their players; don't say it twice. */}
                    {session.unitSize > 1 && p.members.length > 0 && p.members.join(" / ") !== p.name && (
                      <span className="mexicano-runner__player-members">{p.members.join(", ")}</span>
                    )}
                  </div>
                  <div className="mexicano-runner__player-actions">
                    <div className="mexicano-runner__tri" role="group" aria-label={`${p.name} status`}>
                      {STATUS_OPTIONS.map((option) => (
                        <button
                          key={option.status}
                          type="button"
                          aria-pressed={p.status === option.status}
                          className={`mexicano-runner__tri-option mexicano-runner__tri-option--${option.tone}`}
                          disabled={statusesLocked}
                          onClick={() =>
                            p.status !== option.status && saveStatuses([{ teamId: p.teamId, status: option.status }])
                          }
                        >
                          <span className="mexicano-runner__tri-face">{option.label}</span>
                        </button>
                      ))}
                    </div>
                    {canFormTeams && !p.hasMatches && p.teamId === justMade && (
                      <Button
                        variant="tint"
                        size="sm"
                        aria-label={`Undo ${p.name}`}
                        disabled={busy}
                        onClick={() => undoTeam(p.teamId)}
                      >
                        Undo
                      </Button>
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
            <div className="mexicano-runner__board">
              <table className="mexicano-runner__table">
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">{unitLabel}</th>
                    <th scope="col" className="mexicano-runner__num">
                      Played
                    </th>
                    <th scope="col" className="mexicano-runner__num">
                      Pts
                    </th>
                    <th scope="col" className="mexicano-runner__num">
                      Sat out
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {session.players.map((p) => (
                    <tr key={p.teamId}>
                      <td className="mexicano-runner__rank">{p.rank}</td>
                      <td className="mexicano-runner__who">{p.name}</td>
                      <td className="mexicano-runner__num">{p.played}</td>
                      <td className="mexicano-runner__num mexicano-runner__points">{p.points}</td>
                      <td className="mexicano-runner__num">{p.sitOuts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      {hasBar && (
        <div className="mexicano-runner__bar">
          {hasTray && (
            <NewTeamTray
              unitSize={session.unitSize}
              picked={pickedPlayers}
              onRemove={(id) => setPicked((current) => current.filter((x) => x !== id))}
            />
          )}
          <div className="mexicano-runner__bar-inner">
            <div className="mexicano-runner__bar-row">
              <Button
                size="lg"
                className="mexicano-runner__start"
                loading={busy}
                disabled={busy || savingStatuses > 0 || !session.canStartNextRound}
                onClick={startRound}
              >
                {busy ? "Working..." : `Start round ${session.currentRound + 1}`}
              </Button>
              {(session.canUndoRound || session.canFinish) && (
                <div className="mexicano-runner__more">
                  <button
                    type="button"
                    className="mexicano-runner__dots"
                    aria-label="More actions"
                    aria-expanded={menuOpen}
                    disabled={busy}
                    onClick={() => setMenuOpen((open) => !open)}
                  >
                    <Icon name="more" size={22} />
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
            {session.nextRoundBlockedReason && (
              <p className="mexicano-runner__reason" title={session.nextRoundBlockedReason}>
                {session.nextRoundBlockedReason}
              </p>
            )}
          </div>
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
