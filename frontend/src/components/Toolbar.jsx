import React, { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import axios from "axios";
import EnvelopeIcon from "../assets/images/EnvelopeIcon.png";
import CalendarIcon from "../assets/images/CalendarIcon.png";
import MessagesIcon from "../assets/images/ChatIcon.png";
import FolderAddIcon from "../assets/images/FolderAddIcon.png";
import UserIcon from "../assets/images/UserIcon.png";
import HomeIcon from "../assets/images/HomeIcon.png";
import AddIcon from "../assets/images/AddIcon.png";
import { useUser } from "./UserContext";
import "../styles/Toolbar.scss";

const Toolbar = () => {
  const { user } = useUser();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = useCallback(() => {
    if (!user?.id) return;
    axios
      .get(`/api/unread-count/${user.id}`, { withCredentials: true })
      .then((res) => setUnreadCount(res.data.unreadCount || 0))
      .catch(() => setUnreadCount(0));
  }, [user?.id]);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Listen for notificationsRead event
  useEffect(() => {
    const handleNotificationsRead = () => {
      setUnreadCount(0);
      setTimeout(fetchUnreadCount, 500);
    };
    window.addEventListener("notificationsRead", handleNotificationsRead);
    return () => window.removeEventListener("notificationsRead", handleNotificationsRead);
  }, [fetchUnreadCount]);

  if (!user) {
    return (
      <div className="toolbar">
        <Link to="/signin">
          <p>Please sign in</p>
        </Link>
      </div>
    );
  }

  // Helper function to determine if a link is active
  const isActive = (path) => location.pathname === path;

  return (
    <div className="toolbar">
      <div className="toolbar-items">
        <p id="toolbar-menu">MENU</p>
        <Link to="/dashboard" className={isActive("/dashboard") ? "active" : ""}>
          <img src={HomeIcon} alt="Home" className="toolbar-icon" />
          <p>Home</p>
        </Link>
        <Link to="/notifications" className={`${isActive("/notifications") ? "active" : ""} toolbar-notifications-link`}>
          <img src={EnvelopeIcon} alt="Notifications" className="toolbar-icon" />
          <p>Notifications</p>
          {unreadCount > 0 && (
            <span className="toolbar-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
          )}
        </Link>
        <Link to="/messages" className={isActive("/messages") ? "active" : ""}>
          <img src={MessagesIcon} alt="Messages" className="toolbar-icon" />
          <p>Messages</p>
        </Link>
        <p id="toolbar-others">OTHERS</p>
        {user.isbusiness ? (
          <Link to="/worker-board" className={isActive("/worker-board") ? "active" : ""}>
            <img src={AddIcon} alt="Worker Board" className="toolbar-icon" />
            <p>Worker Board</p>
          </Link>
        ) : (
          <Link to="/find-gigs" className={isActive("/find-gigs") ? "active" : ""}>
            <img src={AddIcon} alt="Find Gigs" className="toolbar-icon" />
            <p>Find Gigs</p>
          </Link>
        )}
        {user.isbusiness ? (
          <Link to="/my-jobs" className={isActive("/my-jobs") ? "active" : ""}>
            <img src={FolderAddIcon} alt="My Jobs" className="toolbar-icon" />
            <p>My Jobs</p>
          </Link>
        ) : (
          <>
            <Link to="/jobs-applied" className={isActive("/jobs-applied") ? "active" : ""}>
              <img src={FolderAddIcon} alt="Jobs Applied" className="toolbar-icon" />
              <p>Jobs Applied</p>
            </Link>
            <Link to="/my-gigs" className={isActive("/my-gigs") ? "active" : ""}>
              <img src={FolderAddIcon} alt="My Gigs" className="toolbar-icon" />
              <p>My Gigs</p>
            </Link>
          </>
        )}
        <Link to="/profile" className={isActive("/profile") ? "active" : ""}>
          <img src={UserIcon} alt="Profile" className="toolbar-icon" />
          <p>Profile</p>
        </Link>
      </div>
    </div>
  );
};

export default Toolbar;