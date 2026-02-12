import "../styles/SignIn.css";
import axios from "axios";
import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useUser } from "./UserContext";
import FlexygigLogo from "../assets/images/FlexygigLogo.png"
import ChevronLeft from "../assets/images/ChevronLeft.png"

const SignIn = () => {
  const [errorMessage, setErrorMessage] = useState("");
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const error = searchParams.get('error');
    if (error === 'oauth_failed') {
      setErrorMessage('Google sign-in failed. Please try again.');
    } else if (error === 'session_error') {
      setErrorMessage('Session error. Please try again.');
    }
  }, [searchParams]);
  const [signInData, setSignInData] = useState({
    email: "",
    password: "",
  });
  const navigate = useNavigate();
  const { setUser } = useUser();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSignInData({ ...signInData, [name]: value });
  };

  const handleSignIn = (e) => {
    e.preventDefault();
    axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/login`, signInData, { withCredentials: true })
      .then(async (response) => {
        if (
          response.data.success === false ||
          response.data.message === "Account not activated. Please check your email for verification."
        ) {
          setErrorMessage(response.data.message);
        } else {
          try {
            // Fetch the full user object including userImage
            const userRes = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/me`, { withCredentials: true });

            localStorage.setItem("user", JSON.stringify(userRes.data));
            setUser(userRes.data);

            navigate("/dashboard");
          } catch (err) {
            console.error("Failed to fetch user after login:", err);
            setErrorMessage("Could not fetch user info after login.");
          }
        }
      })
      .catch((error) => {
        setErrorMessage(
          error.response && error.response.data && error.response.data.message
            ? error.response.data.message
            : "Invalid credentials. Please try again."
        );
      });
  };

  return (
    <div className="sign-in-container">

      <button id="back-button" onClick={() => navigate("/")}><img src={ChevronLeft} alt="Back to home" /></button>

      <img id="sign-in-logo" src={FlexygigLogo} alt="logo" />
      <p id="header-1">Login to Your Account</p>
      <p id="header-2">Welcome back!</p>
      <div className="social-login-buttons">
        <button
          type="button"
          className="google-signin-btn"
          onClick={() => {
            window.location.href = `${process.env.REACT_APP_BACKEND_URL}/api/auth/google`;
          }}
        >
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>
      </div>
      <div className="divider">
        <span>or</span>
      </div>
      <Link id="reset-link" to="/initiate-password-reset">Forgot password</Link>
      <form className="form-group" onSubmit={handleSignIn}>
        <div>
          <label htmlFor="signInEmail">Email</label>
          <input
            type="email"
            id="signInEmail"
            name="email"
            value={signInData.email}
            onChange={handleChange}
            required
            placeholder="Enter your email"
          />
        </div>
        <div>
          <label htmlFor="signInPassword">Password</label>
          <input
            type="password"
            id="signInPassword"
            name="password"
            value={signInData.password}
            onChange={handleChange}
            required
            placeholder="••••••••"
          />
        </div>
        <div>
          <button type="submit">Sign In</button>
        </div>
      </form>
      {errorMessage && <p style={{ color: "#BE0340" }}>{errorMessage}</p>}
      <Link id="register-link" to="/account-selection">Don't have an account?</Link>
    </div>
  );
};

export default SignIn;
