import React, { useState, useEffect } from "react";
import "../styles/MessageWidget.css";
import Arrow from "../assets/images/arrow-more.svg";
import DefaultAvatar from "../assets/images/DefaultAvatar.png";
import axios from "axios";
import { useUser } from "./UserContext";

const MessageWidget = () => {
  const { user } = useUser(); // Get the logged-in user
  const [messages, setMessages] = useState([]);
  const [senderDetails, setSenderDetails] = useState({});
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch the latest messages
  useEffect(() => {
    if (user) {
      axios
        .get(`/api/latest-messages/${user.id}`, { withCredentials: true })
        .then((response) => {
          setMessages(response.data.messages);
          fetchSenderDetails(response.data.messages);
        })
        .catch((error) => {
          if (error.response && error.response.status === 404) {
            setMessages([]);
          } else {
            console.error("Error fetching latest messages:", error);
          }
        });

      axios
        .get(`/api/unread-count/${user.id}`, { withCredentials: true })
        .then((response) => {
          setUnreadCount(response.data.unreadCount);
        })
        .catch((error) => {
          console.error("Error fetching unread count:", error);
        });
    }
  }, [user]);

  // Fetch sender details (name + profile picture) for each message
  const fetchSenderDetails = (messages) => {
    const details = {};
    messages.forEach((message) => {
      if (!senderDetails[message.sender_id]) {
        axios
          .get(`/api/user-details/${message.sender_id}`, { withCredentials: true })
          .then((response) => {
            const { type, firstName, lastName, businessName, userImage } = response.data.userDetails;
            details[message.sender_id] = {
              name: type === "worker" ? `${firstName} ${lastName}` : businessName,
              userImage: userImage || null,
            };
            setSenderDetails((prev) => ({ ...prev, ...details }));
          })
          .catch((error) => {
            console.error(`Error fetching details for sender ${message.sender_id}:`, error);
          });
      }
    });
  };

  return (
    <div className="message">
      <div className="message-container">
        <div id="message-header">
          <h1 id="message-title">Messages</h1>
          <img id="arrow-more" src={Arrow} alt="Go to Messages" />
          <p id="message-count">
            {unreadCount > 0 ? `${unreadCount} unread message${unreadCount > 1 ? "s" : ""}` : "Here are your latest messages"}
          </p>
        </div>
        <div className="message-list">
          {messages.length === 0 ? (
            <p className="no-messages">You have no messages at the moment.</p>
          ) : (
            messages.map((message, index) => (
              <div className="message-entry" key={index}>
                <img
                  id="message-pfp"
                  src={senderDetails[message.sender_id]?.userImage || DefaultAvatar}
                  alt="Message Sender Profile Picture"
                />
                <div className="message-content">
                  <div className="message-header-row">
                    <p className="message-name">{senderDetails[message.sender_id]?.name || "Loading..."}</p>
                    <p className="message-time">{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <p className="message-text">{message.content}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageWidget;
