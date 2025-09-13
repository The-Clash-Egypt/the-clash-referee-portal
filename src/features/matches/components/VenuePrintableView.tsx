import React from "react";
import PrintableView from "./PrintableView";
import { Match } from "../types/match";

interface VenuePrintableViewProps {
  matches: Match[];
  tournamentName: string;
  venueName: string;
  categoryName?: string;
  onClose: () => void;
}

const VenuePrintableView: React.FC<VenuePrintableViewProps> = ({
  matches,
  tournamentName,
  venueName,
  categoryName,
  onClose,
}) => {
  return (
    <PrintableView
      matches={matches}
      tournamentName={tournamentName}
      categoryName={categoryName}
      venueName={venueName}
      viewType="venue"
      onClose={onClose}
    />
  );
};

export default VenuePrintableView;
