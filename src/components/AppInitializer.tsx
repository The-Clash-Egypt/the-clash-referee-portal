import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { setUser, logout } from "../store/slices/userSlice";
import { getCurrentUser } from "../features/auth/api/auth";
// The component's own file, not the src/ui barrel: the barrel pulls in react-router-dom.
import { Spinner } from "../ui/Spinner";

const readToken = (): string | null => {
  try {
    return localStorage.getItem("token");
  } catch {
    return null;
  }
};

const AppInitializer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dispatch = useDispatch();
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const initializeApp = async () => {
      const token = readToken();

      if (token) {
        try {
          // Fetch fresh user data from server to ensure roles are up-to-date
          const response = await getCurrentUser();
          const userData = response.data.data;

          // Update Redux store with fresh user data
          dispatch(setUser(userData));

          // Also update localStorage with fresh data
          try {
            localStorage.setItem("user", JSON.stringify(userData));
          } catch {
            // Storage unavailable (private mode, quota): the store already has the user.
          }
        } catch (error) {
          console.error("Failed to fetch current user:", error);
          // If token is invalid or expired, logout
          dispatch(logout());
        }
      }

      // Initialization complete
      setIsInitializing(false);
    };

    initializeApp();
  }, [dispatch]);

  if (isInitializing) {
    return (
      <div className="app-loading">
        <Spinner label="Loading..." size={36} />
      </div>
    );
  }

  return <>{children}</>;
};

export default AppInitializer;
