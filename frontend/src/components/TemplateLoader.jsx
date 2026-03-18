import React, { useEffect, useRef, useState } from "react";
import "../styles/TemplateLoader.css";

const TemplateLoader = ({ templates, loading, onSelect = null }) => {
    const [open, setOpen] = useState(false);
    const containerRef = useRef(null);

    // Close dropdown when user clicks outside
    useEffect(() => {
        if (!open) return;
        const handleOutsideClick = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handleOutsideClick);
        return () => document.removeEventListener("mousedown", handleOutsideClick);
    }, [open]);

    return (
        <div className="template-loader" ref={containerRef}>
            <button
                type="button"
                className="template-load-btn"
                onClick={() => setOpen(prev => !prev)}
                disabled={loading}
            >
                {loading ? "Loading..." : `Templates ${open ? "▴" : "▾"}`}
            </button>

            {open && (
                <ul className="template-dropdown">
                    {templates.length === 0 ? (
                        <li className="template-dropdown-empty">No templates saved yet</li>
                    ) : (
                        templates.map(t => (
                            <li
                                key={t.template_id}
                                className={`template-dropdown-item${onSelect ? " template-dropdown-item--selectable" : ""}`}
                                onClick={() => onSelect && (onSelect(t), setOpen(false))}
                            >
                                {t.template_name}
                            </li>
                        ))
                    )}
                </ul>
            )}
        </div>
    );
};

export default TemplateLoader;
