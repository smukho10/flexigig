import React, { useState } from "react";
import "../styles/TemplateLoader.css";

const TemplateLoader = ({ templates, loading, onSelect = null }) => {
    const [value, setValue] = useState("");

    const handleChange = (e) => {
        const id = e.target.value;
        setValue("");   // reset to placeholder after selection
        if (!id || !onSelect) return;
        const template = templates.find(t => String(t.template_id) === id);
        if (template) onSelect(template);
    };

    return (
        <select
            className="template-load-select"
            value={value}
            onChange={handleChange}
            disabled={loading}
        >
            <option value="" disabled>
                {loading ? "Loading..." : "Load Template"}
            </option>
            {templates.map(t => (
                <option key={t.template_id} value={String(t.template_id)}>
                    {t.template_name}
                </option>
            ))}
        </select>
    );
};

export default TemplateLoader;
