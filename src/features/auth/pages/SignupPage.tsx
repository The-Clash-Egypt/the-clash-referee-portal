import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useSearchParams, useNavigate, useParams } from "react-router-dom";
import { signupSchema, SignupFormData } from "../types/validation";
import { signup } from "../api";
import "./AuthPages.scss";

const SignupPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const params = useParams();
  const [invitationToken, setInvitationToken] = useState<string | null>(null);
  const [isValidInvitation, setIsValidInvitation] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>("referee");

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  });

  useEffect(() => {
    const token = searchParams.get("token");
    const role = searchParams.get("role");
    const pathRole = params.role;

    setInvitationToken(token);

    // Set role if provided in URL query params or path params
    if (role) {
      setSelectedRole(role);
    } else if (pathRole) {
      setSelectedRole(pathRole);
    }

    // Handle different signup scenarios
    if (token) {
      // Token-based invitation (existing flow)
      setIsValidInvitation(true);
    } else if (role === "referee" || pathRole === "referee") {
      // Role-based signup (new flow for referee recruitment)
      setIsValidInvitation(true);
    } else if (pathRole) {
      // Any role-based signup (for future extensibility)
      setIsValidInvitation(true);
    } else {
      // No token and no valid role - redirect to login
      window.location.href = "/";
    }
  }, [searchParams, params]);

  // Set role value in form when selectedRole changes
  useEffect(() => {
    if (selectedRole) {
      setValue("role", selectedRole);
    }
  }, [selectedRole, setValue]);

  const onSubmit = async (data: SignupFormData) => {
    try {
      setIsLoading(true);
      setError("");

      console.log("Signup data:", data);
      console.log("Invitation token:", invitationToken);

      // Add role to signup data if not provided in token-based invitation
      const signupData = invitationToken ? data : { ...data, role: selectedRole };
      const response = await signup(signupData, invitationToken || undefined);

      // Handle successful signup
      console.log("Signup successful:", response);

      // Redirect to login page with success message
      navigate("/?message=Account created successfully. Please sign in.");
    } catch (error: any) {
      console.error("Signup error:", error);

      // Handle different types of errors
      if (error.response?.status === 400) {
        setError("Please check your information and try again.");
      } else if (error.response?.status === 409) {
        setError("An account with this email already exists.");
      } else if (error.response?.data?.message) {
        setError(error.response.data.message);
      } else {
        setError("An error occurred during registration. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!isValidInvitation) {
    return (
      <div className="auth-container">
        <div className="auth-wrapper">
          <div className="auth-header-section">
            <div className="auth-brand">
              <div className="auth-logo">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M12 2L2 7L12 12L22 7L12 2Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M2 17L12 22L22 17"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M2 12L12 17L22 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h1 className="auth-title">The Clash</h1>
              <p className="auth-subtitle">Referee Management System</p>
            </div>
          </div>

          <div className="auth-card">
            <div className="auth-header">
              <h2>Invalid Invitation</h2>
              <p>
                This invitation link is invalid or has expired. Please contact your administrator for a new invitation.
              </p>
            </div>
            <div className="auth-footer">
              <Link to="/" className="auth-button">
                Return to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-wrapper">
        <div className="auth-header-section">
          <div className="auth-brand">
            <div className="auth-logo">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M12 2L2 7L12 12L22 7L12 2Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M2 17L12 22L22 17"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M2 12L12 17L22 12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h1 className="auth-title">The Clash</h1>
            <p className="auth-subtitle">Referee Management System</p>
          </div>
        </div>

        <div className="auth-card">
          <div className="auth-header">
            <h2>Complete Your Registration</h2>
            <p>You've been invited to join the referee portal. Please complete your account setup.</p>
          </div>

          {error && (
            <div className="auth-error">
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="auth-form">
            {selectedRole && (
              <div className="role-display">
                <label>Role</label>
                <div className="role-badge">
                  <span className="role-icon">👨‍⚖️</span>
                  <span className="role-text">{selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}</span>
                </div>
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="firstName">First Name</label>
                <input
                  type="text"
                  id="firstName"
                  {...register("firstName")}
                  className={errors.firstName ? "error" : ""}
                  placeholder="Enter your first name"
                  disabled={isLoading}
                />
                {errors.firstName?.message && <span className="error-message">{String(errors.firstName.message)}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="lastName">Last Name</label>
                <input
                  type="text"
                  id="lastName"
                  {...register("lastName")}
                  className={errors.lastName ? "error" : ""}
                  placeholder="Enter your last name"
                  disabled={isLoading}
                />
                {errors.lastName?.message && <span className="error-message">{errors.lastName.message}</span>}
              </div>
            </div>

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
              {errors.email?.message && <span className="error-message">{errors.email.message}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="phoneNumber">Phone Number</label>
              <input
                type="tel"
                id="phoneNumber"
                {...register("phoneNumber")}
                className={errors.phoneNumber ? "error" : ""}
                placeholder="Enter your phone number"
                disabled={isLoading}
              />
              {errors.phoneNumber?.message && <span className="error-message">{errors.phoneNumber.message}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="gender">Gender</label>
              <select id="gender" {...register("gender")} className={errors.gender ? "error" : ""} disabled={isLoading}>
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
              {errors.gender?.message && <span className="error-message">{String(errors.gender.message)}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="birthdate">Birthdate (Optional)</label>
              <input
                type="date"
                id="birthdate"
                {...register("birthdate")}
                className={errors.birthdate ? "error" : ""}
                disabled={isLoading}
              />
              {errors.birthdate?.message && <span className="error-message">{errors.birthdate.message}</span>}
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
              {errors.password?.message && <span className="error-message">{errors.password.message}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                {...register("confirmPassword")}
                className={errors.confirmPassword ? "error" : ""}
                placeholder="Confirm your password"
                disabled={isLoading}
              />
              {errors.confirmPassword?.message && (
                <span className="error-message">{errors.confirmPassword.message}</span>
              )}
            </div>

            <button type="submit" disabled={isLoading} className="auth-button">
              {isLoading ? "Creating account..." : "Complete Registration"}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              Already have an account?{" "}
              <Link to="/" className="auth-link">
                Sign in here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
