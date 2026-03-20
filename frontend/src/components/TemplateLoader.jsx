import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import "../styles/TemplateLoader.css";
import EditTemplateModal from "./EditTemplateModal";

const TemplateLoader = ({ templates, loading, onSelect, onTemplatesChanged }) => {
  const [open, setOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);   // template to confirm delete
  const [deleteSuccess, setDeleteSuccess] = useState("");   // success message
  const [deleting, setDeleting] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (t) => {
    if (onSelect) onSelect(t);
    setOpen(false);
  };

  const handleEdit = (e, t) => {
    e.stopPropagation();
    setEditingTemplate(t);
    setOpen(false);
  };

  const handleDeleteClick = (e, t) => {
    e.stopPropagation();
    setDeleteTarget(t);
    setOpen(false);
  };

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    try {
      await axios.delete(`/api/templates/${deleteTarget.template_id}`, { withCredentials: true });
      setDeleteTarget(null);
      setDeleteSuccess(`Template "${deleteTarget.template_name}" deleted successfully.`);
      if (onTemplatesChanged) onTemplatesChanged();
      setTimeout(() => setDeleteSuccess(""), 3000);
    } catch (err) {
      setDeleteTarget(null);
      setDeleteSuccess(err.response?.data?.message || "Failed to delete template.");
      setTimeout(() => setDeleteSuccess(""), 3000);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => setDeleteTarget(null);

  return (
    <>
      <div className="tl-wrapper" ref={ref}>
        <button
          type="button"
          className="template-btn tl-trigger"
          disabled={loading}
          onClick={() => setOpen((v) => !v)}
        >
          {loading ? "Loading..." : "Load Template"}
          <span className={`tl-chevron ${open ? "tl-chevron--up" : ""}`}>▾</span>
        </button>

        {open && (
          <div className="tl-dropdown">
            {templates.length === 0 ? (
              <div className="tl-empty">No templates saved yet.</div>
            ) : (
              templates.map((t) => (
                <div key={t.template_id} className="tl-row">
                  <span className="tl-name" onClick={() => handleSelect(t)}>
                    {t.template_name}
                  </span>
                  <button
                    type="button"
                    className="tl-icon-btn tl-edit-btn"
                    title="Edit template"
                    onClick={(e) => handleEdit(e, t)}
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    className="tl-icon-btn tl-delete-btn"
                    title="Delete template"
                    onClick={(e) => handleDeleteClick(e, t)}
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ── Delete confirmation modal ── */}
      {deleteTarget && (
        <div className="template-modal-overlay" onClick={handleDeleteCancel}>
          <div className="template-modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ color: "#C2554E" }}>Delete Template</h3>
            <p>Are you sure you want to delete <strong>"{deleteTarget.template_name}"</strong>? This cannot be undone.</p>
            <div className="template-modal-buttons" style={{ flexWrap: "nowrap" }}>
              <button className="template-modal-cancel" onClick={handleDeleteCancel} disabled={deleting}>
                Cancel
              </button>
              <button
                className="template-modal-save"
                style={{ backgroundColor: "#C2554E" }}
                onClick={handleDeleteConfirm}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete success/error message modal ── */}
      {deleteSuccess && (
        <div className="template-modal-overlay" onClick={() => setDeleteSuccess("")}>
          <div className="template-modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ color: "#15803d" }}>Done</h3>
            <p>{deleteSuccess}</p>
            <div className="template-modal-buttons">
              <button className="template-modal-save" onClick={() => setDeleteSuccess("")}>OK</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit modal ── */}
      {editingTemplate && (
        <EditTemplateModal
          template={editingTemplate}
          onClose={() => setEditingTemplate(null)}
          onSaved={() => {
            setEditingTemplate(null);
            if (onTemplatesChanged) onTemplatesChanged();
          }}
        />
      )}
    </>
  );
};

export default TemplateLoader;