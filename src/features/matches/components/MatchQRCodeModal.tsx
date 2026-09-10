import React, { useEffect, useState } from "react";
import moment from "moment";
import QRCodeModal from "../../shared/components/QRCodeModal";
import { Match, sideDisplayName } from "../types/match";
import { buildMatchAccessUrl, issueMatchAccessTokens } from "../api/matchAccess";
import { formatValidUntil } from "../../../utils/matchSheetFormat";

interface MatchQRCodeModalProps {
  /** The match to show a QR for; null keeps the modal closed. */
  match: Match | null;
  onClose: () => void;
}

interface QrState {
  url: string | null;
  expiresAt: string | null;
  loading: boolean;
  error: string | null;
}

const IDLE: QrState = { url: null, expiresAt: null, loading: false, error: null };

/**
 * "Falcons-vs-Sharks-QR". Letters (with their combining marks) and digits of any script survive,
 * so an Arabic team name isn't dropped. A RegExp object, not a literal: TypeScript refuses the
 * `u` flag in a literal at this project's ES5 target.
 */
export const matchQrFileName = (home: string, away: string): string =>
  `${home}-vs-${away}-QR`.replace(new RegExp("[^\\p{L}\\p{M}\\p{N}]+", "gu"), "-").replace(/^-|-$/g, "") ||
  "match-QR";

/**
 * Mints a fresh 24h token each time it opens (spec §4.3). Older QRs keep working until their
 * own expiry, because the tokens are stateless.
 */
const MatchQRCodeModal: React.FC<MatchQRCodeModalProps> = ({ match, onClose }) => {
  const [state, setState] = useState<QrState>(IDLE);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!match) {
      setState(IDLE);
      return;
    }

    let cancelled = false;
    setState({ ...IDLE, loading: true });

    issueMatchAccessTokens([match.id])
      .then((tokens) => {
        if (cancelled) return;
        const issued = tokens.find((token) => token.matchId === match.id);
        setState(
          issued
            ? { url: buildMatchAccessUrl(match.id, issued.token), expiresAt: issued.expiresAt, loading: false, error: null }
            : { ...IDLE, error: "This match could not be found." }
        );
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Failed to generate the match QR code:", error);
        setState({ ...IDLE, error: "Couldn't generate the QR code. Please try again." });
      });

    return () => {
      cancelled = true;
    };
  }, [match, attempt]);

  if (!match) return null;

  const home = sideDisplayName(match.homeTeamName, match.homeTeam2Name);
  const away = sideDisplayName(match.awayTeamName, match.awayTeam2Name);
  const when = match.startTime ? moment(match.startTime).format("ddd D MMM, h:mm A") : "Time TBD";
  const fileName = matchQrFileName(home, away);

  return (
    <QRCodeModal
      isOpen
      title="Match QR code"
      description={
        match.isCompleted
          ? "Scan to view this match's final result."
          : "Scan to enter this match's score — no login needed."
      }
      shareUrl={state.url}
      downloadName={fileName}
      details={
        <>
          <strong>
            {home} vs {away}
          </strong>
          <span>{[match.venue, when, match.round].filter(Boolean).join(" · ")}</span>
        </>
      }
      footnote={state.expiresAt ? `Valid until ${formatValidUntil(state.expiresAt)}` : undefined}
      loading={state.loading}
      error={state.error}
      onRetry={() => setAttempt((count) => count + 1)}
      level="M"
      onClose={onClose}
    />
  );
};

export default MatchQRCodeModal;
