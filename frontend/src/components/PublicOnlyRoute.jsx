import React from "react";
import { Navigate } from "react-router-dom";
import { useUser } from "./UserContext";

// Prevents logged-in users from accessing public-only pages like /signin.
// - While auth is loading, use localStorage for an immediate redirect (handles browser back button).
// - After the API check completes, redirect if a valid session exists.
// - If session is expired/invalid (user=null after loading), allow access normally.
const PublicOnlyRoute = ({ children }) => {
  const { user, loading } = useUser();

  if (loading) {
    // Quick check: if localStorage still has user data, redirect before API resolves.
    // This prevents a brief flash of the login page on back-button press.
    if (localStorage.getItem("user")) {
      return <Navigate to="/dashboard" replace />;
    }
    return null;
  }

  // API check complete — valid session exists, send to dashboard
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  // No valid session (expired, invalid, or not logged in) — allow login page
  return children;
};

export default PublicOnlyRoute;
