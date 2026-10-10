import React, { useMemo } from "react";
import { Match } from "../../types/match";
import { groupMatchesBySlot, MatchTab, sortByCourt, TimelineGroup } from "../../utils/timeline";
import MatchRow from "./MatchRow";
import "./MatchesTimeline.scss";

interface MatchesTimelineProps {
  matches: Match[];
  tab: MatchTab;
  /** Day = all: a date header on the first slot of each day. */
  showDates: boolean;
  onOpen: (match: Match) => void;
}

/**
 * The matches under time headers (mockup `.slot`): Up next in time order, Done newest first, each with date headers
 * when every day is shown. Live is one "Now" group, court by court.
 */
const MatchesTimeline: React.FC<MatchesTimelineProps> = ({ matches, tab, showDates, onOpen }) => {
  const groups: TimelineGroup[] = useMemo(
    () =>
      tab === "live"
        ? [{ key: "now", label: "Now", matches: sortByCourt(matches) }]
        : groupMatchesBySlot(matches, { showDates, descending: tab === "done" }),
    [matches, tab, showDates]
  );

  return (
    <div className="matches-timeline">
      {groups.map((group) => (
        <section key={group.key} className="matches-timeline__group">
          {group.dateLabel ? <h2 className="matches-timeline__day">{group.dateLabel}</h2> : null}
          <h2 className="matches-timeline__slot">
            <b>{group.label}</b>
          </h2>
          <ul className="matches-timeline__rows">
            {group.matches.map((match) => (
              <li key={match.id} className="matches-timeline__item">
                <MatchRow match={match} onOpen={onOpen} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};

export default MatchesTimeline;
