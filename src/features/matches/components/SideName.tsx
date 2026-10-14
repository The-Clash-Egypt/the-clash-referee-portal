import React from "react";
import { Match, matchSideName, matchSideUnits } from "../types/match";
import "./SideName.scss";

interface SideNameProps {
  match: Match;
  side: "home" | "away";
}

/**
 * A match side's name for the detail views and courts: "A & B" on one line as always, or one unit per line once a side
 * has more than two (Roulette), each line truncating on its own. Goes inside the view's own name element.
 */
const SideName: React.FC<SideNameProps> = ({ match, side }) => {
  const units = matchSideUnits(match, side);
  if (units.length <= 2) return <>{matchSideName(match, side)}</>;
  return (
    <>
      {units.map((name, index) => (
        <span key={index} className="side-name__unit">
          {name}
        </span>
      ))}
    </>
  );
};

export default SideName;
