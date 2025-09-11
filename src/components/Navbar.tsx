import React, { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { RootState } from "../store";
import { logout } from "../store/slices/userSlice";
import "./Navbar.scss";

const Navbar: React.FC = () => {
  const user = useSelector((state: RootState) => state.user.user);
  const isAuthenticated = useSelector((state: RootState) => state.user.isAuthenticated);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    // Clear all React Query cache to prevent data leakage between users
    queryClient.clear();

    dispatch(logout());
    navigate("/");
    setIsMobileMenuOpen(false);
  };

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <nav className="navbar">
      <div className="navbar-container">
        {/* Logo and Brand */}
        <div className="navbar-brand" style={{ cursor: "pointer" }} onClick={() => navigate("/")}>
          <img src={require("../assets/images/logo.png")} alt="The Clash" className="navbar-logo" />
          <div className="navbar-title-container">
            <span className="navbar-title">The Clash Referees Portal</span>
            {/* <span className="navbar-subtitle">{getPageTitle()}</span> */}
          </div>
        </div>

        {/* Desktop User Info and Logout */}
        <div className="navbar-right">
          {/* User Info */}
          <div className="navbar-user desktop-only">
            <div className="user-info">
              <span className="user-name">
                {user.firstName} {user.lastName}
              </span>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="navbar-nav desktop-only">
            <button className="nav-link logout" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>

        {/* Mobile Menu Button */}
        <button className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          <span className={`hamburger ${isMobileMenuOpen ? "open" : ""}`}></span>
        </button>
      </div>

      {/* Mobile Menu */}
      <div className={`mobile-menu ${isMobileMenuOpen ? "open" : ""}`}>
        <div className="mobile-menu-header">
          <div className="mobile-user-info">
            <span className="user-name">
              {user.firstName} {user.lastName}
            </span>
          </div>
        </div>
        <div className="mobile-nav-links">
          <button className="mobile-nav-link logout" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
