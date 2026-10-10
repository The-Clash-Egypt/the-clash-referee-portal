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
import Tournaments from "./features/tournaments/pages";
import TournamentLayout from "./features/tournament-shell/TournamentLayout";
import MorePage from "./features/tournament-shell/MorePage";
import { CourtsTab } from "./features/tournament-shell/TournamentTabs";
import { FullAccessOnly, TabRedirect } from "./features/tournament-shell/guards";
import MatchesPage from "./features/matches/pages/MatchesPage";
import PrintableViewPage from "./features/matches/pages/PrintableViewPage";
import MexicanoPage from "./features/mexicano/pages/MexicanoPage";
import MexicanoStagesPage from "./features/mexicano/pages/MexicanoStagesPage";
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
                <div className="app-main">
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
                    {/* A tournament's tabs share the app bar and the tab bar (TournamentLayout). */}
                    <Route
                      path="tournaments/:id"
                      element={
                        <ProtectedRoute>
                          <TournamentLayout />
                        </ProtectedRoute>
                      }
                    >
                      <Route index element={<TabRedirect to="matches" />} />
                      <Route path="matches" element={<MatchesPage />} />
                      <Route
                        path="courts"
                        element={
                          <FullAccessOnly>
                            <CourtsTab />
                          </FullAccessOnly>
                        }
                      />
                      <Route path="mexicano" element={<MexicanoStagesPage />} />
                      <Route path="more" element={<MorePage />} />
                    </Route>
                    {/* Focused screens, outside the tabs */}
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
                </div>
              </div>
            </Router>
          </AppInitializer>
        </ToastProvider>
      </Provider>
    </QueryClientProvider>
  );
};

export default App;
