import React, { useMemo } from "react";
import { Match } from "../../types/match";
import { courtLabels, groupLiveMatches, groupMatchesBySlot, MatchTab, TimelineGroup } from "../../utils/timeline";
import MatchRow from "./MatchRow";
import "./MatchesTimeline.scss";

interface MatchesTimelineProps {
  matches: Match[];
  tab: MatchTab;
  /** Day = all: a date header on the first slot of each day. */
  showDates: boolean;
  /** The tournament's courts, so two of them never get the same short label on the rows. */
  courts?: string[];
  onOpen: (match: Match) => void;
  /** Full access: holding a row starts select mode with it. */
  onLongPress?: (match: Match) => void;
  /** Select mode: rows are checkboxes; tapping one toggles it. */
  selecting?: boolean;
  selectedIds?: Set<string>;
  onToggle?: (match: Match) => void;
}

/**
 * The matches under time headers (mockup `.slot`): Up next in time order, Done newest first, each with date headers
 * when every day is shown. Live is one "Now" group, court by court (then, with every day shown, any match from an
 * earlier day that was never closed, under its day).
 */
const MatchesTimeline: React.FC<MatchesTimelineProps> = ({
  matches,
  tab,
  showDates,
  courts = [],
  onOpen,
  onLongPress,
  selecting = false,
  selectedIds,
  onToggle,
}) => {
  const groups: TimelineGroup[] = useMemo(
    () =>
      tab === "live"
        ? groupLiveMatches(matches, { showDates })
        : groupMatchesBySlot(matches, { showDates, descending: tab === "done" }),
    [matches, tab, showDates]
  );
  const courtLabel = useMemo(() => courtLabels([...courts, ...matches.map((match) => match.venue)]), [courts, matches]);

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
                <MatchRow
                  match={match}
                  court={courtLabel(match.venue)}
                  onOpen={onOpen}
                  onLongPress={onLongPress}
                  selecting={selecting}
                  selected={selectedIds?.has(match.id) ?? false}
                  onToggle={onToggle}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};

export default MatchesTimeline;
