import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import ChevronLeft from "../assets/images/ChevronLeft.png";
import "../styles/ApplicantProfileView.css";

const ApplicantProfileView = () => {
    const { workerId } = useParams();
    const navigate = useNavigate();

    const [profile, setProfile] = useState(null);
    const [skills, setSkills] = useState([]);
    const [experiences, setExperiences] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        axios
            .get(`/api/applicant-profile/${workerId}`, { withCredentials: true })
            .then((res) => {
                setProfile(res.data.profile);
                setSkills(res.data.skills || []);
                setExperiences(res.data.experiences || []);
            })
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    }, [workerId]);

    if (loading) {
        return (
            <div className="apv-container">
                <p className="apv-loading">Loading profile...</p>
            </div>
        );
    }

    if (error || !profile) {
        return (
            <div className="apv-container">
                <p className="apv-error">Could not load applicant profile.</p>
            </div>
        );
    }

    return (
        <div className="apv-container">
            {/* Header */}
            <div className="apv-header">
                <img
                    src={ChevronLeft}
                    alt="back"
                    className="apv-back-btn"
                    onClick={() => navigate(-1)}
                />
                <h1 className="apv-title">Applicant Profile</h1>
            </div>

            {/* Profile card */}
            <div className="apv-card apv-card-main">
                <div className="apv-name-row">
                    <div className="apv-avatar">
                        {profile.firstname?.[0]}{profile.lastname?.[0]}
                    </div>
                    <div>
                        <h2 className="apv-name">{profile.firstname} {profile.lastname}</h2>
                        {profile.profile_name && (
                            <span className="apv-profile-tag">{profile.profile_name}</span>
                        )}
                        <p className="apv-email">{profile.email}</p>
                    </div>
                </div>
            </div>

            {/* About */}
            {profile.biography && (
                <div className="apv-card">
                    <h3 className="apv-section-title">About</h3>
                    <p className="apv-bio">{profile.biography}</p>
                </div>
            )}

            {/* Work Preferences */}
            <div className="apv-card">
                <h3 className="apv-section-title">Work Preferences</h3>
                <div className="apv-pref-grid">
                    {profile.desired_pay && (
                        <div className="apv-pref-item">
                            <span className="apv-pref-label">Desired Pay</span>
                            <span className="apv-pref-value">${profile.desired_pay}/hr</span>
                        </div>
                    )}
                    {profile.desired_work_radius && (
                        <div className="apv-pref-item">
                            <span className="apv-pref-label">Work Radius</span>
                            <span className="apv-pref-value">{profile.desired_work_radius} km</span>
                        </div>
                    )}
                    {profile.city && (
                        <div className="apv-pref-item">
                            <span className="apv-pref-label">Location</span>
                            <span className="apv-pref-value">
                                {[profile.city, profile.province].filter(Boolean).join(", ")}
                            </span>
                        </div>
                    )}
                    {profile.phone_number && (
                        <div className="apv-pref-item">
                            <span className="apv-pref-label">Phone</span>
                            <span className="apv-pref-value">{profile.phone_number}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Skills */}
            {skills.length > 0 && (
                <div className="apv-card">
                    <h3 className="apv-section-title">Skills</h3>
                    <div className="apv-tags">
                        {skills.map((s) => (
                            <span key={s.skill_id} className="apv-tag">{s.skill_name}</span>
                        ))}
                    </div>
                </div>
            )}

            {/* Experience */}
            {experiences.length > 0 && (
                <div className="apv-card">
                    <h3 className="apv-section-title">Experience</h3>
                    <div className="apv-tags">
                        {experiences.map((e) => (
                            <span key={e.experience_id} className="apv-tag apv-tag-exp">{e.experience_name}</span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ApplicantProfileView;
