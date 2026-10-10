import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useParams, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "../../../store";
import { Button } from "../../../ui/Button";
import { EmptyState } from "../../../ui/EmptyState";
import { SearchInput } from "../../../ui/SearchInput";
import { Segmented } from "../../../ui/Segmented";
import { SkeletonRows } from "../../../ui/Spinner";
import { hasFullAccess } from "../../auth/permissions";
import { AppBarSlot } from "../../tournament-shell/AppBarSlot";
import Drawer from "../../shared/components/Drawer";
import AssignRefereeModal from "../components/AssignRefereeModal";
import BulkAssignRefereeModal from "../components/BulkAssignRefereeModal";
import BulkEditMatchModal from "../components/BulkEditMatchModal";
import BulkUpdateScoreModal from "../components/BulkUpdateScoreModal";
import EditMatchModal from "../components/EditMatchModal";
import MatchQRCodeModal from "../components/MatchQRCodeModal";
import UpdateScoreDialog from "../components/UpdateScoreDialog";
import ActiveFilterChips from "../components/timeline/ActiveFilterChips";
import FiltersSheet from "../components/timeline/FiltersSheet";
import MatchesTimeline from "../components/timeline/MatchesTimeline";
import MatchSheet from "../components/timeline/MatchSheet";
import { refereesWithPhones, useMatchActions } from "../hooks/useMatchActions";
import { useMatchFilters } from "../hooks/useMatchFilters";
import { useMatchList } from "../hooks/useMatchList";
import { Match, MatchGameScore } from "../types/match";
import { defaultDate, defaultTab, MatchTab } from "../utils/timeline";
import "./MatchesPage.scss";

const TABS: { value: MatchTab; label: string }[] = [
  { value: "live", label: "Live" },
  { value: "next", label: "Up next" },
  { value: "done", label: "Done" },
];

/**
 * A tournament's matches (mockup matches-layout.html option B "Timeline"): search and Filters in the app bar, the
 * active filters as chips, Live · Up next · Done with counts, then the matches under time headers, 30 at a time.
 * Tapping a match opens its sheet; Score, Referee, Edit and QR open today's dialogs from there.
 */
const MatchesPage: React.FC = () => {
  const { id = "" } = useParams();
  const user = useSelector((state: RootState) => state.user.user);
  const fullAccess = hasFullAccess(user);

  const { filters, searchInput, setFilter, clearAll, activeCount, hasExplicitTab, hasExplicitDate } = useMatchFilters();
  const list = useMatchList(id, filters, { enabled: hasExplicitTab && hasExplicitDate });
  const actions = useMatchActions(id);
  const { matches, counts, filterOptions } = list;

  // First load: Day = today when the tournament plays today (else all days), then the tab: Live while anything is
  // live, else Up next — worked out from the counts for that day. Both land in the URL, so they stick.
  useEffect(() => {
    if (!list.countsReady) return;
    if (!hasExplicitDate) setFilter("date", defaultDate(filterOptions.dates, new Date()));
    else if (!hasExplicitTab) setFilter("tab", defaultTab(counts));
  }, [list.countsReady, hasExplicitDate, hasExplicitTab, filterOptions.dates, counts, setFilter]);

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

  // Bulk actions work on the selected matches. Select mode (long-press, the bulk bar) fills `selectedIds`.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
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

  const changeTab = (tab: string) => {
    setFilter("tab", tab as MatchTab);
    window.scrollTo(0, 0);
  };

  // ---- single match ----

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

  const clearSelection = () => setSelectedIds(new Set());
  const unselect = (matchIds: string[]) =>
    setSelectedIds((previous) => {
      const next = new Set(previous);
      matchIds.forEach((matchId) => next.delete(matchId));
      return next;
    });

  const bulkAssign = async (refereeIds: string[], matchIds: string[], keepOpen = false) => {
    const done = await actions.bulkAssignReferees(refereeIds, matchIds);
    if (done && !keepOpen) {
      setBulkAssignOpen(false);
      clearSelection();
    }
    return done;
  };

  const bulkEdit = async (updates: { matchId: string; venue?: string | null; bestOf?: number | null }[]) => {
    if (await actions.bulkEditMatches(updates, matches)) {
      setBulkEditOpen(false);
      clearSelection();
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
    unselect([matchId]);
    if (remaining.length === 0) setBulkScoreOpen(false);
  };
  const closeBulkScoreSheet = (savedMatchIds: string[]) => {
    setBulkScoreOpen(false);
    setBulkScoreMatches([]);
    if (savedMatchIds.length > 0) unselect(savedMatchIds);
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

  // Select mode's bulk bar (Referee · Scores · Edit · WhatsApp) opens the bulk sheets with these and with
  // setBulkAssignOpen / setBulkEditOpen; it lands with the select mode.
  void openBulkScoreSheet;
  void openBulkWhatsApp;

  // ---- the list ----

  const filtered = activeCount > 0 || filters.search !== "";
  const total = counts.live + counts.next + counts.done;
  const filtersLabel = activeCount > 0 ? `Filters · ${activeCount}` : "Filters";

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
        <MatchesTimeline matches={matches} tab={filters.tab} showDates={filters.date === "all"} onOpen={openSheet} />
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

      <div className="matches-page__body">
        <div className="matches-page__tabs">
          <Segmented
            ariaLabel="Matches"
            value={hasExplicitTab ? filters.tab : ""}
            onChange={changeTab}
            options={TABS.map((tab) => ({ ...tab, count: list.countsReady || total > 0 ? counts[tab.value] : undefined }))}
          />
        </div>
        <div className="matches-page__list">{content}</div>
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
        onUnassignReferee={actions.unassignReferee}
        onUnassignTeam={actions.unassignTeam}
      />

      <AssignRefereeModal
        isOpen={assignOpen}
        match={assignMatch}
        onClose={closeAssign}
        onAssign={async (refereeIds) => {
          if (await actions.assignReferees(assignMatch, refereeIds)) closeAssign();
        }}
        onAssignTeams={actions.assignTeams}
        onUnassignTeam={actions.unassignTeam}
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
          <div className="matches-page__sheet-actions">
            <Button variant="ghost" onClick={() => setBulkWhatsAppOpen(false)}>
              Cancel
            </Button>
            <Button onClick={sendBulkWhatsApp} disabled={whatsAppPhone === ""}>
              Send Message
            </Button>
          </div>
        }
      >
        <p>Select one of the assigned referees to share matches on WhatsApp</p>
        <div className="referees-list">
          {bulkWhatsAppReferees.map((referee) => (
            <div key={referee.phoneNumber} className="referee-item">
              <label className="referee-checkbox">
                <input
                  type="radio"
                  name="selectedReferee"
                  checked={whatsAppPhone === referee.phoneNumber}
                  onChange={() => setWhatsAppPhone(referee.phoneNumber)}
                />
                <span className="referee-name">{referee.fullName}</span>
                <span className="referee-phone">{referee.phoneNumber}</span>
              </label>
            </div>
          ))}
        </div>
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
