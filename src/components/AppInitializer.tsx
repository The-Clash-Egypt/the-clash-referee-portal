import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { setUser, logout } from "../store/slices/userSlice";
import { getCurrentUser } from "../features/auth/api/auth";
import VolleyballLoading from "./VolleyballLoading";

const AppInitializer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dispatch = useDispatch();
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const initializeApp = async () => {
      const token = localStorage.getItem("token");
      
      if (token) {
        try {
          // Fetch fresh user data from server to ensure roles are up-to-date
          const response = await getCurrentUser();
          const userData = response.data.data;
          
          // Update Redux store with fresh user data
          dispatch(setUser(userData));
          
          // Also update localStorage with fresh data
          localStorage.setItem("user", JSON.stringify(userData));
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
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        width: '100vw',
        backgroundColor: '#f5f5f5'
      }}>
        <VolleyballLoading message="Loading..." size="large" />
      </div>
    );
  }

  return <>{children}</>;
};

export default AppInitializer;
