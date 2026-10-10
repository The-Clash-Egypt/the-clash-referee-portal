import React from "react";
import { useSelector } from "react-redux";
import { Navigate, useLocation } from "react-router-dom";
import { RootState } from "../../store";
import { hasFullAccess } from "../auth/permissions";

/** Redirects (replacing the history entry) to a path relative to the current route, keeping the query string. */
export function TabRedirect({ to }: { to: string }): React.JSX.Element {
  const { search } = useLocation();
  return <Navigate to={{ pathname: to, search }} replace />;
}

/** A tournament tab only for full access (Courts): anyone else lands on the Matches tab. */
export function FullAccessOnly({ children }: { children: React.ReactNode }): React.JSX.Element {
  const user = useSelector((state: RootState) => state.user.user);
  return hasFullAccess(user) ? <>{children}</> : <TabRedirect to="../matches" />;
}
