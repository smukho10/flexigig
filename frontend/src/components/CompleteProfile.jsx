import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { useUser } from "./UserContext";
import SkillsForm from "./SkillsForm";
import ExperienceForm from "./ExperienceForm";
import FlexygigLogo from "../assets/images/FlexygigLogo.png";
import chevronLeft from "../assets/images/ChevronLeft.png";
import "../styles/SkillsForm.css";
import "../styles/ExperienceForm.css";
import "../styles/CompleteProfile.css";

const CompleteProfile = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [workerId, setWorkerId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);
  const [profileData, setProfileData] = useState({
    skills: [],
    experiences: [],
    experience: []
  });

  useEffect(() => {
    if (!user) return;

    // Employers should not be here - redirect to dashboard
    if (user.isbusiness) {
      navigate("/dashboard", { replace: true });
      return;
    }

    const resolveWorkerId = async () => {
      // Get workerId from OAuth flow state, user object, or fetch from API
      const stateWorkerId = location.state?.workerId;
      const userWorkerId = user.workerId;

      if (stateWorkerId || userWorkerId) {
        setWorkerId(stateWorkerId || userWorkerId);
        setLoading(false);
        return;
      }

      try {
        const res = await axios.get(
          `/api/profile/worker-profiles/${user.id}`,
          { withCredentials: true }
        );
        if (res.data?.length > 0) {
          setWorkerId(res.data[0].id);
        } else {
          navigate("/dashboard", { replace: true });
        }
      } catch (err) {
        console.error("Error fetching worker profile:", err);
        navigate("/dashboard", { replace: true });
      }
      setLoading(false);
    };

    resolveWorkerId();
  }, [user, navigate, location.state]);

  const handlePrev = () => setStep(Math.max(0, step - 1));

  const handleNext = () => setStep(1);

  const handleSkip = () => {
    navigate("/dashboard", { replace: true });
  };

  const handleContinue = async () => {
    if (!workerId) return;

    setSaving(true);
    try {
      const skills = profileData.skills || [];
      const experiences = profileData.experiences || profileData.experience || [];

      const skillPromises = skills.map((skill) =>
        axios.post(
          `/api/add-worker-skill-ids/${workerId}/${skill.skill_id}`,
          {},
          { withCredentials: true }
        )
      );
      const experiencePromises = experiences.map((exp) =>
        axios.post(
          `/api/add-worker-experience-ids/${workerId}/${exp.experience_id}`,
          {},
          { withCredentials: true }
        )
      );

      await Promise.all([...skillPromises, ...experiencePromises]);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      console.error("Error saving profile:", err);
      alert("Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDataChange = (updates) => {
    setProfileData((prev) => {
      const next = { ...prev, ...updates };
      if (updates.experiences !== undefined) {
        next.experience = updates.experiences;
      }
      return next;
    });
  };

  if (loading || !user) {
    return (
      <div className="complete-profile-loading">
        <p>Loading...</p>
      </div>
    );
  }

  if (!workerId) return null;

  const steps = [
    <SkillsForm
      key="skills"
      data={profileData}
      setData={handleDataChange}
    />,
    <ExperienceForm
      key="experience"
      data={{ ...profileData, experience: profileData.experiences || profileData.experience || [] }}
      setData={handleDataChange}
    />
  ];

  return (
    <div className="complete-profile-container">
      <button
        type="button"
        className="complete-profile-back"
        onClick={() => (step === 0 ? navigate("/dashboard") : handlePrev())}
      >
        <img src={chevronLeft} alt="Back" />
      </button>
      <img className="complete-profile-logo" src={FlexygigLogo} alt="Flexygig" />
      <h1 className="complete-profile-title">Complete Your Profile</h1>
      <p className="complete-profile-subtitle">
        Add your skills and experience to help employers find you
      </p>
      <div className="complete-profile-steps">{steps[step]}</div>
      <div className="complete-profile-actions">
        <button
          type="button"
          className="complete-profile-skip"
          onClick={handleSkip}
          disabled={saving}
        >
          Skip for now
        </button>
        {step < steps.length - 1 ? (
          <button
            type="button"
            className="complete-profile-next"
            onClick={handleNext}
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            className="complete-profile-continue"
            onClick={handleContinue}
            disabled={saving}
          >
            {saving ? "Saving..." : "Continue to Dashboard"}
          </button>
        )}
      </div>
      <progress
        className="complete-profile-progress"
        value={(step + 1) / steps.length}
        max="1"
      />
    </div>
  );
};

export default CompleteProfile;
