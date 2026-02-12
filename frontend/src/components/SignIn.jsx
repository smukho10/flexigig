import "../styles/SignIn.css";
import axios from "axios";
import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useUser } from "./UserContext";
import FlexygigLogo from "../assets/images/FlexygigLogo.png";
import ExtraSignInMock from "../assets/images/ExtraSignInMock.png";
import ChevronLeft from "../assets/images/ChevronLeft.png";

const SignIn = () => {
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signInData, setSignInData] = useState({ email: "", password: "" });

  const navigate = useNavigate();
  const { setUser } = useUser();

  const api = useMemo(() => {
    const client = axios.create({
      baseURL: process.env.REACT_APP_BACKEND_URL,
      withCredentials: true,
    });
    return client;
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSignInData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      await api.post("/api/login", signInData);

      const userRes = await api.get("/api/me");

      localStorage.setItem("user", JSON.stringify(userRes.data));
      setUser(userRes.data);

      navigate("/dashboard");
    } catch (error) {
      const status = error?.response?.status;
      const msg = error?.response?.data?.message || error?.response?.data?.error;

      if (status === 409) {
        setErrorMessage(
          msg ||
            "This account is already logged in on another device. Please log out there first."
        );
        return;
      }

      if (status === 401) {
        setErrorMessage(
          msg ||
            "Your session is no longer valid (you may have logged in on another device). Please sign in again."
        );
        return;
      }

      setErrorMessage(msg || "Invalid credentials. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="sign-in-container">
      <button id="back-button" onClick={() => navigate("/")}>
        <img src={ChevronLeft} alt="Back to home" />
      </button>

      <img id="sign-in-logo" src={FlexygigLogo} alt="logo" />
      <p id="header-1">Login to Your Account</p>
      <p id="header-2">Welcome back!</p>

      <img id="mock" src={ExtraSignInMock} alt="mock" />

      <Link id="reset-link" to="/initiate-password-reset">
        Forgot password
      </Link>

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
            disabled={isSubmitting}
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
            disabled={isSubmitting}
          />
        </div>

        <div>
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing In..." : "Sign In"}
          </button>
        </div>
      </form>

      {errorMessage && <p style={{ color: "#BE0340" }}>{errorMessage}</p>}

      <Link id="register-link" to="/account-selection">
        Don't have an account?
      </Link>
    </div>
  );
};

export default SignIn;
