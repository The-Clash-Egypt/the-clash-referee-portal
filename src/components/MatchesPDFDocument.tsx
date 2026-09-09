import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { Match, sideDisplayName } from "../features/matches/types/match";
import { PDF_FONT_FAMILY, registerPdfFonts } from "../utils/pdfFonts";
import { UNASSIGNED_VENUE_LABEL, groupMatchesByVenue, shouldGroupByVenue } from "../utils/venueGrouping";
import {
  SCORE_CELL_HEIGHT,
  SCORE_GRID_BORDER,
  ScoreCell,
  ScoreDrafts,
  isCellWinner,
  scoreCellWidth,
  scoreCellsFor,
} from "../utils/matchScoreCells";
import {
  dayKey,
  formatClock,
  headerCategory,
  shouldLabelCategories,
  formatDayLabel,
  formatMembers,
  formatReferees,
  matchIsLive,
  printedOnLabel,
  sheetMeta,
} from "../utils/matchSheetFormat";

registerPdfFonts();

// Brand tokens, mirroring src/styles/colors.scss.
const BRAND = "#004aad";
const BRAND_MUTED = "#a9c4e8";
const LIVE = "#fcc353";
const INK = "#111827";
const INK_SOFT = "#374151";
const MUTED = "#6b7280";
const FAINT = "#9ca3af";
const RULE = "#e5e7eb";
const RULE_STRONG = "#cbd5e1";
const WASH = "#f9fafb";
const DAY_WASH = "#eef2f7";

const PAGE_X = 34;
const HEADER_HEIGHT = 96;
const RAIL_WIDTH = 70;
const SCORE_WIDTH = 150;

const styles = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT_FAMILY,
    backgroundColor: "#ffffff",
    color: INK,
    paddingTop: HEADER_HEIGHT,
    paddingBottom: 38,
  },

  // Running header: repeats on every page so a sheet torn off mid-section
  // still names its court.
  header: { position: "absolute", top: 0, left: 0, right: 0 },
  band: { backgroundColor: BRAND, paddingHorizontal: PAGE_X, paddingTop: 15, paddingBottom: 13 },
  bandTitle: { fontSize: 22, fontWeight: "bold", color: "#ffffff" },
  bandMeta: { flexDirection: "row", marginTop: 5 },
  bandMetaItem: { fontSize: 8.5, color: BRAND_MUTED, marginRight: 14 },

  columnHeader: {
    flexDirection: "row",
    paddingHorizontal: PAGE_X,
    paddingTop: 6,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: RULE_STRONG,
    backgroundColor: "#ffffff",
  },
  columnLabel: { fontSize: 7.5, color: MUTED },

  dayRow: {
    paddingHorizontal: PAGE_X,
    paddingVertical: 4,
    backgroundColor: DAY_WASH,
    borderBottomWidth: 0.75,
    borderBottomColor: RULE_STRONG,
  },
  dayText: { fontSize: 8.5, fontWeight: "bold", color: BRAND },

  row: {
    flexDirection: "row",
    paddingHorizontal: PAGE_X,
    paddingVertical: 9,
    borderBottomWidth: 0.75,
    borderBottomColor: RULE,
  },
  rowAlt: { backgroundColor: WASH },
  rowLive: { borderLeftWidth: 3, borderLeftColor: LIVE, paddingLeft: PAGE_X - 3 },

  rail: { width: RAIL_WIDTH },
  matchNumber: { fontSize: 8.5, fontWeight: "bold", color: FAINT },
  time: { fontSize: 11.5, fontWeight: "bold", color: INK, marginTop: 2 },
  round: { fontSize: 7.5, color: MUTED, marginTop: 2 },
  category: { fontSize: 7.5, color: FAINT, marginTop: 2 },

  fixture: { flex: 1, paddingRight: 12 },
  teamName: { fontSize: 10.5, fontWeight: "bold", color: INK },
  teamMembers: { fontSize: 7.5, color: INK_SOFT, marginTop: 1.5 },
  versus: { fontSize: 7.5, color: FAINT, marginVertical: 3 },
  refereeLine: { flexDirection: "row", marginTop: 6 },
  refereeLabel: { fontSize: 7.5, color: FAINT, marginRight: 6 },
  refereeNames: { fontSize: 8, color: INK_SOFT, flex: 1 },

  scoreColumn: { width: SCORE_WIDTH, alignItems: "flex-end" },
  grid: { borderWidth: SCORE_GRID_BORDER, borderColor: RULE_STRONG, backgroundColor: "#ffffff" },
  gridRow: { flexDirection: "row", borderBottomWidth: SCORE_GRID_BORDER, borderBottomColor: RULE_STRONG },
  gridRowLast: { borderBottomWidth: 0 },
  cell: {
    height: SCORE_CELL_HEIGHT,
    borderRightWidth: SCORE_GRID_BORDER,
    borderRightColor: RULE_STRONG,
    alignItems: "center",
    justifyContent: "center",
  },
  cellLast: { borderRightWidth: 0 },
  cellText: { fontSize: 9, color: INK },
  cellTextWinner: { fontSize: 9, color: INK, fontWeight: "bold" },
  result: { fontSize: 11, fontWeight: "bold", color: BRAND, marginTop: 4 },
  scoreCaption: { fontSize: 7.5, color: FAINT, marginTop: 4 },

  empty: { paddingHorizontal: PAGE_X, paddingTop: 40 },
  emptyTitle: { fontSize: 12, fontWeight: "bold", color: INK_SOFT },
  emptyText: { fontSize: 9, color: MUTED, marginTop: 4 },

  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: PAGE_X,
    paddingTop: 8,
    paddingBottom: 12,
    borderTopWidth: 0.75,
    borderTopColor: RULE,
  },
  footerText: { fontSize: 7.5, color: FAINT },
});

const ScoreBlock: React.FC<{ match: Match; draft?: ScoreCell[] }> = ({ match, draft }) => {
  const cells = scoreCellsFor(match, draft);
  const bestOf = Math.max(match.bestOf || 1, 1);
  const hasResult = match.homeScore !== undefined && match.awayScore !== undefined;
  const width = scoreCellWidth(cells.length);

  const cellStyle = (index: number) =>
    index === cells.length - 1 ? [styles.cell, styles.cellLast, { width }] : [styles.cell, { width }];
  const textStyle = (value: number | null, other: number | null) =>
    isCellWinner(value, other) ? styles.cellTextWinner : styles.cellText;

  return (
    <View style={styles.scoreColumn}>
      <View style={styles.grid}>
        <View style={styles.gridRow}>
          {cells.map((cell, index) => (
            <View key={`home-${cell.gameNumber}`} style={cellStyle(index)}>
              <Text style={textStyle(cell.home, cell.away)}>{cell.home ?? " "}</Text>
            </View>
          ))}
        </View>
        <View style={[styles.gridRow, styles.gridRowLast]}>
          {cells.map((cell, index) => (
            <View key={`away-${cell.gameNumber}`} style={cellStyle(index)}>
              <Text style={textStyle(cell.away, cell.home)}>{cell.away ?? " "}</Text>
            </View>
          ))}
        </View>
      </View>
      {match.isCompleted && hasResult ? (
        <Text style={styles.result}>
          {match.homeScore} – {match.awayScore}
        </Text>
      ) : (
        <Text style={styles.scoreCaption}>Best of {bestOf}</Text>
      )}
    </View>
  );
};

const MatchRow: React.FC<{
  match: Match;
  position: number;
  shade: boolean;
  draft?: ScoreCell[];
  showCategory?: boolean;
}> = ({ match, position, shade, draft, showCategory }) => {
  const homeMembers = formatMembers(match.homeTeamMembers);
  const awayMembers = formatMembers(match.awayTeamMembers);

  const rowStyle = [
    styles.row,
    ...(shade ? [styles.rowAlt] : []),
    ...(matchIsLive(match) ? [styles.rowLive] : []),
  ];

  return (
    <View style={rowStyle} wrap={false}>
      <View style={styles.rail}>
        <Text style={styles.matchNumber}>{position}</Text>
        <Text style={styles.time}>{formatClock(match.startTime)}</Text>
        {match.round ? <Text style={styles.round}>{match.round}</Text> : null}
        {showCategory && match.categoryName ? (
          <Text style={styles.category}>{match.categoryName}</Text>
        ) : null}
      </View>

      <View style={styles.fixture}>
        <Text style={styles.teamName}>{sideDisplayName(match.homeTeamName, match.homeTeam2Name)}</Text>
        {homeMembers ? <Text style={styles.teamMembers}>{homeMembers}</Text> : null}
        <Text style={styles.versus}>v</Text>
        <Text style={styles.teamName}>{sideDisplayName(match.awayTeamName, match.awayTeam2Name)}</Text>
        {awayMembers ? <Text style={styles.teamMembers}>{awayMembers}</Text> : null}
        <View style={styles.refereeLine}>
          <Text style={styles.refereeLabel}>Referees</Text>
          <Text style={styles.refereeNames}>{formatReferees(match.referees)}</Text>
        </View>
      </View>

      <ScoreBlock match={match} draft={draft} />
    </View>
  );
};

const MatchSchedule: React.FC<{
  matches: Match[];
  scoreDrafts?: ScoreDrafts;
  showCategory?: boolean;
}> = ({ matches, scoreDrafts, showCategory }) => {
  let lastDay = "";

  return (
    <View>
      {matches.map((match, index) => {
        const key = dayKey(match);
        const startsNewDay = key !== lastDay;
        lastDay = key;

        return (
          <View key={match.id}>
            {startsNewDay ? (
              <View style={styles.dayRow}>
                <Text style={styles.dayText}>{formatDayLabel(match.startTime)}</Text>
              </View>
            ) : null}
            <MatchRow
              match={match}
              position={index + 1}
              shade={index % 2 === 1}
              draft={scoreDrafts?.[match.id]}
              showCategory={showCategory}
            />
          </View>
        );
      })}
    </View>
  );
};

interface ReportPageProps {
  title: string;
  meta: string[];
  matches: Match[];
  footerLabel: string;
  scoreDrafts?: ScoreDrafts;
  showCategory?: boolean;
}

const ReportPage: React.FC<ReportPageProps> = ({
  title,
  meta,
  matches,
  footerLabel,
  scoreDrafts,
  showCategory,
}) => (
  <Page size="A4" style={styles.page}>
    <View style={styles.header} fixed>
      <View style={styles.band}>
        <Text style={styles.bandTitle}>{title}</Text>
        <View style={styles.bandMeta}>
          {meta.map((item) => (
            <Text key={item} style={styles.bandMetaItem}>
              {item}
            </Text>
          ))}
        </View>
      </View>
      <View style={styles.columnHeader}>
        <Text style={[styles.columnLabel, { width: RAIL_WIDTH }]}>Time</Text>
        <Text style={[styles.columnLabel, { flex: 1 }]}>Match</Text>
        <Text style={[styles.columnLabel, { width: SCORE_WIDTH, textAlign: "right" }]}>Score</Text>
      </View>
    </View>

    {matches.length === 0 ? (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Nothing scheduled</Text>
        <Text style={styles.emptyText}>No matches match the selected filters.</Text>
      </View>
    ) : (
      <MatchSchedule matches={matches} scoreDrafts={scoreDrafts} showCategory={showCategory} />
    )}

    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>{footerLabel}</Text>
      <Text style={styles.footerText}>{printedOnLabel()}</Text>
      <Text
        style={styles.footerText}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
      />
    </View>
  </Page>
);

interface MatchesPDFDocumentProps {
  matches: Match[];
  tournamentName: string;
  categoryName?: string;
  venueName?: string;
  refereeName?: string;
  teamName?: string;
  formatName?: string;
  viewType: "venue" | "referee" | "team" | "general";
  /** Scores typed into the preview but not yet saved. */
  scoreDrafts?: ScoreDrafts;
}

const MatchesPDFDocument: React.FC<MatchesPDFDocumentProps> = ({
  matches,
  tournamentName,
  categoryName,
  venueName,
  refereeName,
  teamName,
  formatName,
  viewType,
  scoreDrafts,
}) => {
  // Decided once for the whole report so every sheet agrees: the category goes
  // either in each header or on each row, never both and never neither.
  const showCategory = shouldLabelCategories(matches);
  const sheetCategory = headerCategory(categoryName, matches);

  // Venue and general reports read as a court sheet: one venue per page.
  if (shouldGroupByVenue(viewType)) {
    const groups = groupMatchesByVenue(matches);

    return (
      <Document title={`${tournamentName} matches`} author="The Clash Referee Portal">
        {groups.length === 0 ? (
          <ReportPage
            title={venueName || "All venues"}
            meta={sheetMeta(tournamentName, sheetCategory, formatName, 0)}
            matches={[]}
            footerLabel={tournamentName}
            scoreDrafts={scoreDrafts}
            showCategory={showCategory}
          />
        ) : (
          groups.map((group) => (
            <ReportPage
              key={group.venue}
              title={group.venue === UNASSIGNED_VENUE_LABEL ? UNASSIGNED_VENUE_LABEL : group.venue}
              meta={sheetMeta(tournamentName, sheetCategory, formatName, group.matches.length)}
              matches={group.matches}
              footerLabel={tournamentName}
              scoreDrafts={scoreDrafts}
              showCategory={showCategory}
            />
          ))
        )}
      </Document>
    );
  }

  // Referee and team reports stay a single chronological run across courts.
  const subject = viewType === "referee" ? refereeName : teamName;

  return (
    <Document title={`${tournamentName} matches`} author="The Clash Referee Portal">
      <ReportPage
        title={subject || "Matches"}
        meta={sheetMeta(tournamentName, sheetCategory, formatName, matches.length)}
        matches={matches}
        footerLabel={tournamentName}
        scoreDrafts={scoreDrafts}
        showCategory={showCategory}
      />
    </Document>
  );
};

export default MatchesPDFDocument;
