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
  const user = useSelector((state: RootState) => state.user.user);
  const location = useLocation();

  // If user is authenticated and trying to access login/signup, redirect to appropriate dashboard
  if (
    isAuthenticated &&
    (location.pathname === "/" || location.pathname === "/login" || location.pathname === "/signup")
  ) {
    const redirectPath = user?.role === "admin" ? "/admin/matches" : "/matches";
    return <Navigate to={redirectPath} replace />;
  }

  // If route requires authentication and user is not authenticated, redirect to login
  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
