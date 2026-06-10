import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import "./AuthPages.css";

export function RegisterPage() {
  const navigate = useNavigate();
  const { register, isLoading, error: authError } = useAuth();
  const [step, setStep] = useState<"register" | "otp">("register");
  const [otpRequestId, setOtpRequestId] = useState("");
  const [expiresInSec, setExpiresInSec] = useState(0);

  // Register form
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");

  // OTP form
  const [otpCode, setOtpCode] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const { verifyOtp } = useAuth();

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !username || !password || !displayName) {
      setError("Please fill in all fields");
      return;
    }

    try {
      const response = await register(email, username, password, displayName);
      setOtpRequestId(response.otpRequestId);
      setExpiresInSec(response.expiresInSec);
      setStep("otp");
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Registration failed";
      setError(errorMsg);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!otpCode || otpCode.length !== 6) {
      setError("OTP must be 6 digits");
      return;
    }

    setVerifyLoading(true);
    try {
      await verifyOtp(otpRequestId, otpCode);
      navigate("/home");
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "OTP verification failed";
      setError(errorMsg);
    } finally {
      setVerifyLoading(false);
    }
  };

  if (step === "otp") {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <h1>E2EE Chat</h1>
          <h2>Verify Email</h2>
          <form onSubmit={handleOtpSubmit}>
            <div className="form-group">
              <label htmlFor="otpCode">OTP Code (check your email)</label>
              <input
                id="otpCode"
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                disabled={verifyLoading}
              />
              <small>OTP expires in {expiresInSec} seconds</small>
            </div>
            {(error || authError) && (
              <div className="error-message">{error || authError}</div>
            )}
            <button type="submit" disabled={verifyLoading || isLoading}>
              {verifyLoading || isLoading ? "Verifying..." : "Verify"}
            </button>
          </form>
          <p>
            <button
              type="button"
              className="link-button"
              onClick={() => setStep("register")}
            >
              Back to register
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <h1>E2EE Chat</h1>
        <h2>Register</h2>
        <form onSubmit={handleRegisterSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              disabled={isLoading}
            />
          </div>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
              disabled={isLoading}
            />
          </div>
          <div className="form-group">
            <label htmlFor="displayName">Display Name</label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your Display Name"
              disabled={isLoading}
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={isLoading}
            />
          </div>
          {(error || authError) && (
            <div className="error-message">{error || authError}</div>
          )}
          <button type="submit" disabled={isLoading}>
            {isLoading ? "Registering..." : "Register"}
          </button>
        </form>
        <p>
          Already have an account?{" "}
          <button
            type="button"
            className="link-button"
            onClick={() => navigate("/login")}
          >
            Login here
          </button>
        </p>
      </div>
    </div>
  );
}
