import axios from "axios";
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import '../styles/SignIn.css';
import FlexygigLogo from "../assets/images/FlexygigLogo.png";

const PasswordReset = () => {
  const { uniqueIdentifier } = useParams();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [valid, setValid] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/validate-token/${uniqueIdentifier}`, { withCredentials: true }).then((response) => {
      if (response.data === "valid") {
        setValid(true);
      } else {
        setValid(false);
      }
    }).catch(() => setValid(false));
  }, [uniqueIdentifier]);

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage("Passwords do not match");
      return;
    }
    try {
      const response = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/reset-password`, {
        newPassword,
        confirmPassword,
        uniqueIdentifier,
      }, { withCredentials: true });

      setMessage(response?.data?.message || "Password reset successful");
      setTimeout(() => navigate('/signin'), 2000);
    } catch (error) {
      console.error(error);
      setMessage("Error resetting password");
    }
  };

  if (!valid) {
    return (
      <div className="sign-in-container">
        <p style={{ color: '#BE0340' }}>Invalid or expired password reset link.</p>
        <button className="form-group" style={{ marginTop: '20px', width: 'auto', padding: '10px 20px' }} onClick={() => navigate('/signin')}>Back to Sign In</button>
      </div>
    );
  }

  return (
    <div className="sign-in-container">
      <img id="sign-in-logo" src={FlexygigLogo} alt="logo" />
      <p id="header-1">Reset Password</p>
      <p id="header-2">Enter your new password below</p>

      <form className="form-group" onSubmit={handleResetPassword}>
        <div>
          <label htmlFor="newPassword">New Password</label>
          <input
            type="password"
            id="newPassword"
            placeholder="••••••••"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>
        <div>
          <label htmlFor="confirmPassword">Confirm Password</label>
          <input
            type="password"
            id="confirmPassword"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>
        <div>
          <button type="submit">Reset Password</button>
        </div>
      </form>
      {message && <p id="error-message" style={{ color: message.includes('successful') ? 'green' : '#BE0340' }}>{message}</p>}
    </div>
  );
};

export default PasswordReset;
