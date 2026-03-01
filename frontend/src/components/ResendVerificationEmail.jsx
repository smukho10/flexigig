// ResendVerificationEmail.jsx

import axios from "axios";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

const MAX_RESENDS = 3;
const COOLDOWN_SECONDS = 30;

const ResendVerificationEmail = () => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [resendCount, setResendCount] = useState(0);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleResendVerification = async () => {
    if (resendCount >= MAX_RESENDS || cooldown > 0) return;

    try {
      const response = await axios.post(`/api/resend-verification`, { email }, { withCredentials: true });
      setMessage(response.data.message);
      setResendCount((prev) => prev + 1);
      setCooldown(COOLDOWN_SECONDS);
    } catch (error) {
      setMessage(error.response?.data?.message || "An error occurred");
    }
  };

  const attemptsRemaining = MAX_RESENDS - resendCount;
  const isDisabled = resendCount >= MAX_RESENDS || cooldown > 0 || !email;

  return (
    <div className="center-container">
      <h2>Enter your email to get a new verification link</h2>

      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        style={{
          color: "#4CAF50",
          cursor: "pointer",
          padding: '5px 80px',
          margin: '22px'
        }}
      />
      <button
        onClick={handleResendVerification}
        disabled={isDisabled}
        style={{
          opacity: isDisabled ? 0.5 : 1,
          cursor: isDisabled ? "not-allowed" : "pointer",
        }}
      >
        {cooldown > 0
          ? `Resend in ${cooldown}s`
          : resendCount >= MAX_RESENDS
            ? "Resend limit reached"
            : "Send Verification Email"}
      </button>
      {message && <p>{message}</p>}
      {resendCount > 0 && resendCount < MAX_RESENDS && (
        <p style={{ fontSize: "14px", color: "#666" }}>
          {attemptsRemaining} resend{attemptsRemaining !== 1 ? "s" : ""} remaining
        </p>
      )}
      {resendCount >= MAX_RESENDS && (
        <p style={{ fontSize: "14px", color: "#d32f2f" }}>
          You have reached the maximum number of resend attempts. Please try again later or contact support.
        </p>
      )}
      <Link to="/">Close</Link>
    </div>
  );
};

export default ResendVerificationEmail;
