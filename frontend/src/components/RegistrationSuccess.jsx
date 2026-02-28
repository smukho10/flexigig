// RegistrationSuccess.js
import axios from "axios";
import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

const MAX_RESENDS = 3;
const COOLDOWN_SECONDS = 30;

const RegistrationSuccess = () => {
  const location = useLocation();
  const email = location.state?.email || "";

  const [resendCount, setResendCount] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleResend = async () => {
    if (resendCount >= MAX_RESENDS || cooldown > 0 || !email) return;

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
      <h2>Registration Successful</h2>
      <p>A verification email has been sent to your inbox. Please check your email to complete the registration process.</p>

      {email && (
        <>
          <button
            onClick={handleResend}
            disabled={isDisabled}
            style={{
              marginTop: "15px",
              padding: "10px 20px",
              backgroundColor: isDisabled ? "#ccc" : "#4CAF50",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: isDisabled ? "not-allowed" : "pointer",
              fontSize: "14px",
            }}
          >
            {cooldown > 0
              ? `Resend in ${cooldown}s`
              : resendCount >= MAX_RESENDS
                ? "Resend limit reached"
                : "Resend Verification Email"}
          </button>

          {message && <p style={{ marginTop: "10px" }}>{message}</p>}

          {resendCount > 0 && resendCount < MAX_RESENDS && (
            <p style={{ fontSize: "14px", color: "#666", marginTop: "5px" }}>
              {attemptsRemaining} resend{attemptsRemaining !== 1 ? "s" : ""} remaining
            </p>
          )}

          {resendCount >= MAX_RESENDS && (
            <p style={{ fontSize: "14px", color: "#d32f2f", marginTop: "5px" }}>
              Maximum resend attempts reached. Please check your spam folder or contact support.
            </p>
          )}
        </>
      )}

      <Link
        to="/signin"
        style={{
          marginTop: "15px",
          color: "#4CAF50",
          textDecoration: "underline",
          cursor: "pointer",
        }}
      >
        Back to Sign In
      </Link>
    </div>
  );
};

export default RegistrationSuccess;
