import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tournament } from "../types";
import TournamentCard from "../components/TournamentCard";
import AccountMenu from "../components/AccountMenu";
import { useTournaments } from "../hooks";
import { BrandLogo, Button, Chip, EmptyState, PhotoHeader, SearchInput, Segmented, SkeletonRows, Tag } from "../../../ui";
import "./styles.scss";

type Group = "active" | "upcoming" | "past";

const GROUPS: { value: Group; label: string }[] = [
  { value: "active", label: "Live" },
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
];

// Live · Upcoming · Past; completed and inactive tournaments are past.
const GROUP_OF: Partial<Record<string, Group>> = {
  active: "active",
  upcoming: "upcoming",
  past: "past",
  completed: "past",
  inactive: "past",
};

const sportOf = (tournament: Tournament): string | undefined => tournament.sport || tournament.type || undefined;

// Live and upcoming tournaments soonest first, past ones latest first.
const byDate = (group: Group) => (a: Tournament, b: Tournament) => {
  const dateA = new Date(a.startDate).getTime();
  const dateB = new Date(b.startDate).getTime();
  return group === "past" ? dateB - dateA : dateA - dateB;
};

const Tournaments = () => {
  const navigate = useNavigate();
  const { data: tournaments = [], isLoading: loading, error, refetch } = useTournaments();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  // The tab the user picked; until then it's Live when there are live tournaments, else the first with any.
  const [pickedGroup, setPickedGroup] = useState<Group | null>(null);

  // Get unique sports (or types) from all tournaments
  const tournamentSports = useMemo(
    () => Array.from(new Set(tournaments.map(sportOf).filter((sport): sport is string => !!sport))).sort(),
    [tournaments]
  );

  const handleTournamentSelect = (tournament: Tournament) => {
    navigate(`/tournaments/${tournament.id}/matches?${new URLSearchParams({ name: tournament.name }).toString()}`);
  };

  // Filter tournaments based on search query and sport/type filter (applies to all tabs)
  const filteredTournaments = tournaments.filter((tournament) => {
    const matchesSearch = tournament.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (selectedSports.length > 0) {
      return selectedSports.includes(sportOf(tournament) as string);
    }
    return true;
  });

  const grouped: Record<Group, Tournament[]> = { active: [], upcoming: [], past: [] };
  filteredTournaments.forEach((tournament) => {
    const group = GROUP_OF[tournament.status];
    if (group) grouped[group].push(tournament);
  });
  GROUPS.forEach(({ value }) => grouped[value].sort(byDate(value)));

  const firstWithResults = GROUPS.find(({ value }) => grouped[value].length > 0)?.value;
  const group: Group = pickedGroup ?? (grouped.active.length > 0 ? "active" : firstWithResults ?? "upcoming");

  // Like the old sections that opened to show search results: when a search or a sport leaves the open tab empty,
  // switch to the first tab with results.
  useEffect(() => {
    if (pickedGroup && grouped[pickedGroup].length === 0 && firstWithResults) setPickedGroup(firstWithResults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, selectedSports]);

  const toggleSport = (sport: string) => {
    setSelectedSports((prev) => (prev.includes(sport) ? prev.filter((s) => s !== sport) : [...prev, sport]));
  };

  const groupLabel = GROUPS.find(({ value }) => value === group)?.label ?? "";

  const renderBody = () => {
    if (loading) {
      return (
        <div className="tournaments-page__state">
          <SkeletonRows rows={3} />
        </div>
      );
    }

    if (error) {
      return (
        <div className="tournaments-page__state">
          <EmptyState
            icon="alert"
            title="Failed to load tournaments"
            body="Please try again."
            action={<Button onClick={() => refetch()}>Retry</Button>}
          />
        </div>
      );
    }

    if (tournaments.length === 0) {
      return (
        <div className="tournaments-page__state">
          <EmptyState
            icon="calendar"
            title="No assigned tournaments"
            body="You don't have any assigned matches in tournaments yet. Check back when you're assigned to referee matches."
          />
        </div>
      );
    }

    return (
      <>
        <div className="tournaments-page__search">
          <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search tournaments by name" />
        </div>

        <div className="tournaments-page__seg">
          <Segmented
            ariaLabel="Tournaments"
            options={GROUPS.map(({ value, label }) => ({ value, label, count: grouped[value].length }))}
            value={group}
            onChange={(value) => setPickedGroup(value as Group)}
          />
        </div>

        {tournamentSports.length > 0 && (
          <div className="tournaments-page__chips" role="group" aria-label="Sports">
            <Chip className="ui-chip--card" selected={selectedSports.length === 0} onClick={() => setSelectedSports([])}>
              All
            </Chip>
            {tournamentSports.map((sport) => (
              <Chip
                key={sport}
                className="ui-chip--card"
                selected={selectedSports.includes(sport)}
                onClick={() => toggleSport(sport)}
              >
                {sport}
              </Chip>
            ))}
          </div>
        )}

        {searchQuery && filteredTournaments.length === 0 ? (
          <div className="tournaments-page__state">
            <EmptyState
              icon="search"
              title={`No tournaments found matching "${searchQuery}"`}
              body="Try adjusting your search terms"
              action={<Button onClick={() => setSearchQuery("")}>Clear Search</Button>}
            />
          </div>
        ) : grouped[group].length === 0 ? (
          <div className="tournaments-page__state">
            <EmptyState icon="calendar" title={`No ${groupLabel.toLowerCase()} tournaments`} />
          </div>
        ) : (
          <div className="tournaments-page__grid">
            {grouped[group].map((tournament) => (
              <TournamentCard key={tournament.id} tournament={tournament} onSelect={handleTournamentSelect} />
            ))}
          </div>
        )}
      </>
    );
  };

  return (
    <div className="tournaments-page">
      {/* Over the photo, outside its clipped frame so the account panel can drop below it. */}
      <div className="tournaments-page__topbar">
        <BrandLogo className="tournaments-page__logo" />
        <AccountMenu />
      </div>

      <PhotoHeader className="tournaments-page__top">
        <div className="tournaments-page__hero">
          <Tag tone="orange" className="tournaments-page__eyebrow">
            Referee portal
          </Tag>
          <h1 className="tournaments-page__title">Tournaments</h1>
        </div>
      </PhotoHeader>

      <main className="tournaments-page__body">{renderBody()}</main>
    </div>
  );
};

export default Tournaments;
