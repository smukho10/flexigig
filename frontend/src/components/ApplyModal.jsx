import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useUser } from './UserContext';
import '../styles/ApplyModal.css';

/**
 * ApplyModal — shows a profile picker when a worker clicks Apply on any gig.
 * Props:
 *   jobId     - the ID of the job to apply for
 *   onClose   - called when the modal should close without applying
 *   onSuccess - called after a successful application (pass jobId back)
 */
const ApplyModal = ({ jobId, onClose, onSuccess }) => {
    const { user } = useUser();

    const [profiles, setProfiles] = useState([]);
    const [selectedProfileId, setSelectedProfileId] = useState(null);
    const [loadingProfiles, setLoadingProfiles] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState(null);

    // Fetch the worker's profiles when the modal mounts
    useEffect(() => {
        if (!user?.id) return;
        const fetchProfiles = async () => {
            try {
                const res = await axios.get(`/api/profile/worker-profiles/${user.id}`, {
                    withCredentials: true,
                });
                const data = Array.isArray(res.data) ? res.data : [];
                setProfiles(data);
                if (data.length > 0) setSelectedProfileId(data[0].id);
            } catch (err) {
                setError('Could not load your profiles. Please try again.');
            } finally {
                setLoadingProfiles(false);
            }
        };
        fetchProfiles();
    }, [user]);

    // Close on overlay click
    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) onClose();
    };

    const handleConfirm = async () => {
        if (!selectedProfileId) return;
        setSubmitting(true);
        setError(null);
        try {
            await axios.post(
                `/api/apply-job/${jobId}`,
                { worker_profile_id: selectedProfileId },
                { withCredentials: true }
            );
            setSuccess(true);
            setTimeout(() => {
                onSuccess(jobId);
                onClose();
            }, 1200);
        } catch (err) {
            const msg = err.response?.data?.message || 'Failed to submit application. Please try again.';
            setError(msg);
            setSubmitting(false);
        }
    };

    return (
        <div className="apply-modal-overlay" onClick={handleOverlayClick}>
            <div className="apply-modal-card" role="dialog" aria-modal="true" aria-labelledby="apply-modal-title">

                {/* Header */}
                <div className="apply-modal-header">
                    <h2 id="apply-modal-title">Choose a Profile to Apply With</h2>
                    <button className="apply-modal-close" onClick={onClose} aria-label="Close">×</button>
                </div>
                <p className="apply-modal-subtitle">Select the profile that best fits this gig.</p>

                {/* Body */}
                {success ? (
                    <div className="apply-modal-success">
                        <span className="check-icon">✅</span>
                        <p>Application submitted successfully!</p>
                    </div>
                ) : loadingProfiles ? (
                    <p className="apply-modal-loading">Loading your profiles...</p>
                ) : profiles.length === 0 ? (
                    <p className="apply-modal-empty">You don't have any worker profiles yet. Create one in your Profile page.</p>
                ) : (
                    <>
                        <div className="apply-profile-list">
                            {profiles.map((profile) => (
                                <div
                                    key={profile.id}
                                    className={`apply-profile-option${selectedProfileId === profile.id ? ' selected' : ''}`}
                                    onClick={() => setSelectedProfileId(profile.id)}
                                    role="radio"
                                    aria-checked={selectedProfileId === profile.id}
                                    tabIndex={0}
                                    onKeyDown={(e) => e.key === 'Enter' && setSelectedProfileId(profile.id)}
                                >
                                    <div className="apply-profile-radio">
                                        <div className="apply-profile-radio-dot" />
                                    </div>
                                    <div className="apply-profile-info">
                                        <span className="apply-profile-name">{profile.profile_name}</span>
                                        <span className="apply-profile-fullname">
                                            {profile.first_name} {profile.last_name}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {error && <p className="apply-modal-error">{error}</p>}

                        <div className="apply-modal-actions">
                            <button className="apply-modal-btn-secondary" onClick={onClose}>
                                Cancel
                            </button>
                            <button
                                className="apply-modal-btn-primary"
                                onClick={handleConfirm}
                                disabled={submitting || !selectedProfileId}
                            >
                                {submitting ? 'Submitting...' : 'Confirm Application'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ApplyModal;
