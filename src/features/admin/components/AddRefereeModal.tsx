import React, { useState, useEffect, useCallback } from "react";
import { getPlayerSuggestions } from "../api";
import "./AddRefereeModal.scss";

interface PlayerSuggestion {
  id: string;
  firstName: string;
  lastName: string;
  nationality: string;
  gender: string;
  email: string;
  userId: string;
}

interface AddRefereeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (userId: string) => Promise<void>;
  loading: boolean;
}

const AddRefereeModal: React.FC<AddRefereeModalProps> = ({ isOpen, onClose, onSubmit, loading }) => {
  const [selectedUser, setSelectedUser] = useState<PlayerSuggestion | null>(null);
  const [playerSuggestions, setPlayerSuggestions] = useState<PlayerSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchPlayerSuggestions = async (search: string) => {
    try {
      setLoadingSuggestions(true);
      const response = await getPlayerSuggestions(search);
      setPlayerSuggestions(response.data.data);
    } catch (error: any) {
      console.error("Error fetching player suggestions:", error);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // Debounced search function
  const debouncedSearch = useCallback(
    (() => {
      let timeoutId: NodeJS.Timeout;
      return (search: string) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          if (search.length >= 2) {
            fetchPlayerSuggestions(search);
            setShowSuggestions(true);
          } else {
            setPlayerSuggestions([]);
            setShowSuggestions(false);
          }
        }, 300); // 300ms delay
      };
    })(),
    []
  );

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    debouncedSearch(value);
  };

  const handleSelectUser = (user: PlayerSuggestion) => {
    setSelectedUser(user);
    setSearchQuery(`${user.firstName} ${user.lastName}`);
    setShowSuggestions(false);
  };

  const handleSubmit = async () => {
    if (!selectedUser) {
      alert("Please select a user to add as referee");
      return;
    }

    await onSubmit(selectedUser.userId);

    // Reset form after successful submission
    setSelectedUser(null);
    setSearchQuery("");
    setPlayerSuggestions([]);
    setShowSuggestions(false);
  };

  const handleClose = () => {
    setSelectedUser(null);
    setSearchQuery("");
    setPlayerSuggestions([]);
    setShowSuggestions(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Add New Referee</h3>
          <button className="modal-close" onClick={handleClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label htmlFor="userSearch">Search and Select User *</label>
            <div className="search-dropdown">
              <input
                type="text"
                id="userSearch"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search for users by name or email..."
                className="form-input"
                autoComplete="off"
              />
              {showSuggestions && (
                <div className="suggestions-dropdown">
                  {loadingSuggestions ? (
                    <div className="suggestion-item loading">Loading...</div>
                  ) : playerSuggestions.length > 0 ? (
                    playerSuggestions.map((user) => (
                      <div key={user.id} className="suggestion-item" onClick={() => handleSelectUser(user)}>
                        <div className="user-info">
                          <div className="user-name">
                            {user.firstName} {user.lastName}
                          </div>
                          <div className="user-email">{user.email}</div>
                        </div>
                        <div className="user-details">
                          <span className="user-nationality">{user.nationality}</span>
                          <span className="user-gender">{user.gender}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="suggestion-item no-results">No users found</div>
                  )}
                </div>
              )}
            </div>
            <small className="form-help">Search for existing users to add them as referees</small>
          </div>

          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={handleClose}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
              {loading ? "Adding..." : "Add Referee"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddRefereeModal;
