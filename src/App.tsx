import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Provider } from "react-redux";
import { store } from "./store";
import "./App.scss";

import NotFoundPage from "./pages/not-found";
import Home from "./pages/home";
import { LoginPage, SignupPage } from "./features/auth/pages";
import MatchesDashboard from "./features/matches/pages/MatchesDashboard";
import MatchesManagement from "./features/admin/pages/MatchesManagement";
import RefereesManagement from "./features/admin/pages/RefereesManagement";
import AppInitializer from "./components/AppInitializer";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";

const App: React.FC = () => {
  return (
    <Provider store={store}>
      <AppInitializer />
      <Router>
        <div className="app">
          <Navbar />
          <main className="app-main">
            <Routes>
              {/* Public routes */}
              <Route
                path="/"
                element={
                  <ProtectedRoute requireAuth={false}>
                    <LoginPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/login"
                element={
                  <ProtectedRoute requireAuth={false}>
                    <LoginPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/signup"
                element={
                  <ProtectedRoute requireAuth={false}>
                    <SignupPage />
                  </ProtectedRoute>
                }
              />

              {/* Protected routes */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Home />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/matches"
                element={
                  <ProtectedRoute>
                    <MatchesDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/matches"
                element={
                  <ProtectedRoute>
                    <MatchesManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/referees"
                element={
                  <ProtectedRoute>
                    <RefereesManagement />
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </main>
        </div>
      </Router>
    </Provider>
  );
};

export default App;
