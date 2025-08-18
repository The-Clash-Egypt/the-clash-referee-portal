import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useDispatch } from "react-redux";
import { loginSchema, LoginFormData } from "../types/validation";
import { login } from "../api";
import { setUser, setToken } from "../../../store/slices/userSlice";
import "./AuthPages.scss";

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    const message = searchParams.get("message");
    if (message) {
      setSuccess(message);
      // Clear the message from URL
      navigate("/", { replace: true });
    }
  }, [searchParams, navigate]);

  const onSubmit = async (data: LoginFormData) => {
    try {
      setIsLoading(true);
      setError("");
      setSuccess("");

      const response = await login({
        email: data.email,
        password: data.password,
      });

      // Check if the response is successful
      if (response.data.success) {
        // Store the token and user data in Redux
        dispatch(setToken(response.data.data.token));
        dispatch(setUser(response.data.data.user));

        // Store user data in localStorage
        localStorage.setItem("user", JSON.stringify(response.data.data.user));

        // Redirect based on user role
        const userRole = response.data.data.user.role;
        if (userRole === "admin") {
          navigate("/admin");
        } else {
          navigate("/matches");
        }
      } else {
        // Handle unsuccessful response
        setError(response.data.message || "Login failed. Please try again.");
      }
    } catch (error: any) {
      console.error("Login error:", error);

      // Handle different types of errors
      if (error.response?.status === 401) {
        setError("Invalid email or password. Please try again.");
      } else if (error.response?.status === 400) {
        setError("Please check your email and password format.");
      } else if (error.response?.data?.message) {
        setError(error.response.data.message);
      } else {
        setError("An error occurred during login. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-wrapper">
        <div className="auth-header-section">
          <div className="auth-brand">
            <div className="auth-logo">
              <img src={require("../../../assets/images/logo.png")} alt="The Clash" />
            </div>
            <h1 className="auth-title">The Clash</h1>
            <p className="auth-subtitle">Referee Management System</p>
          </div>
        </div>

        <div className="auth-card">
          <div className="auth-header">
            <h2>Welcome Back</h2>
            <p>Sign in to access your match assignments and reports</p>
          </div>

          {error && (
            <div className="auth-error">
              <p>{error}</p>
            </div>
          )}

          {success && (
            <div className="auth-success">
              <p>{success}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="auth-form">
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                {...register("email")}
                className={errors.email ? "error" : ""}
                placeholder="Enter your email"
                disabled={isLoading}
              />
              {errors.email?.message && <span className="error-message">{String(errors.email.message)}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                {...register("password")}
                className={errors.password ? "error" : ""}
                placeholder="Enter your password"
                disabled={isLoading}
              />
              {errors.password?.message && <span className="error-message">{String(errors.password.message)}</span>}
            </div>

            <button type="submit" disabled={isLoading} className="auth-button">
              {isLoading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="auth-footer">
            <p>Need access? Contact your administrator for an invitation link.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
