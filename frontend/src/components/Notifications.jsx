import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useUser } from "./UserContext";
import DefaultAvatar from "../assets/images/DefaultAvatar.png";
import "../styles/Notifications.css";

const Notifications = () => {
    const { user } = useUser();
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user?.id) return;

        // Fetch notifications
        axios
            .get(`/api/notifications/${user.id}`, { withCredentials: true })
            .then((res) => {
                const fetchedNotifications = res.data.notifications || [];
                // Guarantee the UI always keeps a maximum of 10 newest notifications
                setNotifications(fetchedNotifications.slice(0, 10));
                setLoading(false);
            })
            .catch((err) => {
                console.error("Error fetching notifications:", err);
                setNotifications([]);
                setLoading(false);
            });

        // Mark all as read
        axios
            .put(`/api/notifications/mark-read/${user.id}`, {}, { withCredentials: true })
            .then(() => {
                // Dispatch event so the header badge updates
                window.dispatchEvent(new Event("notificationsRead"));
            })
            .catch((err) => console.error("Error marking notifications as read:", err));
    }, [user?.id]);

    const handleReply = (notification) => {
        navigate("/messages", {
            state: {
                partnerId: notification.sender_id,
                jobId: notification.job_id || null,
                jobTitle: notification.job_title || null,
                from: "/notifications",
            },
        });
    };

    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return "Just now";
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString([], { month: "short", day: "numeric" });
    };

    if (!user) return <div className="notifications-container"><p>Loading...</p></div>;

    return (
        <div className="notifications-container">
            <div className="notifications-header">
                <h1 className="notifications-title">Notifications</h1>
                <p className="notifications-subtitle">
                    {notifications.length > 0
                        ? `You have ${notifications.length} new notification${notifications.length > 1 ? "s" : ""}`
                        : "You're all caught up!"}
                </p>
            </div>

            <div className="notifications-list">
                {loading ? (
                    <div className="notifications-loading">
                        <div className="loading-spinner"></div>
                        <p>Loading notifications...</p>
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="notifications-empty">
                        <h2>No new notifications</h2>
                        <p>When you receive a new message, it will appear here.</p>
                    </div>
                ) : (
                    notifications.map((notif, index) => {
                        const isAcceptance = notif.content.includes("Congratulations, your application has been accepted");
                        const isSystemNotif = notif.content.includes("New recommended gig") || notif.content.includes("reminder");
                        return (
                        <div
                            key={notif.message_id || index}
                            className={`notification-card ${isAcceptance ? "notification-card--accepted" : ""}`}
                            style={{ animationDelay: `${index * 0.05}s` }}
                        >
                            <div className="notification-avatar-wrapper">
                                <img
                                    src={notif.sender_photo_url || DefaultAvatar}
                                    alt={notif.sender_name || "User"}
                                    className="notification-avatar"
                                />
                                <div className={`notification-unread-dot ${isAcceptance ? "notification-unread-dot--accepted" : ""}`}></div>
                            </div>
                            <div className="notification-content">
                                <div className="notification-top-row">
                                    <span className="notification-sender">{notif.sender_name || "Unknown User"}</span>
                                    <span className="notification-time">{formatTime(notif.timestamp)}</span>
                                </div>
                                {notif.job_title && (
                                    <span className={`notification-job-tag ${isAcceptance ? "notification-job-tag--accepted" : ""}`}>
                                        {notif.job_title}
                                    </span>
                                )}
                                <p className="notification-message">
                                    {notif.content.length > 120
                                        ? notif.content.substring(0, 120) + "..."
                                        : notif.content}
                                </p>
                                {!isAcceptance && !isSystemNotif && (
                                <button
                                    className="notification-reply-btn"
                                    onClick={() => handleReply(notif)}
                                >
                                    Reply
                                </button>
                                )}
                            </div>
                        </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default Notifications;
