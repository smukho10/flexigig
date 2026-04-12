import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import "../styles/DashboardHeader.scss";
import flexygig from "../assets/images/gigs.png";
import { Link } from "react-router-dom";
import NotificationIcon from "../assets/images/NotificationIcon.png";
import DefaultAvatar from "../assets/images/DefaultAvatar.png";
import { useUser } from "./UserContext";
import { useWorker } from './WorkerContext';
import { useBusiness } from './BusinessContext';
import { useNavigate } from "react-router-dom";

const DashboardHeader = ({ onMenuToggle }) => {

    const { user } = useUser();
    const { worker } = useWorker();
    const { business } = useBusiness();
    const { logout } = useUser();

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [profilePhotoUrl, setProfilePhotoUrl] = useState(null);
    const [unreadCount, setUnreadCount] = useState(0);

    const toggleDropdown = () => {
        setIsDropdownOpen(!isDropdownOpen);
    };

    const navigate = useNavigate();
    const handleSignOut = async () => {

        await logout();
        navigate("/", { replace: true });
    };

    const [searchTerm, setSearchTerm] = useState("");
    const handleSearchKeyDown = (e) => {
        if (e.key === 'Enter') {
            const trimmed = searchTerm.trim();
            if (trimmed.length > 0) {
                navigate(`/search?query=${encodeURIComponent(trimmed)}`);
            } else {
                navigate(`/search`);
            }
        }
    };

    // Fetch unread count for bell badge
    const fetchUnreadCount = useCallback(() => {
        if (!user?.id) return;
        axios
            .get(`/api/unread-count/${user.id}`, { withCredentials: true })
            .then((res) => setUnreadCount(res.data.unreadCount || 0))
            .catch(() => setUnreadCount(0));
    }, [user?.id]);

    // Poll unread count every 30 seconds
    useEffect(() => {
        fetchUnreadCount();
        const interval = setInterval(fetchUnreadCount, 30000);
        return () => clearInterval(interval);
    }, [fetchUnreadCount]);

    // Listen for notificationsRead event to refresh badge
    useEffect(() => {
        const handleNotificationsRead = () => {
            setUnreadCount(0);
            // Re-fetch after a brief delay to sync with backend
            setTimeout(fetchUnreadCount, 500);
        };
        window.addEventListener("notificationsRead", handleNotificationsRead);
        return () => window.removeEventListener("notificationsRead", handleNotificationsRead);
    }, [fetchUnreadCount]);

    useEffect(() => {
        const fetchProfilePhoto = async () => {
            if (!user?.id) return;
            try {
                const res = await axios.get(
                    `/api/profile/view-photo-url/${user.id}`,
                    { withCredentials: true }
                );
                setProfilePhotoUrl(res.data.viewUrl);
            } catch (error) {
                setProfilePhotoUrl(null);
            }
        };
        fetchProfilePhoto();

        const handlePhotoUpdated = () => fetchProfilePhoto();
        window.addEventListener("profilePhotoUpdated", handlePhotoUpdated);
        return () => window.removeEventListener("profilePhotoUpdated", handlePhotoUpdated);
    }, [user?.id]);

    const profilePic = profilePhotoUrl || DefaultAvatar;

    return (
        <div className="dashboard-header">
            <button className="hamburger-btn" onClick={onMenuToggle} aria-label="Open navigation menu">
                <span></span><span></span><span></span>
            </button>

            <div className="header-section left">
                <div className="logo">
                    <img src={flexygig} alt="Flexygig Logo" className="logo-img" />
                    <h1 className="logo-name">
                        <span className="flexy">FLEXY</span>
                        <span className="gig">GIG</span>
                    </h1>
                </div>
            </div>

            <div className="header-section right">
                <div className="user-menu">
                    <div className="user-info" onClick={toggleDropdown}>
                        <img src={profilePic} alt="User Avatar" className="user-avatar" />
                        <span className="user-name">
                            {user ? user.isbusiness ? business?.business_name || "Business" : `${worker?.first_name || "User"}` : "User"}
                        </span>
                        <span className="dropdown-arrow">▼</span>
                    </div>
                </div>

                {isDropdownOpen && (
                    <div className="dropdown-menu">
                        <Link to="/profile" className="dropdown-item">View Profile</Link>
                        <button onClick={handleSignOut} className="dropdown-item logout-button">Sign Out</button>

                    </div>
                )}
            </div>

            <Link to="/notifications" className="notification-btn" id="notification-bell">
                <img src={NotificationIcon} alt="Notifications" className="notification-icon" />
                {unreadCount > 0 && (
                    <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                )}
            </Link>
        </div>
    );
};

export default DashboardHeader;