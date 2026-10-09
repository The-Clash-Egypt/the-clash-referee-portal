import React, { useEffect, useState } from "react";
import { UnpairedPlayer } from "../types";

interface FormTeamsPanelProps {
  unitSize: number;
  unpaired: UnpairedPlayer[];
  busy: boolean;
  onCreate: (memberIds: string[]) => void;
}

/** Pick `unitSize` unpaired players and make them a team (spec 2026-10-10). Selection lives here only. */
const FormTeamsPanel: React.FC<FormTeamsPanelProps> = ({ unitSize, unpaired, busy, onCreate }) => {
  const [picked, setPicked] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  // A pick that left the pool (the team was made, or someone else paired them) is dropped.
  useEffect(() => {
    setPicked((current) => {
      const next = current.filter((id) => unpaired.some((p) => p.memberId === id));
      return next.length === current.length ? current : next;
    });
  }, [unpaired]);

  const query = search.trim().toLowerCase();
  const visible = query ? unpaired.filter((p) => p.name.toLowerCase().includes(query)) : unpaired;

  const toggle = (id: string) =>
    setPicked((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : current.length < unitSize ? [...current, id] : current
    );

  return (
    <div className="mexicano-runner__form-teams">
      <div className="mexicano-runner__players-head">
        <p className="mexicano-runner__counts">
          Form teams · {picked.length} of {unitSize} picked
        </p>
        <button
          type="button"
          className="mexicano-runner__secondary"
          disabled={busy || picked.length !== unitSize}
          onClick={() => onCreate(picked)}
        >
          Make team
        </button>
      </div>
      {unpaired.length === 0 ? (
        <p className="mexicano-runner__none">Everyone is in a team.</p>
      ) : (
        <>
          <input
            type="search"
            className="mexicano-runner__search"
            placeholder="Search players"
            aria-label="Search players to team up"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <ul className="mexicano-runner__players">
            {visible.map((p) => (
              <li key={p.memberId} className="mexicano-runner__player">
                <button
                  type="button"
                  className={`mexicano-runner__pick ${picked.includes(p.memberId) ? "active" : ""}`}
                  aria-pressed={picked.includes(p.memberId)}
                  disabled={busy}
                  onClick={() => toggle(p.memberId)}
                >
                  {p.name}
                </button>
              </li>
            ))}
            {visible.length === 0 && <li className="mexicano-runner__none">No one matches "{search}".</li>}
          </ul>
        </>
      )}
    </div>
  );
};

export default FormTeamsPanel;
