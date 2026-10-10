import React from "react";
import { Icon, IconName } from "../../../../ui/Icon";
import "./BulkActionBar.scss";

interface BulkActionBarProps {
  /** Nothing is selected yet. */
  disabled: boolean;
  onReferee: () => void;
  onScores: () => void;
  onEdit: () => void;
  onWhatsApp: () => void;
}

const Action = ({
  icon,
  label,
  main = false,
  disabled,
  onClick,
}: {
  icon: IconName;
  label: string;
  main?: boolean;
  disabled: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    className={`bulk-bar__action${main ? " bulk-bar__action--main" : ""}`}
    disabled={disabled}
    onClick={onClick}
  >
    <Icon name={icon} size={19} />
    {label}
  </button>
);

/**
 * Select mode's bulk actions, in place of the tab bar (mockup match-flow-v2.html phone 5, `.actbar`): give the
 * selected matches a referee, the one-screen score sheet, edit court / best of, or WhatsApp each referee their list.
 */
const BulkActionBar: React.FC<BulkActionBarProps> = ({ disabled, onReferee, onScores, onEdit, onWhatsApp }) => (
  <div className="bulk-bar" role="group" aria-label="Bulk actions">
    <div className="bulk-bar__actions">
      <Action icon="person" label="Referee" main disabled={disabled} onClick={onReferee} />
      <Action icon="list" label="Scores" disabled={disabled} onClick={onScores} />
      <Action icon="edit" label="Edit" disabled={disabled} onClick={onEdit} />
      <Action icon="whatsapp" label="WhatsApp" disabled={disabled} onClick={onWhatsApp} />
    </div>
  </div>
);

export default BulkActionBar;
