import React, { useState, useEffect } from "react";
import "../styles/Modal.css";

const Modal = ({ isOpen, title, message, onConfirm, onCancel, confirmText = "OK", cancelText = "Cancel", type = "info", showInput = false, inputPlaceholder = "" }) => {
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    if (isOpen) setInputValue("");
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className={`modal-icon modal-icon-${type}`}>
          {type === "danger" ? "!" : type === "success" ? "\u2713" : "i"}
        </div>
        {title && <h2 className="modal-title">{title}</h2>}
        <p className="modal-message">{message}</p>
        {showInput && (
          <input
            className="modal-input"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={inputPlaceholder}
            autoFocus
          />
        )}
        <div className="modal-actions">
          {onCancel && (
            <button className="modal-btn modal-btn-cancel" onClick={onCancel}>
              {cancelText}
            </button>
          )}
          <button
            className={`modal-btn modal-btn-${type}`}
            onClick={() => showInput ? onConfirm(inputValue) : onConfirm()}
            disabled={showInput && !inputValue.trim()}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Modal;
