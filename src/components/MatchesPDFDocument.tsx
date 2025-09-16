import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { Match } from "../features/matches/types/match";

// Use default fonts - React PDF handles Cyrillic better with built-in fonts
// No custom font registration to avoid encoding issues

// Utility function to ensure proper text encoding for Cyrillic characters
const ensureTextEncoding = (text: string | undefined): string => {
  if (!text) return "";

  try {
    // First normalize the text to ensure proper Unicode representation
    let normalized = text.normalize("NFC");

    // Check if the text contains Cyrillic characters
    const hasCyrillic = /[\u0400-\u04FF]/.test(normalized);
    console.log("Text contains Cyrillic:", hasCyrillic, "Text:", normalized);

    if (hasCyrillic) {
      // For Cyrillic text, ensure proper UTF-8 encoding
      normalized = decodeURIComponent(encodeURIComponent(normalized));
    }

    // Remove any control characters that might cause issues
    // eslint-disable-next-line no-control-regex
    normalized = normalized.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");

    return normalized;
  } catch (error) {
    console.warn("Text encoding error:", error, "Original text:", text);
    return text;
  }
};

// Define styles
const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#ffffff",
    padding: 20,
    fontFamily: "Helvetica",
  },
  header: {
    backgroundColor: "#f8fafc",
    padding: 20,
    marginBottom: 20,
    borderBottom: "3px solid #004aad",
    textAlign: "center",
  },
  tournamentTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1a202c",
    marginBottom: 8,
  },
  viewTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#004aad",
    marginBottom: 4,
  },
  categoryTitle: {
    fontSize: 14,
    color: "#4a5568",
    backgroundColor: "#ffffff",
    padding: "4px 12px",
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    alignSelf: "center",
  },
  matchesContainer: {
    marginBottom: 20,
  },
  matchCard: {
    backgroundColor: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  matchHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  matchNumber: {
    backgroundColor: "#004aad",
    color: "#ffffff",
    padding: "4px 8px",
    borderRadius: 12,
    fontSize: 12,
    fontWeight: "bold",
  },
  statusBadge: {
    padding: "2px 8px",
    borderRadius: 12,
    fontSize: 10,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  statusCompleted: {
    backgroundColor: "#d1fae5",
    color: "#065f46",
  },
  statusInProgress: {
    backgroundColor: "#fef3c7",
    color: "#92400e",
  },
  statusUpcoming: {
    backgroundColor: "#dbeafe",
    color: "#1e40af",
  },
  matchInfo: {
    textAlign: "center",
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  infoValue: {
    fontSize: 14,
    color: "#1a202c",
    fontWeight: "normal",
  },
  teamsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 12,
    paddingVertical: 8,
    borderTop: "1px solid #e2e8f0",
    borderBottom: "1px solid #e2e8f0",
    paddingHorizontal: 20,
  },
  teamContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  teamName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1a202c",
    textAlign: "center",
  },
  scoreDisplay: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#004aad",
    padding: "6px 12px",
    border: "2px solid #004aad",
    borderRadius: 4,
    minWidth: 80,
    textAlign: "center",
    alignSelf: "center",
  },
  refereesSection: {
    backgroundColor: "#f3f4f6",
    padding: 8,
    borderRadius: 4,
    borderLeft: "4px solid #6b7280",
    marginBottom: 12,
  },
  refereesText: {
    fontSize: 12,
    color: "#4a5568",
    fontWeight: "normal",
  },
  teamMembersSection: {
    backgroundColor: "#f3f4f6",
    padding: 8,
    borderRadius: 4,
    borderLeft: "4px solid #6b7280",
    marginBottom: 12,
  },
  teamMembersHeader: {
    fontSize: 12,
    color: "#2d3748",
    fontWeight: "bold",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  teamMembersGrid: {
    flexDirection: "row",
    gap: 16,
  },
  teamMembersGroup: {
    flex: 1,
  },
  teamMembersGroupHeader: {
    fontSize: 10,
    color: "#004aad",
    fontWeight: "bold",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  membersList: {
    flexDirection: "column",
    gap: 4,
  },
  memberItem: {
    backgroundColor: "#ffffff",
    padding: 6,
    borderRadius: 4,
    border: "1px solid #e2e8f0",
  },
  memberName: {
    fontSize: 10,
    color: "#1a202c",
    fontWeight: "bold",
    marginBottom: 2,
  },
  memberDetails: {
    fontSize: 8,
    color: "#6b7280",
  },
  moreMembers: {
    fontSize: 8,
    color: "#6b7280",
    fontStyle: "italic",
    textAlign: "center",
    padding: 4,
    backgroundColor: "#f7fafc",
    borderRadius: 3,
  },
  gameScoresSection: {
    borderTop: "1px solid #e2e8f0",
    paddingTop: 8,
  },
  gameScoresHeader: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#2d3748",
    marginBottom: 8,
  },
  gameScoresGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  gameScoreCard: {
    backgroundColor: "#f7fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 4,
    padding: 6,
    minWidth: 120,
    textAlign: "center",
  },
  gameNumber: {
    fontSize: 10,
    color: "#718096",
    fontWeight: "bold",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  gameScore: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#2d3748",
  },
  noMatches: {
    textAlign: "center",
    padding: 40,
    color: "#6c757d",
  },
  noMatchesTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#495057",
    marginBottom: 8,
  },
  noMatchesText: {
    fontSize: 14,
  },
  footer: {
    backgroundColor: "#f8f9fa",
    padding: 16,
    borderTop: "1px solid #dee2e6",
    textAlign: "center",
    marginTop: "auto",
  },
  footerText: {
    fontSize: 12,
    color: "#6c757d",
  },
});

interface MatchesPDFDocumentProps {
  matches: Match[];
  tournamentName: string;
  categoryName?: string;
  venueName?: string;
  refereeName?: string;
  teamName?: string;
  formatName?: string;
  viewType: "venue" | "referee" | "team" | "general";
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
}) => {
  const formatTime = (timeString?: string) => {
    if (!timeString) return "TBD";
    const date = new Date(timeString);
    return ensureTextEncoding(
      date.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    );
  };

  const formatScore = (match: Match) => {
    return match.homeScore !== undefined && match.awayScore !== undefined
      ? `${match.homeScore}-${match.awayScore}`
      : "TBD";
  };

  const getRefereesList = (referees?: any[]) => {
    if (!referees || referees.length === 0) return "Unassigned";
    const refereeNames = referees.map((ref) => ref.fullName || ref.name || "Unknown").join(", ");
    console.log("Original referee names:", refereeNames);
    const encoded = ensureTextEncoding(refereeNames);
    console.log("Encoded referee names:", encoded);
    return encoded;
  };

  const getTeamName = (teamName?: string, fallback: string = "TBD") => {
    const name = teamName || fallback;
    console.log("Original team name:", name);
    const encoded = ensureTextEncoding(name);
    console.log("Encoded team name:", encoded);
    return encoded;
  };

  const getBestOfValue = (match: Match): number => {
    return match.bestOf || 1;
  };

  const getViewTitle = () => {
    const filters = [];

    // Add primary filter based on view type
    switch (viewType) {
      case "venue":
        if (venueName) filters.push(`${venueName}`);
        break;
      case "referee":
        if (refereeName) filters.push(`Referee: ${refereeName}`);
        break;
      case "team":
        if (teamName) filters.push(`Team: ${getTeamName(teamName)}`);
        break;
      default:
        // For general view, show all active filters
        if (venueName) filters.push(`${venueName}`);
        if (refereeName) filters.push(`Referee: ${refereeName}`);
        if (teamName) filters.push(`Team: ${getTeamName(teamName)}`);
        break;
    }

    // Add additional filters
    if (formatName) filters.push(`${formatName}`);

    // If no filters, return default title
    if (filters.length === 0) {
      return "Matches Report";
    }

    // Join all filters with ' - '
    return filters.join(" - ");
  };

  const getStatusStyle = (match: Match) => {
    if (match.isCompleted) return styles.statusCompleted;
    if (match.startTime && new Date(match.startTime) <= new Date()) return styles.statusInProgress;
    return styles.statusUpcoming;
  };

  const getStatusText = (match: Match) => {
    if (match.isCompleted) return "Completed";
    if (match.startTime && new Date(match.startTime) <= new Date()) return "In Progress";
    return "Upcoming";
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.tournamentTitle}>{ensureTextEncoding(tournamentName)}</Text>
          <Text style={styles.viewTitle}>{ensureTextEncoding(getViewTitle())}</Text>
          {categoryName && <Text style={styles.categoryTitle}>{ensureTextEncoding(categoryName)}</Text>}
        </View>

        {/* Matches List */}
        <View style={styles.matchesContainer}>
          {matches.length === 0 ? (
            <View style={styles.noMatches}>
              <Text style={styles.noMatchesTitle}>No Matches Found</Text>
              <Text style={styles.noMatchesText}>No matches found for the selected criteria.</Text>
            </View>
          ) : (
            matches.map((match, index) => (
              <View key={match.id} style={styles.matchCard}>
                {/* Match Header */}
                <View style={styles.matchHeader}>
                  <Text style={styles.matchNumber}>#{index + 1}</Text>
                  <Text style={[styles.statusBadge, getStatusStyle(match)]}>{getStatusText(match)}</Text>
                </View>

                {/* Match Information */}
                <View style={styles.matchInfo}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoValue}>{ensureTextEncoding(match.round || "TBD")}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoValue}>{formatTime(match.startTime)}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoValue}>{ensureTextEncoding(match.venue || "TBD")}</Text>
                  </View>
                  <View style={styles.teamsRow}>
                    <View style={styles.teamContainer}>
                      <Text style={styles.teamName}>{getTeamName(match.homeTeamName)}</Text>
                    </View>
                    <Text style={styles.scoreDisplay}>{formatScore(match)}</Text>
                    <View style={styles.teamContainer}>
                      <Text style={styles.teamName}>{getTeamName(match.awayTeamName)}</Text>
                    </View>
                  </View>
                </View>

                {/* Referees */}
                <View style={styles.refereesSection}>
                  <Text style={styles.refereesText}>Referees: {getRefereesList(match.referees)}</Text>
                </View>

                {/* Team Members */}
                {(match.homeTeamMembers && match.homeTeamMembers.length > 0) ||
                (match.awayTeamMembers && match.awayTeamMembers.length > 0) ? (
                  <View style={styles.teamMembersSection}>
                    <Text style={styles.teamMembersHeader}>Team Members</Text>
                    <View style={styles.teamMembersGrid}>
                      {/* Home Team Members */}
                      {match.homeTeamMembers && match.homeTeamMembers.length > 0 && (
                        <View style={styles.teamMembersGroup}>
                          <Text style={styles.teamMembersGroupHeader}>Home Team ({match.homeTeamMembers.length})</Text>
                          <View style={styles.membersList}>
                            {match.homeTeamMembers.slice(0, 3).map((member, index) => (
                              <View key={member.id} style={styles.memberItem}>
                                <Text style={styles.memberName}>
                                  {ensureTextEncoding(`${member.firstName} ${member.lastName}`)}
                                  {member.isCaptain && " (C)"}
                                </Text>
                                <Text style={styles.memberDetails}>
                                  {ensureTextEncoding(member.nationality)} • {member.gender}
                                </Text>
                              </View>
                            ))}
                            {match.homeTeamMembers.length > 3 && (
                              <Text style={styles.moreMembers}>+{match.homeTeamMembers.length - 3} more</Text>
                            )}
                          </View>
                        </View>
                      )}

                      {/* Away Team Members */}
                      {match.awayTeamMembers && match.awayTeamMembers.length > 0 && (
                        <View style={styles.teamMembersGroup}>
                          <Text style={styles.teamMembersGroupHeader}>Away Team ({match.awayTeamMembers.length})</Text>
                          <View style={styles.membersList}>
                            {match.awayTeamMembers.slice(0, 3).map((member, index) => (
                              <View key={member.id} style={styles.memberItem}>
                                <Text style={styles.memberName}>
                                  {ensureTextEncoding(`${member.firstName} ${member.lastName}`)}
                                  {member.isCaptain && " (C)"}
                                </Text>
                                <Text style={styles.memberDetails}>
                                  {ensureTextEncoding(member.nationality)} • {member.gender}
                                </Text>
                              </View>
                            ))}
                            {match.awayTeamMembers.length > 3 && (
                              <Text style={styles.moreMembers}>+{match.awayTeamMembers.length - 3} more</Text>
                            )}
                          </View>
                        </View>
                      )}
                    </View>
                  </View>
                ) : null}

                {/* Game Scores */}
                {match.gameScores && match.gameScores.length > 0 && (
                  <View style={styles.gameScoresSection}>
                    <Text style={styles.gameScoresHeader}>Game Scores (Best of {getBestOfValue(match)})</Text>
                    <View style={styles.gameScoresGrid}>
                      {match.gameScores.map((gameScore, gameIndex) => (
                        <View key={gameIndex} style={styles.gameScoreCard}>
                          <Text style={styles.gameNumber}>Game {gameScore.gameNumber}</Text>
                          <Text style={styles.gameScore}>
                            {gameScore.homeScore} - {gameScore.awayScore}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            ))
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>The Clash Referee Portal - {new Date().getFullYear()}</Text>
        </View>
      </Page>
    </Document>
  );
};

export default MatchesPDFDocument;
