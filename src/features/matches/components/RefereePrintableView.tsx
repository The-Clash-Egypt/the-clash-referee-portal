import React from "react";
import PrintableView from "./PrintableView";
import { Match } from "../types/match";

interface RefereePrintableViewProps {
  matches: Match[];
  tournamentName: string;
  refereeName: string;
  categoryName?: string;
  onClose: () => void;
}

const RefereePrintableView: React.FC<RefereePrintableViewProps> = ({
  matches,
  tournamentName,
  refereeName,
  categoryName,
  onClose,
}) => {
  return (
    <PrintableView
      matches={matches}
      tournamentName={tournamentName}
      categoryName={categoryName}
      refereeName={refereeName}
      viewType="referee"
      onClose={onClose}
    />
  );
};

export default RefereePrintableView;
