import React from "react";
import { useSelector } from "react-redux";
import { Navigate, useLocation } from "react-router-dom";
import { RootState } from "../store";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requireAuth = true }) => {
  const isAuthenticated = useSelector((state: RootState) => state.user.isAuthenticated);
  const location = useLocation();

  if (isAuthenticated && location.pathname === "/login") {
    const redirectPath = "/";
    return <Navigate to={redirectPath} replace />;
  }

  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
