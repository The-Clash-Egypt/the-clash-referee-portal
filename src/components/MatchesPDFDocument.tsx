import React from "react";
import { Document, Page, Path, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import { Match, isFixedPointsFormat, sideDisplayName } from "../features/matches/types/match";
import { PDF_FONT_FAMILY, registerPdfFonts } from "../utils/pdfFonts";
import { shouldGroupByVenue } from "../utils/venueGrouping";
import {
  SCORE_BOX_GAP,
  SCORE_CELL_HEIGHT,
  ScoreCell,
  ScoreDrafts,
  isCellWinner,
  scoreCellWidth,
  scoreCellsFor,
} from "../utils/matchScoreCells";
import { QrLink, QrLinks, SHEET, SheetPage, paginateSheets, sheetSubjectTitle } from "../utils/matchSheetLayout";
import {
  CardMetaOptions,
  cardMetaItems,
  cardRuleLabel,
  formatMembers,
  formatReferees,
  formatValidUntil,
  headerCategory,
  matchIsLive,
  printedOnLabel,
  qrCaption,
  reportSpansMultipleDays,
  sheetMeta,
  shouldLabelCategories,
} from "../utils/matchSheetFormat";
import { qrModules, qrPathData } from "../utils/qrMatrix";

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
const CARD_BORDER = 0.75;

const styles = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT_FAMILY,
    backgroundColor: "#ffffff",
    color: INK,
    paddingTop: SHEET.headerHeight + SHEET.bodyPaddingTop,
    paddingBottom: SHEET.footerHeight,
    paddingHorizontal: SHEET.marginX,
  },

  // Header band: repeats on every page so a sheet taken off the clipboard still names its court.
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: SHEET.headerHeight,
    justifyContent: "center",
    paddingHorizontal: SHEET.marginX,
    backgroundColor: BRAND,
  },
  bandTitle: { fontSize: 18, fontWeight: "bold", color: "#ffffff" },
  bandMeta: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  bandMetaItem: { fontSize: 8.5, color: BRAND_MUTED, marginRight: 14 },

  card: {
    flexDirection: "row",
    height: SHEET.cardHeight,
    marginBottom: SHEET.cardGap,
    padding: SHEET.cardPadding,
    borderWidth: CARD_BORDER,
    borderColor: RULE_STRONG,
    borderRadius: 4,
  },
  // Gold edge for a match already under way; padding compensates so nothing shifts.
  cardLive: {
    borderLeftWidth: SHEET.liveEdge,
    borderLeftColor: LIVE,
    paddingLeft: SHEET.cardPadding - SHEET.liveEdge + CARD_BORDER,
  },

  main: { flex: 1, flexDirection: "column", paddingRight: 12 },
  topLine: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  meta: { flex: 1, paddingRight: 8, fontSize: 8.5, color: MUTED },
  rule: { fontSize: 8.5, color: MUTED },
  ruleFinal: { fontSize: 9, fontWeight: "bold", color: BRAND },

  labels: { flexDirection: "row", paddingLeft: SHEET.nameWidth, marginBottom: 3 },
  label: { fontSize: 7, color: FAINT, textAlign: "center" },

  team: { flexDirection: "row", alignItems: "center", minHeight: 36 },
  name: { width: SHEET.nameWidth, paddingRight: 10, justifyContent: "center" },
  teamName: { fontSize: 11, fontWeight: "bold", color: INK, maxLines: 1, textOverflow: "ellipsis" },
  members: { marginTop: 1.5, fontSize: 7.5, color: INK_SOFT, maxLines: 2, textOverflow: "ellipsis" },
  boxes: { flexDirection: "row" },
  box: {
    height: SCORE_CELL_HEIGHT,
    borderWidth: 0.75,
    borderColor: RULE_STRONG,
    borderRadius: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  boxText: { fontSize: 11, color: INK },
  boxTextWinner: { fontSize: 11, color: INK, fontWeight: "bold" },
  divider: { height: 0.75, marginVertical: 4, backgroundColor: RULE },

  spacer: { flexGrow: 1 },
  referee: { flexDirection: "row" },
  refereeLabel: { marginRight: 6, fontSize: 7.5, color: FAINT },
  refereeNames: { flex: 1, fontSize: 8, color: INK_SOFT, maxLines: 1, textOverflow: "ellipsis" },

  qrColumn: { width: SHEET.qrColumnWidth, alignItems: "center", justifyContent: "center" },
  qrSlot: { width: SHEET.qrSize, height: SHEET.qrSize },
  qrCaption: { marginTop: 6, fontSize: 8, fontWeight: "bold", color: INK_SOFT },
  qrExpiry: { marginTop: 2, fontSize: 7, color: FAINT },

  empty: { paddingTop: 28 },
  emptyTitle: { fontSize: 12, fontWeight: "bold", color: INK_SOFT },
  emptyText: { marginTop: 4, fontSize: 9, color: MUTED },

  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET.footerHeight,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SHEET.marginX,
    borderTopWidth: 0.75,
    borderTopColor: RULE,
  },
  footerText: { fontSize: 7.5, color: FAINT },
});

/** A vector QR: one path of module-unit rectangles, crisp at any print size. */
const QrCode: React.FC<{ url: string }> = ({ url }) => {
  const modules = qrModules(url, "M");
  const size = modules.length;
  return (
    <Svg width={SHEET.qrSize} height={SHEET.qrSize} viewBox={`0 0 ${size} ${size}`}>
      <Path d={qrPathData(modules)} fill={INK} />
    </Svg>
  );
};

const boxSpacing = (index: number, count: number) => (index === count - 1 ? 0 : SCORE_BOX_GAP);

/** One team: its name column, then its own score boxes on the same line. */
const TeamLine: React.FC<{
  name: string;
  members: string;
  cells: ScoreCell[];
  side: "home" | "away";
  boxWidth: number;
}> = ({ name, members, cells, side, boxWidth }) => (
  <View style={styles.team}>
    <View style={styles.name}>
      <Text style={styles.teamName}>{name}</Text>
      {members ? <Text style={styles.members}>{members}</Text> : null}
    </View>
    <View style={styles.boxes}>
      {cells.map((cell, index) => {
        const value = cell[side];
        const other = side === "home" ? cell.away : cell.home;
        return (
          <View
            key={`${side}-${cell.gameNumber}`}
            style={[styles.box, { width: boxWidth, marginRight: boxSpacing(index, cells.length) }]}
          >
            <Text style={isCellWinner(value, other) ? styles.boxTextWinner : styles.boxText}>{value ?? " "}</Text>
          </View>
        );
      })}
    </View>
  </View>
);

const MatchSheetCard: React.FC<{
  match: Match;
  position: number;
  draft?: ScoreCell[];
  qr?: QrLink;
  meta: CardMetaOptions;
}> = ({ match, position, draft, qr, meta }) => {
  const cells = scoreCellsFor(match, draft);
  const boxWidth = scoreCellWidth(cells.length);
  const fixedPoints = isFixedPointsFormat(match.formatType);

  return (
    <View style={matchIsLive(match) ? [styles.card, styles.cardLive] : styles.card} wrap={false}>
      <View style={styles.main}>
        <View style={styles.topLine}>
          <Text style={styles.meta}>{cardMetaItems(match, position, meta).join("  ·  ")}</Text>
          <Text style={match.isCompleted ? styles.ruleFinal : styles.rule}>{cardRuleLabel(match)}</Text>
        </View>

        <View style={styles.labels}>
          {cells.map((cell, index) => (
            <Text
              key={cell.gameNumber}
              style={[styles.label, { width: boxWidth, marginRight: boxSpacing(index, cells.length) }]}
            >
              {fixedPoints ? "Pts" : `G${cell.gameNumber}`}
            </Text>
          ))}
        </View>

        <TeamLine
          name={sideDisplayName(match.homeTeamName, match.homeTeam2Name)}
          members={formatMembers(match.homeTeamMembers)}
          cells={cells}
          side="home"
          boxWidth={boxWidth}
        />
        <View style={styles.divider} />
        <TeamLine
          name={sideDisplayName(match.awayTeamName, match.awayTeam2Name)}
          members={formatMembers(match.awayTeamMembers)}
          cells={cells}
          side="away"
          boxWidth={boxWidth}
        />

        <View style={styles.spacer} />
        <View style={styles.referee}>
          <Text style={styles.refereeLabel}>Referees</Text>
          <Text style={styles.refereeNames}>{formatReferees(match.referees)}</Text>
        </View>
      </View>

      <View style={styles.qrColumn}>
        {qr ? (
          <>
            <QrCode url={qr.url} />
            <Text style={styles.qrCaption}>{qrCaption(match)}</Text>
            <Text style={styles.qrExpiry}>Valid until {formatValidUntil(qr.expiresAt)}</Text>
          </>
        ) : (
          <View style={styles.qrSlot} />
        )}
      </View>
    </View>
  );
};

const SheetPageView: React.FC<{
  page: SheetPage;
  meta: string[];
  footerLabel: string;
  scoreDrafts?: ScoreDrafts;
  qrLinks?: QrLinks;
  cardMeta: CardMetaOptions;
}> = ({ page, meta, footerLabel, scoreDrafts, qrLinks, cardMeta }) => (
  <Page size="A4" style={styles.page}>
    <View style={styles.header} fixed>
      <Text style={styles.bandTitle}>{page.title}</Text>
      <View style={styles.bandMeta}>
        {meta.map((item, index) => (
          <Text key={`${index}-${item}`} style={styles.bandMetaItem}>
            {item}
          </Text>
        ))}
      </View>
    </View>

    {page.matches.length === 0 ? (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Nothing scheduled</Text>
        <Text style={styles.emptyText}>No matches match the selected filters.</Text>
      </View>
    ) : (
      page.matches.map((match, index) => (
        <MatchSheetCard
          key={match.id}
          match={match}
          position={page.firstPosition + index}
          draft={scoreDrafts?.[match.id]}
          qr={qrLinks?.[match.id]}
          meta={cardMeta}
        />
      ))
    )}

    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>{footerLabel}</Text>
      <Text style={styles.footerText}>{printedOnLabel()}</Text>
      <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
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
  /** Guest links for the match QRs, keyed by match id. Matches without one print an empty slot. */
  qrLinks?: QrLinks;
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
  qrLinks,
}) => {
  // Decided once per report so every card agrees.
  const sheetCategory = headerCategory(categoryName, matches);
  const cardMeta: CardMetaOptions = {
    showCategory: shouldLabelCategories(matches),
    showDate: reportSpansMultipleDays(matches),
    showCourt: !shouldGroupByVenue(viewType),
  };
  const pages = paginateSheets(matches, viewType, sheetSubjectTitle(viewType, { venueName, refereeName, teamName }));

  return (
    <Document title={`${tournamentName} matches`} author="The Clash Referee Portal">
      {pages.map((page) => (
        <SheetPageView
          key={page.key}
          page={page}
          meta={sheetMeta(tournamentName, sheetCategory, formatName, page.groupSize)}
          footerLabel={tournamentName}
          scoreDrafts={scoreDrafts}
          qrLinks={qrLinks}
          cardMeta={cardMeta}
        />
      ))}
    </Document>
  );
};

export default MatchesPDFDocument;
