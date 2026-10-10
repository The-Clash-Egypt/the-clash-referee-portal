import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Provider } from "react-redux";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { store } from "./store";
import { setQueryClient } from "./api/axios";
import { ToastProvider } from "./ui";
import "./App.scss";

import NotFoundPage from "./pages/not-found";
import { LoginPage } from "./features/auth/pages";
import AppInitializer from "./components/AppInitializer";
import ProtectedRoute from "./components/ProtectedRoute";
import Navbar from "./components/Navbar";
import Tournaments from "./features/tournaments/pages";
import MatchesManagement from "./features/matches/pages/MatchesManagement";
import PrintableViewPage from "./features/matches/pages/PrintableViewPage";
import MexicanoPage from "./features/mexicano/pages/MexicanoPage";
import GuestVenuePage from "./features/venue/pages/GuestVenuePage";
import GuestMatchPage from "./features/matches/pages/GuestMatchPage";

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

// Set the QueryClient instance for axios interceptors
setQueryClient(queryClient);

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <ToastProvider>
          <AppInitializer>
            <Router>
              <div className="app">
                <Navbar />
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
                    <Route
                      path="tournaments/:id/matches/preview"
                      element={
                        <ProtectedRoute>
                          <PrintableViewPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="tournaments/:id/mexicano/:formatId"
                      element={
                        <ProtectedRoute>
                          <MexicanoPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route path="venue/shared" element={<GuestVenuePage />} />
                    <Route path="match/shared" element={<GuestMatchPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Routes>
                </main>
              </div>
            </Router>
          </AppInitializer>
        </ToastProvider>
      </Provider>
    </QueryClientProvider>
  );
};

export default App;
