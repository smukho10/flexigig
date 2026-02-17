import React, { useState, useEffect } from 'react';
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

const DashboardHeader = () => {

    const { user } = useUser();
    const { worker } = useWorker();
    const { business } = useBusiness();
    const { logout } = useUser();

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [profilePhotoUrl, setProfilePhotoUrl] = useState(null);

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
            <div className="header-section left">
                <div className="logo">
                    <img src={flexygig} alt="Flexygig Logo" className="logo-img" />
                    <h1 className="logo-name">
                        <span className="flexy">FLEXY</span>
                        <span className="gig">GIG</span>
                    </h1>
                </div>
            </div>

            <div className="header-section center">
                <input type="text"
                    className="search-bar"
                    placeholder="Search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                />
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

            <Link to="/notifications" className="notification-btn">
                <img src={NotificationIcon} alt="Notifications" className="notification-icon" />
            </Link>
        </div>
    );
};

export default DashboardHeader;