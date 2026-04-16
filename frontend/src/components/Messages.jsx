import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../styles/Messages.css";
import ChevronLeft from "../assets/images/ChevronLeft.png";
import DefaultAvatar from "../assets/images/DefaultAvatar.png";
import { useUser } from "./UserContext";
import axios from "axios";

const Messages = () => {
    const { user } = useUser();
    const location = useLocation();
    const navigate = useNavigate();
    const backTo = location.state?.from || "/dashboard";
    const [search, setSearch] = useState("");
    const [conversationPartners, setConversationPartners] = useState([]);
    const [partnerDetails, setPartnerDetails] = useState({});
    const [selectedPartner, setSelectedPartner] = useState(null);
    const [messageHistory, setMessageHistory] = useState([]);
    const [newMessage, setNewMessage] = useState("");

    const chatAreaRef = useRef(null);
    const selectedPartnerRef = useRef(null);

    // Scroll to the bottom of the chat area whenever messageHistory changes
    useEffect(() => {
        if (chatAreaRef.current) {
            chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
        }
    }, [messageHistory]);

    const fetchConversationPartners = () => {
        if (!user) return;
        axios
            .get(`/api/conversation-partners/${user.id}`, { withCredentials: true })
            .then((response) => {
                const partners = response.data.partners;
                setConversationPartners(partners);
                fetchPartnerDetails(partners.map(p => p.partner_id));
            })
            .catch((error) => {
                console.error("Error fetching conversation partners:", error);
            });
    };

    // Fetch conversation partners on mount
    useEffect(() => {
        fetchConversationPartners();
    }, [user?.id]);

    // Poll conversation partners list every 10s to pick up new threads and reorder
    useEffect(() => {
        if (!user?.id) return;
        const interval = setInterval(fetchConversationPartners, 10000);
        return () => clearInterval(interval);
    }, [user?.id]);

    // Add new partner from location state (navigating from a job listing or profile)
    useEffect(() => {
        const state = location.state;
        if (state?.partnerId) {
            const jobId = state.jobId || null;
            const jobTitle = state.jobTitle || null;
            const exists = conversationPartners.some(
                p => p.partner_id === state.partnerId && p.job_id === jobId
            );
            if (exists) {
                setSelectedPartner({ partner_id: state.partnerId, job_id: jobId });
                fetchMessageHistory(state.partnerId, jobId);
            } else {
                setConversationPartners((prev) => [
                    ...prev,
                    { partner_id: state.partnerId, job_id: jobId, job_title: jobTitle }
                ]);
                fetchPartnerDetails([state.partnerId]);
                setSelectedPartner({ partner_id: state.partnerId, job_id: jobId });
                fetchMessageHistory(state.partnerId, jobId);
            }
        }
    }, [location.state, conversationPartners]);

    // Fetch name and photo for each unique partner
    const fetchPartnerDetails = (partnerIds) => {
        partnerIds.forEach((partnerId) => {
            if (!partnerDetails[partnerId]) {
                Promise.all([
                    axios.get(`/api/user-details/${partnerId}`, { withCredentials: true }),
                    axios.get(`/api/profile/view-photo-url/${partnerId}`, { withCredentials: true }).catch(() => null),
                ]).then(([detailsRes, photoRes]) => {
                    const { type, firstName, lastName, businessName } = detailsRes.data.userDetails;
                    const name = type === "worker" ? `${firstName} ${lastName}` : businessName;
                    const userImage = photoRes?.data?.viewUrl || null;
                    setPartnerDetails((prev) => ({ ...prev, [partnerId]: { name, userImage } }));
                }).catch((error) => {
                    console.error(`Error fetching details for partner ${partnerId}:`, error);
                });
            }
        });
    };

    // Fetch message history — filtered by gig thread if jobId provided
    const fetchMessageHistory = (partnerId, jobId) => {
        const params = { senderId: user.id, receiverId: partnerId };
        if (jobId) params.jobId = jobId;
        axios
            .get(`/api/message-history`, { params, withCredentials: true })
            .then((response) => {
                setMessageHistory(response.data.messages || []);
                setSelectedPartner({ partner_id: partnerId, job_id: jobId || null });
                axios.put(`/api/mark-as-read`, {
                    receiverId: user.id,
                    senderId: partnerId,
                }, { withCredentials: true })
                .catch((err) => console.error("Error marking messages as read:", err));
            })
            .catch((error) => {
                console.error("Error fetching message history:", error);
            });
    };

    // Keep ref in sync so polling always reads the latest selectedPartner
    useEffect(() => {
        selectedPartnerRef.current = selectedPartner;
    }, [selectedPartner]);

    // Poll for new messages every 1s while a conversation is open
    useEffect(() => {
        if (!selectedPartner) return;

        const interval = setInterval(() => {
            const partner = selectedPartnerRef.current;
            if (!partner) return;
            const params = { senderId: user.id, receiverId: partner.partner_id };
            if (partner.job_id) params.jobId = partner.job_id;
            axios
                .get(`/api/message-history`, { params, withCredentials: true })
                .then((res) => setMessageHistory(res.data.messages || []))
                .catch(() => {});
        }, 1000);

        return () => clearInterval(interval);
    }, [selectedPartner?.partner_id, selectedPartner?.job_id, user?.id]);

    // Send a typed message
    const handleSendMessage = () => {
        if (!newMessage.trim()) return;
        axios
            .post(`/api/send-message`, {
                senderId: user.id,
                receiverId: selectedPartner.partner_id,
                content: newMessage,
                jobId: selectedPartner.job_id || null,
            }, { withCredentials: true })
            .then((response) => {
                setMessageHistory((prev) => [...prev, response.data.message]);
                setNewMessage("");
            })
            .catch((error) => {
                console.error("Error sending message:", error);
            });
    };

    // Send a quick reply
    const handleQuickReply = (text) => {
        axios
            .post(`/api/send-message`, {
                senderId: user.id,
                receiverId: selectedPartner.partner_id,
                content: text,
                jobId: selectedPartner.job_id || null,
            }, { withCredentials: true })
            .then((response) => {
                setMessageHistory((prev) => [...prev, response.data.message]);
            })
            .catch((error) => {
                console.error("Error sending quick reply:", error);
            });
    };

    const handleSearchChange = (e) => {
        setSearch(e.target.value);
    };

    return (!user ? (<div>Loading...</div>) : (
        <div className="messages-container">
            <header className="messages-header">
                <img
                    className="dash-back-btn"
                    src={ChevronLeft}
                    alt="Go back"
                    onClick={() => navigate(backTo)}
                    style={{ cursor: "pointer" }}
                />
            </header>
            <div className="chat-container">
                <div className="person-list">
                    <h1 className="person-list-header">Messages</h1>
                    <input
                        type="text"
                        className="person-searchbar"
                        placeholder="Search..."
                        value={search}
                        onChange={handleSearchChange}
                    />
                    <ul className="person-list-items">
                        {conversationPartners
                            .filter((conv) => {
                                const partnerName = partnerDetails[conv.partner_id]?.name || "";
                                return partnerName.toLowerCase().includes(search.toLowerCase());
                            })
                            .map((conv, index) => {
                                const partner = partnerDetails[conv.partner_id];
                                const isLatest = index === 0;
                                const isActive = selectedPartner?.partner_id === conv.partner_id && selectedPartner?.job_id === conv.job_id;
                                return (
                                    <li
                                        key={`${conv.partner_id}-${conv.job_id || 'direct'}`}
                                        className={`person-item ${isActive ? "active" : ""} ${isLatest && !isActive ? "latest-conversation" : ""}`}
                                        onClick={() => fetchMessageHistory(conv.partner_id, conv.job_id)}
                                    >
                                        <img
                                            className="person-item-avatar"
                                            src={partner?.userImage || DefaultAvatar}
                                            alt="avatar"
                                        />
                                        <div className="person-item-text">
                                            <span className={isLatest ? "person-item-name bold" : "person-item-name"}>{partner?.name || "Loading..."}</span>
                                            {conv.job_title && <span className="job-thread-label">{conv.job_title}</span>}
                                        </div>
                                    </li>
                                );
                            })}
                    </ul>
                </div>
                <div className="chat-divider" />
                <div className="chat">
                    <h1 className="chat-header">Chat</h1>
                    <div className="chat-area" ref={chatAreaRef}>
                        {messageHistory.length > 0 ? (
                            messageHistory.map((message, index) => (
                                <div
                                    key={index}
                                    className={`chat-message ${message.is_system ? "system" : message.sender_id === user.id ? "sent" : "received"}`}
                                >
                                    {message.content}
                                    {!message.is_system && (
                                        <span className="chat-message-time">
                                            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    )}
                                </div>
                            ))
                        ) : (
                            <p className="no-chats">
                                {selectedPartner
                                    ? "No chat history available. Start a conversation!"
                                    : "No Chats Selected"}
                            </p>
                        )}
                    </div>
                    {selectedPartner && (
                        <>
                            <div className="quick-replies">
                                {["On my way", "Can't make it", "Confirmed"].map((reply) => (
                                    <button
                                        key={reply}
                                        className="quick-reply-btn"
                                        onClick={() => handleQuickReply(reply)}
                                    >
                                        {reply}
                                    </button>
                                ))}
                            </div>
                            <div className="chat-input">
                                <input
                                    type="text"
                                    placeholder="Type a message..."
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            handleSendMessage();
                                        }
                                    }}
                                />
                                <button onClick={handleSendMessage}>Send</button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    ));
};

export default Messages;
