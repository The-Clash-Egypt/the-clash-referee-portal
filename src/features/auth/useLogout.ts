import { useCallback } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { logout } from "../../store/slices/userSlice";

/** Logs the user out: clears every cached query (no data leaks to the next user), the session, then goes home. */
export function useLogout(): () => void {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useCallback(() => {
    queryClient.clear();
    dispatch(logout());
    navigate("/");
  }, [dispatch, navigate, queryClient]);
}

export default useLogout;
