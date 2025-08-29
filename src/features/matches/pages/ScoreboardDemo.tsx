import React, { useState } from "react";
import { Match, MatchGameScore } from "../api/matches";
import Scoreboard from "../components/Scoreboard";
import UpdateScoreDialog from "../../admin/components/UpdateScoreDialog";
import "./ScoreboardDemo.scss";

const ScoreboardDemo: React.FC = () => {
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [loading, setLoading] = useState(false);

  // Mock match data
  const mockMatch: Match = {
    id: "1",
    homeTeamName: "Team Alpha",
    awayTeamName: "Team Beta",
    venue: "Main Court",
    format: "Best of 3",
    bestOf: 3,
    startTime: new Date().toISOString(),
    isCompleted: false,
    gameScores: [
      { gameNumber: 1, homeScore: 21, awayScore: 19 },
      { gameNumber: 2, homeScore: 18, awayScore: 21 },
    ],
  };

  const handleScoreUpdate = (gameScores: MatchGameScore[]) => {
    console.log("Scoreboard updated:", gameScores);
  };

  const handleSubmitScores = async (gameScores: MatchGameScore[]) => {
    setLoading(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log("Scores submitted:", gameScores);
    setLoading(false);
  };

  return (
    <div className="scoreboard-demo">
      <div className="demo-header">
        <h1>Scoreboard & Update Dialog Demo</h1>
        <p>Showcasing the new clean and sleek score tracking components</p>
      </div>

      <div className="demo-sections">
        {/* Scoreboard Demo */}
        <div className="demo-section">
          <h2>Live Scoreboard for Referees</h2>
          <p>Real-time score tracking with switch side reminders and set management</p>

          <div className="demo-content">
            <Scoreboard match={mockMatch} onScoreUpdate={handleScoreUpdate} switchSideInterval={11} />
          </div>
        </div>

        {/* Update Dialog Demo */}
        <div className="demo-section">
          <h2>Clean Update Score Dialog</h2>
          <p>Modern interface for updating match scores with quick and detailed modes</p>

          <div className="demo-content">
            <button onClick={() => setShowUpdateDialog(true)} className="demo-btn">
              Open Update Score Dialog
            </button>
          </div>
        </div>

        {/* Features List */}
        <div className="demo-section">
          <h2>Key Features</h2>
          <div className="features-grid">
            <div className="feature-card">
              <h3>🎯 Quick Score Updates</h3>
              <p>One-click score increments and decrements for fast-paced matches</p>
            </div>
            <div className="feature-card">
              <h3>🔄 Switch Side Reminders</h3>
              <p>Configurable reminders to switch sides at specified point intervals (default: every 11 points)</p>
            </div>
            <div className="feature-card">
              <h3>📊 Set Management</h3>
              <p>Complete sets, track history, and undo last set functionality</p>
            </div>
            <div className="feature-card">
              <h3>💾 Auto-Save</h3>
              <p>Automatic score saving to prevent data loss during matches</p>
            </div>
            <div className="feature-card">
              <h3>📱 Mobile Responsive</h3>
              <p>Optimized for use on tablets and mobile devices during matches</p>
            </div>
            <div className="feature-card">
              <h3>⚙️ Configurable Settings</h3>
              <p>Customize switch intervals, auto-save, and display preferences</p>
            </div>
          </div>
        </div>
      </div>

      {/* Update Score Dialog */}
      <UpdateScoreDialog
        isOpen={showUpdateDialog}
        match={mockMatch}
        onClose={() => setShowUpdateDialog(false)}
        onSubmit={handleSubmitScores}
        loading={loading}
      />
    </div>
  );
};

export default ScoreboardDemo;
