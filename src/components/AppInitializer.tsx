import React, { useEffect } from "react";
import { useDispatch } from "react-redux";
import { initializeUser } from "../store/slices/userSlice";

const AppInitializer: React.FC = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    // Initialize user state from localStorage
    dispatch(initializeUser());
  }, [dispatch]);

  return null;
};

export default AppInitializer;
