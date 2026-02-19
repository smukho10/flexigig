import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import FlexygigLogo from "../assets/images/FlexygigLogo.png";
import chevronLeft from "../assets/images/ChevronLeft.png";
import "../styles/AccountSelection.css";
import { useUser } from "./UserContext";

const AccountSelection = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [isOAuth, setIsOAuth] = useState(false);
    const [oauthData, setOauthData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const { setUser } = useUser();

    useEffect(() => {
        const oauth = searchParams.get('oauth');
        const preSelectedAccountType = searchParams.get('accountType');
        if (oauth === 'google') {
            setIsOAuth(true);
            axios.get(`/api/auth/google/pending`, { withCredentials: true })
                .then(res => {
                    if (res.data.pending) {
                        const data = { ...res.data, preSelectedAccountType };
                        setOauthData(data);
                        // If account type was pre-selected (from Register), auto-proceed - no second selection
                        if (preSelectedAccountType === 'Worker' || preSelectedAccountType === 'Employer') {
                            handleOAuthAccountSelection(preSelectedAccountType, res.data);
                        }
                    } else {
                        navigate('/signin');
                    }
                })
                .catch(err => {
                    console.error('Error fetching OAuth data:', err);
                    navigate('/signin');
                });
        }
    }, [searchParams, navigate]);

    const handleOAuthAccountSelection = async (accountType, dataOverride) => {
        const data = dataOverride || oauthData;
        if (!data) return;

        setLoading(true);
        setError("");

        try {
            const response = await axios.post(
                `/api/auth/google/complete`,
                {
                    accountType,
                    firstName: data.firstName,
                    lastName: data.lastName,
                    businessName: accountType === 'Employer' ? `${(data.firstName || 'User')}'s Business` : undefined
                },
                { withCredentials: true }
            );

            if (response.data.success) {
                const userData = { ...response.data.user };
                if (response.data.workerId) userData.workerId = response.data.workerId;
                localStorage.setItem("user", JSON.stringify(userData));
                setUser(userData);
                // Workers go to complete-profile to add skills/experience; Employers go to dashboard
                if (accountType === 'Worker') {
                    navigate('/complete-profile', { state: { workerId: response.data.workerId } });
                } else {
                    navigate('/dashboard');
                }
            } else {
                setError(response.data.message || 'Registration failed');
            }
        } catch (err) {
            console.error('OAuth completion error:', err);
            setError(err.response?.data?.message || 'Registration failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // If OAuth flow, show simplified account selection
    if (isOAuth) {
        return (
            <div className="account-selection-container">
                <button id="back-button" onClick={() => navigate("/signin")}>
                    <img src={chevronLeft} alt="Back to sign in" />
                </button>
                <img id="account-selection-logo" src={FlexygigLogo} alt="logo" />
                <h1>Complete Your Registration</h1>
                {oauthData && (
                    <p className="oauth-email">Signing up as: {oauthData.email}</p>
                )}
                <p className="account-selection-subtitle">Select your account type to continue</p>
                {error && <p className="error-message">{error}</p>}
                <div className="account-selection-buttons">
                    <button
                        className="account-button"
                        onClick={() => handleOAuthAccountSelection('Worker')}
                        disabled={loading}
                    >
                        {loading ? 'Creating...' : 'Continue as Worker'}
                    </button>
                    <button
                        className="account-button"
                        onClick={() => handleOAuthAccountSelection('Employer')}
                        disabled={loading}
                    >
                        {loading ? 'Creating...' : 'Continue as Employer'}
                    </button>
                </div>
            </div>
        );
    }

    // Regular account selection (non-OAuth)
    return (
        <div className="account-selection-container">
            <button id="back-button" onClick={() => navigate("/signin")}>
                <img src={chevronLeft} alt="Back to sign in" /></button>
            <img id="account-selection-logo" src={FlexygigLogo} alt="logo" />
            <h1>Select Account Type</h1>
            <div className="account-selection-buttons">
                <button className="account-button" onClick={() => navigate("/register?accountType=Worker", {state: { fromAccountSelection: true}})}>
                    Create Worker Account
                </button>
                <button className="account-button" onClick={() => navigate("/register?accountType=Employer", {state: { fromAccountSelection: true}})}>
                    Create Employer Account
                </button>
            </div>
        </div>
    );
};

export default AccountSelection;
