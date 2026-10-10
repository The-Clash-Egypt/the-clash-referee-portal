import React from "react";
import { Icon } from "../../../ui/Icon";
import { UnpairedPlayer } from "../types";

/** "Needs a partner" for pairs, "Needs a team" for bigger teams. */
export const poolLabel = (unitSize: number) => (unitSize === 2 ? "Needs a partner" : "Needs a team");

interface UnpairedListProps {
  unitSize: number;
  /** Already filtered by the search box. */
  players: UnpairedPlayer[];
  /** Every player still waiting, for the count in the heading. */
  total: number;
  picked: string[];
  disabled: boolean;
  search: string;
  onToggle: (memberId: string) => void;
}

/** The players not in a team yet, as a grid of big tap targets (spec 2026-10-10); a pick turns orange. */
export const UnpairedList: React.FC<UnpairedListProps> = ({
  unitSize,
  players,
  total,
  picked,
  disabled,
  search,
  onToggle,
}) => {
  const label = poolLabel(unitSize);
  return (
    <>
      <h2 className="mexicano-runner__section">
        {label} · {total}
      </h2>
      <ul className="mexicano-runner__pool" aria-label={label}>
        {players.map((p) => (
          <li key={p.memberId}>
            <button
              type="button"
              className={`mexicano-runner__pick ${picked.includes(p.memberId) ? "active" : ""}`}
              aria-pressed={picked.includes(p.memberId)}
              disabled={disabled}
              onClick={() => onToggle(p.memberId)}
            >
              <span className="mexicano-runner__pick-name">{p.name}</span>
              {picked.includes(p.memberId) && <Icon name="check" size={16} />}
            </button>
          </li>
        ))}
        {players.length === 0 && <li className="mexicano-runner__none">No one matches "{search}".</li>}
      </ul>
    </>
  );
};

interface NewTeamTrayProps {
  unitSize: number;
  picked: UnpairedPlayer[];
  onRemove: (memberId: string) => void;
}

/** Sits on top of the action bar while a team is being picked; the last pick makes the team. */
export const NewTeamTray: React.FC<NewTeamTrayProps> = ({ unitSize, picked, onRemove }) => {
  const missing = unitSize - picked.length;
  return (
    <div className="mexicano-runner__tray" role="region" aria-label="New team">
      <span className="mexicano-runner__tray-label">New team:</span>
      {picked.map((p) => (
        <button
          key={p.memberId}
          type="button"
          className="mexicano-runner__chip"
          aria-label={`Remove ${p.name}`}
          onClick={() => onRemove(p.memberId)}
        >
          {p.name} <Icon name="close" size={12} />
        </button>
      ))}
      <span className="mexicano-runner__tray-more">+ {missing} more</span>
    </div>
  );
};
