import React, { useState } from "react";
import { useSelector } from "react-redux";
import { Link, useParams } from "react-router-dom";
import { RootState } from "../../store";
import { Button, Icon, Spinner } from "../../ui";
import type { IconName } from "../../ui";
import Drawer from "../shared/components/Drawer";
import { hasFullAccess } from "../auth/permissions";
import { useLogout } from "../auth/useLogout";
import { ExportViewType, useMatchActions } from "../matches/hooks/useMatchActions";
import { MatchFilterState, useMatchFilters } from "../matches/hooks/useMatchFilters";
import { FilterOptions } from "../matches/types/match";
import { formatOption, nameForValue } from "../matches/utils/filterOptions";
import { formatDayLabel } from "../matches/utils/timeline";
import { useDayDurations } from "./useDayDurations";
import { useTournamentInfo } from "./useTournamentInfo";
import "./MorePage.scss";

const MATCH_LISTS: { type: ExportViewType; label: string; icon: IconName }[] = [
  { type: "venue", label: "By court", icon: "courts" },
  { type: "referee", label: "By referee", icon: "person" },
  { type: "team", label: "By team", icon: "team" },
  { type: "general", label: "Everything", icon: "list" },
];

/** The match sheets' report type, as the old Preview PDF button picked it from the filters. */
const sheetsType = (filters: MatchFilterState): ExportViewType => {
  if (filters.venues.length > 0) return "venue";
  if (filters.team !== "all") return "team";
  if (filters.referee !== "all") return "referee";
  return "general";
};

/** The matches filters a print takes (the ones the Matches tab shows as chips, and its search). */
const filterLabels = (filters: MatchFilterState, options: FilterOptions): string[] => {
  const labels: string[] = [];
  if (filters.date !== "all") labels.push(formatDayLabel(filters.date) || filters.date);
  if (filters.category !== "all") labels.push(filters.category);
  if (filters.format !== "all") {
    const format = options.formats.map((f) => formatOption(f)).find((f) => f.value === filters.format);
    labels.push(format?.label ?? filters.format);
  }
  if (filters.round !== "all") labels.push(filters.round);
  labels.push(...filters.venues);
  if (filters.team !== "all") labels.push(nameForValue(options.teams, filters.team));
  if (filters.referee !== "all") labels.push(nameForValue(options.referees, filters.referee));
  if (filters.search) labels.push(`“${filters.search}”`);
  return labels;
};

const SectionHeading = ({ id, children }: { id: string; children: React.ReactNode }) => (
  <h2 className="more-page__heading" id={id}>
    <span className="more-page__blade" aria-hidden="true" />
    {children}
  </h2>
);

const RowIcon = ({ name }: { name: IconName }) => (
  <span className="more-page__icon" aria-hidden="true">
    <Icon name={name} size={16} />
  </span>
);

/**
 * The More tab (mockup rest-of-portal.html phone 4): everything that isn't courtside. With full access: Print (the QR
 * match sheets and the match lists, today's printable export with the Matches tab's filters) and each day's duration.
 * Everyone: switch tournament, log out.
 */
const MorePage: React.FC = () => {
  const { id = "" } = useParams();
  const user = useSelector((state: RootState) => state.user.user);
  const fullAccess = hasFullAccess(user);
  const logout = useLogout();
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");

  const info = useTournamentInfo(id);
  // The tab links carry the Matches tab's filters here; a print takes them (not the Live / Up next / Done tab).
  const { filters } = useMatchFilters();
  const durations = useDayDurations(id);
  const { exportView } = useMatchActions(id);
  const [listsOpen, setListsOpen] = useState(false);

  const print = (type: ExportViewType) =>
    exportView(type, filters, durations.filterOptions, { tournamentName: info.name });
  const printList = (type: ExportViewType) => {
    print(type);
    setListsOpen(false);
  };
  const filtersInForce = filterLabels(filters, durations.filterOptions).join(" · ");

  let durationRows: React.ReactNode;
  if (durations.isLoading) {
    durationRows = (
      <li className="more-page__row more-page__row--static">
        <Spinner size={22} />
      </li>
    );
  } else if (durations.isError) {
    durationRows = (
      <li className="more-page__row more-page__row--static">
        <span className="more-page__text more-page__text--muted">An error occurred while loading data</span>
        <Button variant="tint" size="sm" icon="refresh" onClick={durations.refetch}>
          Try again
        </Button>
      </li>
    );
  } else if (durations.rows.length === 0) {
    durationRows = (
      <li className="more-page__row more-page__row--static">
        <span className="more-page__text more-page__text--muted">No day durations yet</span>
      </li>
    );
  } else {
    durationRows = durations.rows.map((row) => (
      <li key={row.key} className="more-page__row more-page__row--static">
        <span className="more-page__text">
          {row.day}
          <small className="more-page__sub">{row.range}</small>
        </span>
        <span className="more-page__duration">{row.duration}</span>
      </li>
    ));
  }

  return (
    <div className="more-page">
      {fullAccess ? (
        <>
          <section className="more-page__section" aria-labelledby="more-page-print">
            <SectionHeading id="more-page-print">Print</SectionHeading>
            <ul className="more-page__menu">
              <li>
                <button type="button" className="more-page__row" onClick={() => print(sheetsType(filters))}>
                  <RowIcon name="qr" />
                  <span className="more-page__text">
                    Match sheets with QR codes
                    <small className="more-page__sub">PDF, 3 matches per page</small>
                  </span>
                  <Icon name="chevron-right" size={14} className="more-page__chevron" />
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="more-page__row"
                  aria-haspopup="dialog"
                  onClick={() => setListsOpen(true)}
                >
                  <RowIcon name="list" />
                  <span className="more-page__text">
                    Match lists
                    <small className="more-page__sub">By court, referee or team</small>
                  </span>
                  <Icon name="chevron-right" size={14} className="more-page__chevron" />
                </button>
              </li>
            </ul>
            {filtersInForce ? (
              <p className="more-page__note">
                <Icon name="filter" size={14} />
                <span>Filters from Matches: {filtersInForce}</span>
              </p>
            ) : null}
          </section>

          <section className="more-page__section" aria-labelledby="more-page-durations">
            <SectionHeading id="more-page-durations">Day durations</SectionHeading>
            <ul className="more-page__menu" aria-labelledby="more-page-durations" aria-busy={durations.isLoading}>
              {durationRows}
            </ul>
          </section>
        </>
      ) : null}

      <section className="more-page__section" aria-labelledby="more-page-account">
        <SectionHeading id="more-page-account">Account</SectionHeading>
        <ul className="more-page__menu">
          <li>
            <Link to="/" className="more-page__row">
              <RowIcon name="switch" />
              <span className="more-page__text">Switch tournament</span>
              <Icon name="chevron-right" size={14} className="more-page__chevron" />
            </Link>
          </li>
          <li>
            <button type="button" className="more-page__row" onClick={logout}>
              <RowIcon name="logout" />
              <span className="more-page__text">
                Log out
                {fullName ? <small className="more-page__sub">{fullName}</small> : null}
              </span>
            </button>
          </li>
        </ul>
      </section>

      {fullAccess ? (
        <Drawer
          isOpen={listsOpen}
          onClose={() => setListsOpen(false)}
          title="Match lists"
          subtitle={filtersInForce || undefined}
          className="match-lists-sheet"
        >
          <ul className="more-page__menu match-lists-sheet__menu">
            {MATCH_LISTS.map((list) => (
              <li key={list.type}>
                <button type="button" className="more-page__row" onClick={() => printList(list.type)}>
                  <RowIcon name={list.icon} />
                  <span className="more-page__text">{list.label}</span>
                  <Icon name="chevron-right" size={14} className="more-page__chevron" />
                </button>
              </li>
            ))}
          </ul>
        </Drawer>
      ) : null}
    </div>
  );
};

export default MorePage;
