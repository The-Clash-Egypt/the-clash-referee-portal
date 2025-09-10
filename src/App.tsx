import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Provider } from "react-redux";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { store } from "./store";
import "./App.scss";

import NotFoundPage from "./pages/not-found";
import { LoginPage } from "./features/auth/pages";
import AppInitializer from "./components/AppInitializer";
import ProtectedRoute from "./components/ProtectedRoute";
import Tournaments from "./features/tournaments/pages";
import MatchesManagement from "./features/matches/pages/MatchesManagement";

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <AppInitializer />
        <Router>
          <div className="app">
            <main className="app-main">
              <Routes>
                <Route
                  path="/"
                  element={
                    <ProtectedRoute requireAuth={true}>
                      <Tournaments />
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
                  path="tournaments/:id/matches"
                  element={
                    <ProtectedRoute>
                      <MatchesManagement />
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </main>
          </div>
        </Router>
      </Provider>
    </QueryClientProvider>
  );
};

export default App;
