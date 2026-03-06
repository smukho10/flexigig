import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ApplyModal from './ApplyModal';
import '../styles/RecommendedGigs.css';

const RecommendedGigsWidget = () => {
    const [recommendedJobs, setRecommendedJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [applyJobId, setApplyJobId] = useState(null);

    const fetchRecommendations = async () => {
        try {
            setLoading(true);
            const response = await axios.get('/api/recommended-jobs', { withCredentials: true });
            setRecommendedJobs(response.data.jobs || []);
            setError(null);
        } catch (err) {
            console.error('Error fetching recommended gigs:', err);
            setError('Failed to load recommended gigs.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchRecommendations(); }, []);

    // When application succeeds, remove the applied job from the list
    const handleApplySuccess = (jobId) => {
        setRecommendedJobs((prev) => prev.filter((j) => j.job_id.toString() !== jobId.toString()));
    };

    const formatDateForDisplay = (dateTime) => {
        if (!dateTime) return "";
        return new Date(dateTime).toLocaleString("en-US", {
            month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
        });
    };

    if (loading) return <div className="recommended-loading">Finding the best gigs for you...</div>;
    if (error) return <div className="recommended-error" style={{ color: 'red', padding: '20px' }}>{error}</div>;
    if (recommendedJobs.length === 0) return null;

    return (
        <>
            <div className="recommended-gigs-section">
                <h2 className="section-heading">Recommended Gigs</h2>
                <div className="recommended-grid">
                    {recommendedJobs.map((job) => (
                        <div key={job.job_id} className="recommended-card">
                            <div className="profile-badge">
                                Recommended for: <span>{job.recommended_for_profiles}</span>
                            </div>
                            <div className="card-content">
                                <div className="job-primary-info">
                                    <h3>{job.jobtitle}</h3>
                                    <p className="business-name">{job.business_name}</p>
                                </div>
                                <div className="job-meta">
                                    <span className="rate">${job.hourlyrate}/hr</span>
                                    <span className="type">{job.jobtype}</span>
                                </div>
                                <div className="job-time">
                                    <p>Starts: {formatDateForDisplay(job.jobstart)}</p>
                                </div>
                                <div className="job-action">
                                    <button
                                        className="apply-btn-premium"
                                        onClick={() => setApplyJobId(job.job_id)}
                                    >
                                        Quick Apply
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Profile-selection modal */}
            {applyJobId && (
                <ApplyModal
                    jobId={applyJobId}
                    onClose={() => setApplyJobId(null)}
                    onSuccess={handleApplySuccess}
                />
            )}
        </>
    );
};

export default RecommendedGigsWidget;
