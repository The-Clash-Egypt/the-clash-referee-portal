import React from "react";
import { Link } from "react-router-dom";
import "./Home.scss";

const Home: React.FC = () => {
  return (
    <div className="landing">
      <main className="hero">
        <div className="hero-content">
          <h1>Welcome to your Referee Dashboard</h1>
          <p>Manage your match assignments, submit reports, and track your officiating history.</p>
          <div className="cta">
            <Link to="/matches" className="btn btn-primary">
              View My Matches
            </Link>
            <button className="btn btn-secondary">View Reports</button>
          </div>
        </div>
      </main>

      <section className="content-section">
        <div className="container">
          <div className="content-grid">
            <div className="content-card">
              <div className="card-icon">📊</div>
              <h3>Match Management</h3>
              <p>
                View all your assigned matches organized by tournament and category. Track upcoming games, completed
                matches, and your performance history.
              </p>
              <Link to="/matches" className="btn btn-secondary">
                View Matches
              </Link>
            </div>

            <div className="content-card">
              <div className="card-icon">⚽</div>
              <h3>Real-time Reporting</h3>
              <p>
                Submit match reports instantly with our streamlined interface. Record scores, incidents, and player
                statistics with ease.
              </p>
              <button className="btn btn-secondary">Submit Report</button>
            </div>

            <div className="content-card">
              <div className="card-icon">📱</div>
              <h3>Mobile Optimized</h3>
              <p>
                Access your referee portal from any device. Perfect for on-the-go match management and quick score
                reporting.
              </p>
              <button className="btn btn-secondary">Learn More</button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
