import React, { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Navigate, useParams, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "../../../store";
import { Button } from "../../../ui/Button";
import { EmptyState } from "../../../ui/EmptyState";
import { Icon } from "../../../ui/Icon";
import { SearchInput } from "../../../ui/SearchInput";
import { Segmented } from "../../../ui/Segmented";
import { SkeletonRows } from "../../../ui/Spinner";
import { useToast } from "../../../ui/Toast";
import { hasFullAccess } from "../../auth/permissions";
import { useTournaments } from "../../tournaments/hooks";
import { AppBarSlot, AppBarTakeover } from "../../tournament-shell/AppBarSlot";
import Drawer from "../../shared/components/Drawer";
import AssignRefereeModal from "../components/AssignRefereeModal";
import BulkAssignRefereeModal from "../components/BulkAssignRefereeModal";
import BulkEditMatchModal from "../components/BulkEditMatchModal";
import BulkUpdateScoreModal from "../components/BulkUpdateScoreModal";
import EditMatchModal from "../components/EditMatchModal";
import MatchQRCodeModal from "../components/MatchQRCodeModal";
import UpdateScoreDialog from "../components/UpdateScoreDialog";
import ActiveFilterChips from "../components/timeline/ActiveFilterChips";
import BulkActionBar from "../components/timeline/BulkActionBar";
import FiltersSheet from "../components/timeline/FiltersSheet";
import MatchesTimeline from "../components/timeline/MatchesTimeline";
import MatchSheet from "../components/timeline/MatchSheet";
import SelectModeBar from "../components/timeline/SelectModeBar";
import { refereesWithPhones, useMatchActions } from "../hooks/useMatchActions";
import { useMatchFilters } from "../hooks/useMatchFilters";
import { useMatchList } from "../hooks/useMatchList";
import { useSelection } from "../hooks/useSelection";
import { Match, MatchGameScore } from "../types/match";
import { initials } from "../utils/matchDisplay";
import { defaultDate, defaultTab, isTournamentOver, MatchTab } from "../utils/timeline";
import "./MatchesPage.scss";

const TABS: { value: MatchTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "live", label: "Live" },
  { value: "next", label: "Up next" },
  { value: "done", label: "Done" },
];

/**
 * A tournament's matches (mockup matches-layout.html option B "Timeline"): search and Filters in the app bar, the
 * active filters as chips, All · Live · Up next · Done with counts, then the matches under time headers, 30 at a time
 * (All: 100).
 * Tapping a match opens its sheet; Score, Referee, Edit and QR open today's dialogs from there. With full access,
 * holding a match (or "Select") starts select mode: the bar turns orange, rows get ticks, and the bulk actions take the
 * tab bar's place (mockup match-flow-v2.html phone 5).
 */
const MatchesPage: React.FC = () => {
  const { id = "" } = useParams();
  const user = useSelector((state: RootState) => state.user.user);
  const fullAccess = hasFullAccess(user);

  const { filters, searchInput, setFilter, clearAll, activeCount, hasExplicitTab, hasExplicitDate } = useMatchFilters();
  const list = useMatchList(id, filters, { enabled: hasExplicitTab && hasExplicitDate });
  const actions = useMatchActions(id);
  const { show } = useToast();
  const { matches, counts, filterOptions } = list;

  // First load: Day = today when the tournament plays today (else all days), then the tab, from the counts for that
  // day: Done once the tournament is over (its end date, from the cached tournaments list: wait while it loads), else
  // Live, Up next or Done, whichever has matches first (defaultTab). Both land in the URL, so they stick.
  const tournaments = useTournaments();
  const tournamentOver = isTournamentOver(tournaments.data?.find((t) => t.id === id)?.endDate, new Date());
  const tournamentsLoading = tournaments.isLoading;
  useEffect(() => {
    if (!list.countsReady) return;
    if (!hasExplicitDate) setFilter("date", defaultDate(filterOptions.dates, new Date()));
    else if (!hasExplicitTab && !tournamentsLoading) setFilter("tab", defaultTab({ counts, tournamentOver }));
  }, [
    list.countsReady,
    hasExplicitDate,
    hasExplicitTab,
    tournamentsLoading,
    tournamentOver,
    filterOptions.dates,
    counts,
    setFilter,
  ]);

  const [filtersOpen, setFiltersOpen] = useState(false);

  // The match sheet works on the match as the list has it now (it refreshes under the sheet), else the snapshot taken
  // when it opened. The snapshot stays while the sheet slides out.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetSnapshot, setSheetSnapshot] = useState<Match | null>(null);
  const live = (match: Match | null) => (match ? matches.find((m) => m.id === match.id) ?? match : null);
  const sheetMatch = live(sheetSnapshot);

  const [assignSnapshot, setAssignSnapshot] = useState<Match | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [scoreMatch, setScoreMatch] = useState<Match | null>(null);
  const [editMatch, setEditMatch] = useState<Match | null>(null);
  const [qrMatch, setQrMatch] = useState<Match | null>(null);

  // Select mode (full access): bulk actions work on the selected matches of the list on screen.
  const ids = useMemo(() => matches.map((match) => match.id), [matches]);
  const selection = useSelection(ids);
  const { selected: selectedIds, active: selecting, exit: exitSelectMode, deselect } = selection;
  const selectedMatches = useMemo(() => matches.filter((match) => selectedIds.has(match.id)), [matches, selectedIds]);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkScoreOpen, setBulkScoreOpen] = useState(false);
  const [bulkScoreMatches, setBulkScoreMatches] = useState<Match[]>([]);
  const [bulkWhatsAppOpen, setBulkWhatsAppOpen] = useState(false);
  const [whatsAppPhone, setWhatsAppPhone] = useState("");

  const openSheet = (match: Match) => {
    setSheetSnapshot(match);
    setSheetOpen(true);
  };
  /** One sheet at a time: an action's own sheet replaces the match sheet. */
  const fromSheet = (open: (match: Match) => void) => (match: Match) => {
    setSheetOpen(false);
    open(match);
  };

  // Select mode swaps the app bar for its shorter orange bar (and back): keep the list where it was on screen, so a
  // long-pressed row stays under the finger.
  const bodyRef = useRef<HTMLDivElement>(null);
  const keepListStill = (change: () => void) => {
    const before = bodyRef.current?.getBoundingClientRect().top;
    flushSync(change);
    const after = bodyRef.current?.getBoundingClientRect().top;
    if (before !== undefined && after !== undefined && after !== before) window.scrollBy(0, after - before);
  };
  const startSelectMode = (matchId?: string) => keepListStill(() => selection.start(matchId));
  const leaveSelectMode = () => keepListStill(exitSelectMode);

  // Another tab, any filter or the search leaves select mode.
  const filtersKey = JSON.stringify(filters);
  const lastFiltersKey = useRef(filtersKey);
  useEffect(() => {
    if (lastFiltersKey.current === filtersKey) return;
    lastFiltersKey.current = filtersKey;
    if (selecting) exitSelectMode();
  }, [filtersKey, selecting, exitSelectMode]);

  const changeTab = (tab: string) => {
    setFilter("tab", tab as MatchTab);
    window.scrollTo(0, 0);
  };

  // ---- single match ----

  // The match sheet's ✕ takes a referee or a referee team off at once, as the old match card did (the referee sheet
  // asks first): a toast says it's done.
  const unassignRefereeFromSheet = async (refereeId: string, matchId: string) => {
    const name = sheetMatch?.referees?.find((referee) => referee.id === refereeId)?.fullName || "Referee";
    if (await actions.unassignReferee(refereeId, matchId)) show(`${name} unassigned.`);
  };
  const unassignTeamFromSheet = async (matchId: string, teamId: string) => {
    const name = sheetMatch?.refereeTeams?.find((team) => team.teamId === teamId)?.teamName || "Referee team";
    if (await actions.unassignTeam(matchId, teamId)) show(`${name} unassigned.`);
  };

  const closeAssign = () => setAssignOpen(false);
  const assignMatch = live(assignSnapshot);

  const closeScoreboard = () => {
    setScoreMatch(null);
    actions.scoreboardClosed();
  };
  const submitScore = async (gameScores: MatchGameScore[]) => {
    if (await actions.submitScore(scoreMatch, gameScores)) setScoreMatch(null);
  };

  // ---- bulk (select mode) ----

  // A finished bulk assign or edit ends select mode (the old page cleared the selection, which hid its bulk bar).
  const bulkAssign = async (refereeIds: string[], matchIds: string[], keepOpen = false) => {
    const done = await actions.bulkAssignReferees(refereeIds, matchIds);
    if (done && !keepOpen) {
      setBulkAssignOpen(false);
      exitSelectMode();
    }
    return done;
  };

  const bulkEdit = async (updates: { matchId: string; venue?: string | null; bestOf?: number | null }[]) => {
    if (await actions.bulkEditMatches(updates, matches)) {
      setBulkEditOpen(false);
      exitSelectMode();
    }
  };

  // The sheet works on a snapshot: refreshing the list after a save must not reshuffle or drop rows mid-edit.
  const openBulkScoreSheet = () => {
    setBulkScoreMatches(selectedMatches);
    setBulkScoreOpen(true);
  };
  const removeFromBulkScoreSheet = (matchId: string) => {
    const remaining = bulkScoreMatches.filter((match) => match.id !== matchId);
    setBulkScoreMatches(remaining);
    deselect([matchId]);
    if (remaining.length === 0) setBulkScoreOpen(false);
  };
  const closeBulkScoreSheet = (savedMatchIds: string[]) => {
    setBulkScoreOpen(false);
    setBulkScoreMatches([]);
    if (savedMatchIds.length > 0) deselect(savedMatchIds);
  };

  const openBulkWhatsApp = () => {
    const referees = actions.bulkWhatsAppReferees(selectedMatches);
    if (referees.length === 0) return;
    setWhatsAppPhone(referees[0].phoneNumber);
    setBulkWhatsAppOpen(true);
  };
  const sendBulkWhatsApp = () => {
    if (!actions.sendBulkWhatsApp(whatsAppPhone, selectedMatches)) return;
    setBulkWhatsAppOpen(false);
    setWhatsAppPhone("");
  };
  // Worked out only while the drawer is open (it keeps its last content to slide out).
  const bulkWhatsAppReferees = bulkWhatsAppOpen ? refereesWithPhones(selectedMatches) : [];

  // ---- the list ----

  const filtered = activeCount > 0 || filters.search !== "";
  const total = counts.live + counts.next + counts.done;
  const filtersLabel = activeCount > 0 ? `Filters · ${activeCount}` : "Filters";

  // A refresh that failed (on return to the tab, after a change) keeps the list on screen and says so above it.
  const refreshNotice =
    list.refreshFailed && !list.isError ? (
      <div className="matches-page__notice" role="alert">
        <Icon name="alert" size={16} className="matches-page__notice-icon" />
        <span className="matches-page__notice-text">An error occurred while loading data</span>
        <Button variant="tint" size="sm" icon="refresh" onClick={list.refetch}>
          Try again
        </Button>
      </div>
    ) : null;

  let content: React.ReactNode;
  if (list.isError) {
    content = (
      <EmptyState
        icon="alert"
        title="Error"
        body="An error occurred while loading data"
        action={
          <Button variant="tint" icon="refresh" onClick={list.refetch}>
            Try again
          </Button>
        }
      />
    );
  } else if (list.isLoading) {
    content = <SkeletonRows rows={5} />;
  } else if (matches.length === 0) {
    content = filtered ? (
      <EmptyState
        icon="filter"
        title="No matches match your filters"
        body="Try adjusting your search or filters."
        action={
          <Button variant="tint" onClick={clearAll}>
            Clear filters
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon="matches"
        title="No matches found"
        body={total === 0 ? "There are no matches available to manage." : undefined}
      />
    );
  } else {
    content = (
      <>
        <MatchesTimeline
          matches={matches}
          tab={filters.tab}
          showDates={filters.date === "all"}
          onOpen={openSheet}
          onLongPress={fullAccess ? (match) => startSelectMode(match.id) : undefined}
          selecting={selecting}
          selectedIds={selectedIds}
          onToggle={(match) => selection.toggle(match.id)}
        />
        {list.hasMore ? (
          <div className="matches-page__more">
            <Button variant="tint" loading={list.isFetchingMore} onClick={list.loadMore}>
              Load more
            </Button>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className="matches-page">
      {selecting ? (
        <AppBarTakeover
          bar={
            <SelectModeBar
              count={selectedIds.size}
              total={ids.length}
              onExit={leaveSelectMode}
              onSelectAll={selection.selectAll}
              onClear={selection.clear}
            />
          }
          bottom={
            <BulkActionBar
              disabled={selectedIds.size === 0}
              onReferee={() => setBulkAssignOpen(true)}
              onScores={openBulkScoreSheet}
              onEdit={() => setBulkEditOpen(true)}
              onWhatsApp={openBulkWhatsApp}
            />
          }
        />
      ) : null}

      <AppBarSlot>
        <div className="matches-page__searchbar">
          <div className="matches-page__search">
            <SearchInput
              value={searchInput}
              onChange={(value) => setFilter("search", value)}
              placeholder="Team, player or court"
              ariaLabel="Search matches"
            />
          </div>
          <Button className="matches-page__filters-btn" icon="filter" onClick={() => setFiltersOpen(true)}>
            {filtersLabel}
          </Button>
        </div>
      </AppBarSlot>

      <ActiveFilterChips
        filters={filters}
        filterOptions={filterOptions}
        setFilter={setFilter}
        onOpenFilters={() => setFiltersOpen(true)}
      />

      <div className="matches-page__body" ref={bodyRef}>
        <div className="matches-page__tabs">
          <div className="matches-page__seg">
            <Segmented
              ariaLabel="Matches"
              value={hasExplicitTab ? filters.tab : ""}
              onChange={changeTab}
              options={TABS.map((tab) => ({ ...tab, count: list.countsReady || total > 0 ? counts[tab.value] : undefined }))}
            />
          </div>
          {fullAccess && !selecting && matches.length > 0 ? (
            <button type="button" className="matches-page__select" onClick={() => startSelectMode()}>
              Select
            </button>
          ) : null}
        </div>
        <div className="matches-page__list">
          {refreshNotice}
          {content}
        </div>
      </div>

      <FiltersSheet
        isOpen={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={filters}
        filterOptions={filterOptions}
        setFilter={setFilter}
        onClearAll={clearAll}
        activeCount={activeCount}
        resultCount={counts[filters.tab]}
      />

      <MatchSheet
        isOpen={sheetOpen}
        match={sheetMatch}
        onClose={() => setSheetOpen(false)}
        fullAccess={fullAccess}
        onScore={fromSheet(setScoreMatch)}
        onAssignReferee={fromSheet((match) => {
          setAssignSnapshot(match);
          setAssignOpen(true);
        })}
        onShare={actions.shareMatch}
        onShowQR={fromSheet(setQrMatch)}
        onEdit={fromSheet(setEditMatch)}
        onShareWithReferee={actions.shareMatchWithReferee}
        onUnassignReferee={unassignRefereeFromSheet}
        onUnassignTeam={unassignTeamFromSheet}
      />

      <AssignRefereeModal
        isOpen={assignOpen}
        match={assignMatch}
        onClose={closeAssign}
        onAssign={async (refereeIds) => {
          if (await actions.assignReferees(assignMatch, refereeIds)) closeAssign();
        }}
        onAssignTeams={actions.assignTeams}
        onUnassignTeam={async (matchId, teamId) => {
          await actions.unassignTeam(matchId, teamId);
        }}
        onUnassignReferee={async (refereeId, matchId) => {
          await actions.unassignReferee(refereeId, matchId);
        }}
        loading={actions.assigningReferee}
      />

      <UpdateScoreDialog
        isOpen={scoreMatch !== null}
        match={scoreMatch}
        onClose={closeScoreboard}
        onSubmit={submitScore}
        openInFullscreen={false}
        loading={actions.updatingScore}
      />

      <EditMatchModal
        isOpen={editMatch !== null}
        match={editMatch}
        onClose={() => setEditMatch(null)}
        onSubmit={async (data) => {
          if (await actions.editMatch(editMatch, data)) setEditMatch(null);
        }}
        loading={actions.editingMatch}
        availableVenues={filterOptions.venues}
      />

      <MatchQRCodeModal match={qrMatch} onClose={() => setQrMatch(null)} />

      <BulkAssignRefereeModal
        isOpen={bulkAssignOpen}
        selectedMatches={selectedMatches}
        onClose={() => setBulkAssignOpen(false)}
        onAssign={bulkAssign}
        onAssignTeams={actions.assignTeams}
        loading={actions.bulkAssigningReferee}
      />

      <BulkUpdateScoreModal
        isOpen={bulkScoreOpen}
        selectedMatches={bulkScoreMatches}
        onRemoveMatch={removeFromBulkScoreSheet}
        onSave={actions.saveBulkScores}
        onClose={closeBulkScoreSheet}
      />

      <BulkEditMatchModal
        isOpen={bulkEditOpen}
        selectedMatches={selectedMatches}
        onClose={() => setBulkEditOpen(false)}
        onSubmit={bulkEdit}
        loading={actions.bulkEditingMatches}
        availableVenues={filterOptions.venues}
      />

      <Drawer
        isOpen={bulkWhatsAppOpen}
        onClose={() => setBulkWhatsAppOpen(false)}
        title="Share matches on WhatsApp"
        className="bulk-whatsapp-drawer"
        footer={
          <div className="drawer__actions">
            <Button variant="ghost" size="lg" onClick={() => setBulkWhatsAppOpen(false)}>
              Cancel
            </Button>
            <Button size="lg" icon="whatsapp" onClick={sendBulkWhatsApp} disabled={whatsAppPhone === ""}>
              Send Message
            </Button>
          </div>
        }
      >
        <p className="bulk-whatsapp__intro">Select one of the assigned referees to share matches on WhatsApp</p>
        <ul className="bulk-whatsapp__list">
          {bulkWhatsAppReferees.map((referee) => (
            <li key={referee.phoneNumber}>
              <label className="bulk-whatsapp__row">
                <input
                  type="radio"
                  className="bulk-whatsapp__radio"
                  name="selectedReferee"
                  checked={whatsAppPhone === referee.phoneNumber}
                  onChange={() => setWhatsAppPhone(referee.phoneNumber)}
                />
                <span className="bulk-whatsapp__avatar" aria-hidden="true">
                  {initials(referee.fullName)}
                </span>
                <span className="bulk-whatsapp__who">
                  <span className="referee-name">{referee.fullName}</span>
                  <small className="referee-phone">{referee.phoneNumber}</small>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </Drawer>
    </div>
  );
};

/** Old links to the Venues tab (`?tab=venues`) open the Courts tab now. */
const MatchesRoute: React.FC = () => {
  const [searchParams] = useSearchParams();
  if (searchParams.get("tab") === "venues") {
    const rest = new URLSearchParams(searchParams);
    rest.delete("tab");
    const search = rest.toString();
    return <Navigate to={{ pathname: "../courts", search: search ? `?${search}` : "" }} replace />;
  }
  return <MatchesPage />;
};

export { MatchesPage };
export default MatchesRoute;
