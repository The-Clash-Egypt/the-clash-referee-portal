import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useDispatch } from "react-redux";
import { loginSchema, LoginFormData } from "../types/validation";
import { login } from "../api";
import { setUser, setToken } from "../../../store/slices/userSlice";
import { BrandLogo, Button, PhotoHeader } from "../../../ui";
import "./AuthPages.scss";

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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

        // Store user data in localStorage (unavailable in some private modes: the session still works)
        try {
          localStorage.setItem("user", JSON.stringify(response.data.data.user));
        } catch {
          // ignore
        }

        // Everyone starts on the tournaments home.
        navigate("/");
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
    <div className="login-page">
      <PhotoHeader className="login-page__top">
        <div className="login-page__topbar">
          <BrandLogo className="login-page__logo" />
        </div>
        <div className="login-page__hero">
          <h1 className="login-page__title">
            Referee <span>portal</span>
          </h1>
          <p className="login-page__subtitle">Sign in to access your match assignments and reports</p>
        </div>
      </PhotoHeader>

      <main className="login-page__sheet">
        <h2 className="login-page__heading">Log in</h2>

        {success && (
          <p className="login-page__notice" role="status">
            {success}
          </p>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="login-form">
          <div className="login-form__field">
            <label htmlFor="email" className="login-form__label">
              Email
            </label>
            <input
              type="email"
              id="email"
              autoComplete="email"
              {...register("email")}
              className={`login-form__input${errors.email ? " login-form__input--error" : ""}`}
              placeholder="Enter your email"
              disabled={isLoading}
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email?.message ? "email-error" : undefined}
            />
            {errors.email?.message && (
              <span className="login-form__error" id="email-error">
                {String(errors.email.message)}
              </span>
            )}
          </div>

          <div className="login-form__field">
            <label htmlFor="password" className="login-form__label">
              Password
            </label>
            <div className={`login-form__password${errors.password ? " login-form__password--error" : ""}`}>
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                autoComplete="current-password"
                {...register("password")}
                className="login-form__input"
                placeholder="Enter your password"
                disabled={isLoading}
                aria-invalid={errors.password ? true : undefined}
                aria-describedby={errors.password?.message ? "password-error" : undefined}
              />
              <button
                type="button"
                className="login-form__show"
                onClick={() => setShowPassword((shown) => !shown)}
                aria-controls="password"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {errors.password?.message && (
              <span className="login-form__error" id="password-error">
                {String(errors.password.message)}
              </span>
            )}
          </div>

          <Button type="submit" size="lg" block loading={isLoading} className="login-form__submit">
            Log in
          </Button>

          {error && (
            <p className="login-form__alert" role="alert">
              {error}
            </p>
          )}
        </form>

        <p className="login-page__help">Need access? Contact your administrator for an invitation link.</p>
      </main>
    </div>
  );
};

export default LoginPage;
