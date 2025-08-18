import React from "react";
import { Referee } from "../../matches/api/matches";
import "./RemoveRefereeDialog.scss";

interface RemoveRefereeDialogProps {
  isOpen: boolean;
  referee: Referee | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  loading: boolean;
}

const RemoveRefereeDialog: React.FC<RemoveRefereeDialogProps> = ({ isOpen, referee, onClose, onConfirm, loading }) => {
  if (!isOpen || !referee) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content confirmation-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Remove Referee</h3>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="confirmation-message">
            <p>
              Are you sure you want to remove <strong>{referee.fullName}</strong>?
            </p>
            <p>This action cannot be undone.</p>
          </div>

          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={onConfirm} disabled={loading}>
              {loading ? "Removing..." : "Remove Referee"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RemoveRefereeDialog;
