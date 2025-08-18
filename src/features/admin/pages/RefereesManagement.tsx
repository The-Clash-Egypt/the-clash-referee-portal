import React, { useState, useEffect } from "react";
import { getAllRefereesForAdmin, addReferees, deleteReferee } from "../api";
import { Referee } from "../../matches/api/matches";
import RefereeCard from "../../shared/components/RefereeCard";
import AddRefereeModal from "../components/AddRefereeModal";
import RemoveRefereeDialog from "../components/RemoveRefereeDialog";
import "./RefereesManagement.scss";

const RefereesManagement: React.FC = () => {
  const [referees, setReferees] = useState<Referee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [selectedReferee, setSelectedReferee] = useState<Referee | null>(null);
  const [addingReferee, setAddingReferee] = useState(false);
  const [removingReferee, setRemovingReferee] = useState(false);

  useEffect(() => {
    fetchReferees();
  }, []);

  const fetchReferees = async () => {
    try {
      setLoading(true);
      const response = await getAllRefereesForAdmin();
      const allReferees: Referee[] = response.data.data;
      setReferees(allReferees);
    } catch (error: any) {
      console.error("Error fetching referees:", error);
      setError("An error occurred while loading referees");
    } finally {
      setLoading(false);
    }
  };

  const getRefereeStatus = (referee: Referee) => {
    // TODO: Implement referee status logic based on availability, assignments, etc.
    // For now, return "active" for all referees
    return "active";
  };

  const filteredReferees = referees.filter((referee) => {
    const matchesSearch =
      referee.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      referee.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      referee.phoneNumber?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === "all" || getRefereeStatus(referee) === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const handleAddReferee = () => {
    setShowAddModal(true);
  };

  const handleSubmitAddReferee = async (userId: string) => {
    try {
      setAddingReferee(true);
      await addReferees([userId]);

      // Refresh the referees list after adding
      await fetchReferees();
      setShowAddModal(false);
    } catch (error: any) {
      console.error("Error adding referee:", error);
      alert("Failed to add referee. Please try again.");
    } finally {
      setAddingReferee(false);
    }
  };

  const handleRemoveReferee = (referee: Referee) => {
    setSelectedReferee(referee);
    setShowRemoveDialog(true);
  };

  const confirmRemoveReferee = async () => {
    if (!selectedReferee) return;

    try {
      setRemovingReferee(true);
      await deleteReferee(selectedReferee.id);

      // Refresh the referees list after removing
      await fetchReferees();
      setShowRemoveDialog(false);
      setSelectedReferee(null);
    } catch (error: any) {
      console.error("Error removing referee:", error);
      alert("Failed to remove referee. Please try again.");
    } finally {
      setRemovingReferee(false);
    }
  };

  if (loading) {
    return (
      <div className="referees-management">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading referees...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="referees-management">
        <div className="error-container">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={fetchReferees} className="retry-button">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="referees-management">
      <div className="dashboard-header">
        <h1>Referees Management</h1>
        <p>Manage all referees in the system</p>
      </div>

      {referees.length > 0 && (
        <div className="filters-section">
          <div className="search-filter">
            <input
              type="text"
              placeholder="Search referees by name, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="status-filter">
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="status-select">
              <option value="all">All Referees</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="busy">Currently Assigned</option>
            </select>
          </div>

          <div className="action-filter">
            <button className="btn btn-primary" onClick={handleAddReferee}>
              Add New Referee
            </button>
          </div>
        </div>
      )}

      {referees.length > 0 && (
        <div className="referees-stats">
          <div className="stat-item">
            <span className="stat-label">Total Referees</span>
            <span className="stat-value">{referees.length}</span>
          </div>
        </div>
      )}

      {filteredReferees.length === 0 ? (
        <div className="no-referees">
          <div className="empty-state">
            <h2>No Referees Found</h2>
            <p>
              {searchTerm || filterStatus !== "all"
                ? "No referees match your current filters. Try adjusting your search or filters."
                : "There are no referees in the system yet. Add your first referee to get started."}
            </p>
            {!searchTerm && filterStatus === "all" && (
              <button className="btn btn-primary" onClick={handleAddReferee}>
                Add First Referee
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="referees-grid">
          {filteredReferees.map((referee) => (
            <RefereeCard key={referee.id} referee={referee} onRemove={handleRemoveReferee} />
          ))}
        </div>
      )}

      {/* Add Referee Modal */}
      <AddRefereeModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleSubmitAddReferee}
        loading={addingReferee}
      />

      {/* Remove Confirmation Dialog */}
      <RemoveRefereeDialog
        isOpen={showRemoveDialog}
        referee={selectedReferee}
        onClose={() => setShowRemoveDialog(false)}
        onConfirm={confirmRemoveReferee}
        loading={removingReferee}
      />
    </div>
  );
};

export default RefereesManagement;
