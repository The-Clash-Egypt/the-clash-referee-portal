import React, { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate, useLocation } from "react-router-dom";
import { RootState } from "../store";
import { logout } from "../store/slices/userSlice";
import "./Navbar.scss";

const Navbar: React.FC = () => {
  const user = useSelector((state: RootState) => state.user.user);
  const isAuthenticated = useSelector((state: RootState) => state.user.isAuthenticated);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    dispatch(logout());
    navigate("/");
    setIsMobileMenuOpen(false);
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    setIsMobileMenuOpen(false);
  };

  const getPageTitle = () => {
    switch (location.pathname) {
      case "/admin/matches":
        return "Matches Management";
      case "/admin/referees":
        return "Referees Management";
      case "/matches":
        return "Matches";
      case "/dashboard":
        return "Dashboard";
      default:
        return "The Clash";
    }
  };

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <nav className="navbar">
      <div className="navbar-container">
        {/* Logo and Brand */}
        <div className="navbar-brand">
          <img src={require("../assets/images/logo.png")} alt="The Clash" className="navbar-logo" />
          <div className="navbar-title-container">
            <span className="navbar-title">The Clash Referees Portal</span>
            {/* <span className="navbar-subtitle">{getPageTitle()}</span> */}
          </div>
        </div>

        {/* Desktop Navigation */}
        <div className="navbar-nav desktop-only">
          {user.role === "admin" ? (
            <>
              <button
                className={`nav-link ${location.pathname === "/admin/matches" ? "active" : ""}`}
                onClick={() => handleNavigation("/admin/matches")}
              >
                Matches Management
              </button>
              <button
                className={`nav-link ${location.pathname === "/admin/referees" ? "active" : ""}`}
                onClick={() => handleNavigation("/admin/referees")}
              >
                Referees Management
              </button>
            </>
          ) : (
            <button
              className={`nav-link ${location.pathname === "/matches" ? "active" : ""}`}
              onClick={() => handleNavigation("/matches")}
            >
              Matches
            </button>
          )}
          <button className="nav-link logout desktop-only" onClick={handleLogout}>
            Logout
          </button>
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
            <span className="user-role">{user.role === "admin" ? "Admin" : "Referee"}</span>
          </div>
        </div>
        <div className="mobile-nav-links">
          {user.role === "admin" ? (
            <>
              <button
                className={`mobile-nav-link ${location.pathname === "/admin/matches" ? "active" : ""}`}
                onClick={() => handleNavigation("/admin/matches")}
              >
                Matches Management
              </button>
              <button
                className={`mobile-nav-link ${location.pathname === "/admin/referees" ? "active" : ""}`}
                onClick={() => handleNavigation("/admin/referees")}
              >
                Referees Management
              </button>
            </>
          ) : (
            <button
              className={`mobile-nav-link ${location.pathname === "/matches" ? "active" : ""}`}
              onClick={() => handleNavigation("/matches")}
            >
              My Matches
            </button>
          )}
          <button className="mobile-nav-link logout" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
