
import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from "react-router-dom";
import '../styles/SignIn.css'
import FlexygigLogo from "../assets/images/FlexygigLogo.png"
import ChevronLeft from "../assets/images/ChevronLeft.png"

const PasswordResetInitiation = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const handleInitiatePasswordReset = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/initiate-password-reset`, { email }, { withCredentials: true });
      setMessage(response.data.message);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Error initiating password reset');
    }
  };

  return (
    <div className="sign-in-container">
      <button id="back-button" onClick={() => navigate("/signin")}><img src={ChevronLeft} alt="Back to text" /></button>
      <img id="sign-in-logo" src={FlexygigLogo} alt="logo" />
      <p id="header-1">Forgot Password?</p>
      <p id="header-2">Enter your email to receive a reset link</p>

      <form className="form-group" onSubmit={handleInitiatePasswordReset}>
        <div>
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <button type="submit">Send Reset Link</button>
        </div>
      </form>
      {message && <p id="error-message" style={{ color: message.includes('sent') ? 'green' : '#BE0340' }}>{message}</p>}
    </div>
  );
};

export default PasswordResetInitiation;
