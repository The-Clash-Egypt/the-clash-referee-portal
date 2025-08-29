import axios from "axios";
import { store } from "../store";
import { logout } from "../store/slices/userSlice";

// Session management utilities
const SESSION_TIMEOUT_MESSAGE = "Your session has expired. Please log in again.";
const LOGIN_REDIRECT_DELAY = 1000; // 1 second delay before redirect

// Function to handle session timeout
const handleSessionTimeout = () => {
  const isAuthenticated = store.getState().user.isAuthenticated;

  if (isAuthenticated) {
    console.warn("Session expired. Logging out user.");

    // Clear user session
    store.dispatch(logout());

    // Show user-friendly message
    if (typeof window !== "undefined") {
      window.alert(SESSION_TIMEOUT_MESSAGE);

      // Redirect to login page after delay
      setTimeout(() => {
        window.location.href = "/login";
      }, LOGIN_REDIRECT_DELAY);
    }
  }
};

const axiosInstance = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
  headers: { "Content-Type": "application/json" },
});

// Request interceptor to add auth token
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle session timeout and other errors
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle session timeout (401 Unauthorized)
    if (error.response?.status === 401) {
      handleSessionTimeout();
    }

    // Handle network errors
    if (!error.response) {
      console.error("Network error:", error.message);
      // You could show a network error message here
    }

    // Handle server errors (5xx)
    if (error.response?.status >= 500) {
      console.error("Server error:", error.response.status, error.response.data);
    }

    // Handle client errors (4xx) other than 401
    if (error.response?.status >= 400 && error.response?.status !== 401) {
      console.error("Client error:", error.response.status, error.response.data);
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
