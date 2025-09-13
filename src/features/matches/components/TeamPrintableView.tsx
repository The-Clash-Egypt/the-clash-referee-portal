import React from "react";
import PrintableView from "./PrintableView";
import { Match } from "../types/match";

interface TeamPrintableViewProps {
  matches: Match[];
  tournamentName: string;
  teamName: string;
  categoryName?: string;
  onClose: () => void;
}

const TeamPrintableView: React.FC<TeamPrintableViewProps> = ({
  matches,
  tournamentName,
  teamName,
  categoryName,
  onClose,
}) => {
  return (
    <PrintableView
      matches={matches}
      tournamentName={tournamentName}
      categoryName={categoryName}
      teamName={teamName}
      viewType="team"
      onClose={onClose}
    />
  );
};

export default TeamPrintableView;
