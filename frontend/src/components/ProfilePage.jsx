import axios from "axios";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/ProfilePage.css";
import { useUser } from "./UserContext";
import ProfileScheduler from "./ProfileScheduler";

const ProfilePage = () => {
  const { user, setUser, logout } = useUser();
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingSkills, setIsEditingSkills] = useState(false);
  const [isEditingExp, setIsEditingExp] = useState(false);
  const [editedUser, setEditedUser] = useState();
  const [submit, setSubmit] = useState(false);
  const [skills, setSkills] = useState([]);
  const [experiences, setExperiences] = useState([]);

  const [workerId, setWorkerId] = useState();
  const [workerSkills, setWorkerSkills] = useState([]);
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [workerExp, setWorkerExp] = useState([]);
  const [selectedExp, setSelectedExp] = useState([]);
  const [workerProfiles, setWorkerProfiles] = useState([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState(null);

  // R2 Photo Upload States
  const [photoFile, setPhotoFile] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState(null);

  // Loading state for save operations
  const [isSaving, setIsSaving] = useState(false);

  const navigate = useNavigate();

  const handleSignOut = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  useEffect(() => {
    if (user) {
      setEditedUser({
        ...user,
        skills: user.skills ? user.skills : [],
        worker_phone_number: user.phone_number,
        worker_street_address: user.street_address,
        worker_city: user.city,
        worker_province: user.province,
        worker_postal_code: user.postal_code,
      });
    }
  }, [user]);

  useEffect(() => {
    console.log("Profile fetch triggered, user:", user);
    if (user) {
      axios.get(
        `/api/profile/${user.id}${selectedWorkerId ? `?workerId=${selectedWorkerId}` : ""}`,
        { withCredentials: true }
      )
        .then((response) => {
          console.log("Profile data:", response.data);
          setUser((prevUser) => ({
            ...prevUser,
            ...response.data.profileData,
            ...response.data.businessData,
          }));
        })
        .catch((error) => {
          console.error("Error fetching user profile:", error);
        });
    }
  }, [submit, selectedWorkerId, user?.id]);

  useEffect(() => {
    if (!user?.isbusiness && user?.id) {
      axios
        .get(`/api/profile/worker-profiles/${user.id}`, { withCredentials: true })
        .then((res) => {
          setWorkerProfiles(res.data);
          if (res.data.length > 0 && !selectedWorkerId) {
            setSelectedWorkerId(res.data[0].id);
            setWorkerId(res.data[0].id);
          }
        })
        .catch((err) => console.error("Error fetching worker profiles:", err));
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user.isbusiness && workerId != null) {
      axios
        .get(`/api/get-worker-skills-id/${workerId}`, { withCredentials: true })
        .then((response) => {
          setWorkerSkills(response.data);
        })
        .catch((error) => {
          console.error("Error fetching worker skills by user id", error);
        });

      axios
        .get(`/api/get-worker-experiences-id/${workerId}`, { withCredentials: true })
        .then((response) => {
          setWorkerExp(response.data);
        })
        .catch((error) => {
          console.error("Error fetching worker experiences by user id", error);
        });
    }
  }, [workerId]);

  const fetchProfile = () => {
    axios
      .get(`/api/profile/${user.id}`, { withCredentials: true })
      .then((response) => {
        let merge = {
          ...response.data.profileData,
          ...response.data.businessData,
        };
        setEditedUser(merge);
      })
      .catch((error) => {
        console.error("Error fetching user profile:", error);
      });
  };

  const fetchSkills = async () => {
    if (!user.isbusiness && workerId) {
      try {
        const response = await axios.get(
          `/api/get-worker-skills-id/${workerId}`,
          { withCredentials: true }
        );
        setWorkerSkills(response.data);
        setSelectedSkills(response.data);
        return response.data;
      } catch (error) {
        console.error("Error fetching worker skills by user id", error);
        return [];
      }
    }
  };

  const fetchExperiences = async () => {
    if (!user.isbusiness && workerId) {
      try {
        const response = await axios.get(
          `/api/get-worker-experiences-id/${workerId}`,
          { withCredentials: true }
        );
        setWorkerExp(response.data);
        setSelectedExp(response.data);
        return response.data;
      } catch (error) {
        console.error("Error fetching worker experiences by user id", error);
        return [];
      }
    }
  };

  useEffect(() => {
    axios
      .get(`/api/get-all-skills`, { withCredentials: true })
      .then((response) => {
        setSkills(response.data);
      })
      .catch((error) => {
        console.error("Error fetching skills:", error);
      });

    axios
      .get(`/api/get-all-experiences`, { withCredentials: true })
      .then((response) => {
        setExperiences(response.data);
      })
      .catch((error) => {
        console.error("Error fetching experiences:", error);
      });
  }, []);

  const handleChange = (event) => {
    const { name, value, options } = event.target;
    if (event.target.type === "select-multiple") {
      const values = Array.from(options)
        .filter((option) => option.selected)
        .map((option) => option.value);
      setEditedUser((prev) => ({ ...prev, [name]: values }));
    } else {
      if (name === "desired_work_radius") {
        if (!isNaN(parseInt(value))) {
          setEditedUser((prev) => ({ ...prev, [name]: value }));
        }
      } else if (name === "desired_pay") {
        if (!isNaN(parseFloat(value))) {
          var rounded = Math.round(value * 100) / 100;
          setEditedUser((prev) => ({ ...prev, [name]: rounded }));
        }
      } else {
        setEditedUser((prev) => ({ ...prev, [name]: value }));
      }
    }
  };

  const toggleEdit = () => {
    fetchProfile();
    setIsEditing(!isEditing);
  };

  const toggleEditSkills = () => {
    if (!isEditingSkills) {
      // Opening the edit form - fetch current skills
      fetchSkills();
    }
    setIsEditingSkills(!isEditingSkills);
  };

  const toggleEditExp = () => {
    if (!isEditingExp) {
      // Opening the edit form - fetch current experiences
      fetchExperiences();
    }
    setIsEditingExp(!isEditingExp);
  };

  // R2 Photo Upload Handlers
  const handlePhotoSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setPhotoError("Please select a valid image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setPhotoError("File size must be less than 5MB");
      return;
    }

    setPhotoFile(file);
    setPhotoError(null);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handlePhotoUpload = async () => {
    if (!photoFile || !user) return;

    setUploading(true);
    setPhotoError(null);

    try {
      const uploadUrlRes = await axios.post(
        `/api/profile/upload-photo-url/${user.id}`,
        { contentType: photoFile.type },
        { withCredentials: true }
      );

      const { uploadUrl, key } = uploadUrlRes.data;

      await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": photoFile.type },
        body: photoFile,
      });

      await axios.post(
        `/api/profile/save-photo-key/${user.id}`,
        { key },
        { withCredentials: true }
      );

      setPhotoError(null);
      setPhotoFile(null);
      alert("Profile photo uploaded successfully!");

      await fetchProfile();
      window.dispatchEvent(new Event("profilePhotoUpdated"));
    } catch (error) {
      console.error("Photo upload error:", error);
      setPhotoError("Failed to upload photo. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const fetchProfilePhoto = async () => {
    if (!user?.id) return;

    try {
      const res = await axios.get(
        `/api/profile/view-photo-url/${user.id}`,
        { withCredentials: true }
      );
      setPhotoUrl(res.data.viewUrl);
    } catch (error) {
      console.log("No profile photo found");
      setPhotoUrl(null);
    }
  };

  useEffect(() => {
    fetchProfilePhoto();
  }, [user?.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    setSubmit(true);

    try {
      await axios.put(
        `/api/profile/update-worker-profile/${selectedWorkerId}`,
        {
          biography: editedUser.biography,
          firstname: editedUser.firstname,
          lastname: editedUser.lastname,
          profile_name: editedUser.profile_name || "Profile 1",
          desired_work_radius: editedUser.desired_work_radius,
          desired_pay: editedUser.desired_pay,
          worker_phone_number: editedUser.worker_phone_number,
          worker_street_address: editedUser.worker_street_address,
          worker_city: editedUser.worker_city,
          worker_province: editedUser.worker_province,
          worker_postal_code: editedUser.worker_postal_code,
        },
        { withCredentials: true }
      );

      const profileRes = await axios.get(
        `/api/profile/${user.id}?workerId=${selectedWorkerId}`,
        { withCredentials: true }
      );

      setUser((prevUser) => ({
        ...prevUser,
        ...profileRes.data.profileData,
      }));

      setIsEditing(false);
      alert("Profile updated successfully!");
    } catch (error) {
      console.error("Update failed:", error.response || error);
      alert("Failed to update profile. Please try again.");
    }
  };

  const handleSubmitSkills = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      // Clear existing skills
      await axios.post(
        `/api/clear-worker-skills/${workerId}`,
        {},
        { withCredentials: true }
      );

      // Add all selected skills
      const addPromises = selectedSkills.map((skill) =>
        axios.post(
          `/api/add-worker-skill-ids/${workerId}/${skill.skill_id}`,
          {},
          { withCredentials: true }
        )
      );

      await Promise.all(addPromises);

      // Refresh the skills data
      await fetchSkills();

      // Show success message
      alert("Skills updated successfully!");

      // Close the editing form
      setIsEditingSkills(false);
    } catch (error) {
      console.error("Error updating skills:", error);
      alert("Failed to update skills. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitExp = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      // Clear existing experiences
      await axios.post(
        `/api/clear-worker-experiences/${workerId}`,
        {},
        { withCredentials: true }
      );

      // Add all selected experiences
      const addPromises = selectedExp.map((exp) =>
        axios.post(
          `/api/add-worker-experience-ids/${workerId}/${exp.experience_id}`,
          {},
          { withCredentials: true }
        )
      );

      await Promise.all(addPromises);

      // Refresh the experiences data
      await fetchExperiences();

      // Show success message
      alert("Experience updated successfully!");

      // Close the editing form
      setIsEditingExp(false);
    } catch (error) {
      console.error("Error updating experiences:", error);
      alert("Failed to update experience. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProfile = async () => {
    if (workerProfiles.length <= 1) {
      alert("Cannot delete the last profile. You must have at least one profile.");
      return;
    }

    const currentProfile = workerProfiles.find((p) => p.id === selectedWorkerId);
    const profileName = currentProfile ? currentProfile.profile_name : "this profile";

    const confirmed = window.confirm(
      `Are you sure you want to delete "${profileName}"?\n\nThis will also delete all skills and experiences associated with this profile.\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      await axios.delete(
        `/api/profile/delete-worker-profile/${selectedWorkerId}`,
        { withCredentials: true }
      );

      const res = await axios.get(
        `/api/profile/worker-profiles/${user.id}`,
        { withCredentials: true }
      );

      setWorkerProfiles(res.data);

      if (res.data.length > 0) {
        setSelectedWorkerId(res.data[0].id);
        setWorkerId(res.data[0].id);
      }

      alert("Profile deleted successfully!");
    } catch (error) {
      console.error("Error deleting profile:", error);
      alert("Failed to delete profile. Please try again.");
    }
  };

  const handleSkillSelect = (skillObj) => {
    if (!selectedSkills.some((o) => o.skill_name === skillObj.skill_name)) {
      setSelectedSkills([...selectedSkills, skillObj]);
    } else {
      setSelectedSkills(selectedSkills.filter((item) => item.skill_name !== skillObj.skill_name));
    }
  };

  const handleExpSelect = (expObj) => {
    if (!selectedExp.some((o) => o.experience_name === expObj.experience_name)) {
      setSelectedExp([...selectedExp, expObj]);
    } else {
      setSelectedExp(selectedExp.filter((item) => item.experience_name !== expObj.experience_name));
    }
  };

  if (isEditingSkills) {
    return (
      <div className="user-profile-form">
        <form onSubmit={handleSubmitSkills} className="form">
          <div className="form-sections-container">
            <div className="form-section worker-section">
              <h1>Please Select Applicable Skills</h1>
              <ul>
                {skills.map((skillObj) => (
                  <button
                    key={skillObj.skill_id}
                    type="button"
                    className={`form-item-button ${
                      selectedSkills.some((o) => o.skill_name === skillObj.skill_name)
                        ? "form-item-button-selected"
                        : ""
                    }`}
                    onClick={() => handleSkillSelect(skillObj)}
                  >
                    {skillObj.skill_name}
                  </button>
                ))}
              </ul>
            </div>
          </div>
          <button type="submit" className="form-button" disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Skills"}
          </button>
          <button type="button" onClick={toggleEditSkills} className="form-button" disabled={isSaving}>
            Cancel
          </button>
        </form>
      </div>
    );
  }

  if (isEditingExp) {
    return (
      <div className="user-profile-form">
        <form onSubmit={handleSubmitExp} className="form">
          <div className="form-sections-container">
            <div className="form-section">
              <h1>Please Select Applicable Experience</h1>
              <ul>
                {experiences.map((expObj) => (
                  <button
                    key={expObj.experience_id}
                    type="button"
                    className={`form-item-button ${
                      selectedExp.some((o) => o.experience_name === expObj.experience_name)
                        ? "form-item-button-selected"
                        : ""
                    }`}
                    onClick={() => handleExpSelect(expObj)}
                  >
                    {expObj.experience_name}
                  </button>
                ))}
              </ul>
            </div>
          </div>
          <button type="submit" className="form-button" disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Experiences"}
          </button>
          <button type="button" onClick={toggleEditExp} className="form-button" disabled={isSaving}>
            Cancel
          </button>
        </form>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="user-profile-form">
        <form onSubmit={handleSubmit} className="form">
          {/* R2 Photo Upload Section */}
          <div className="form-sections-container">
            <div className="form-section">
              <h2>Profile Photo</h2>
              <div style={{ marginBottom: "20px" }}>
                {photoUrl ? (
                  <div
                    style={{
                      width: "150px",
                      height: "150px",
                      borderRadius: "50%",
                      overflow: "hidden",
                      marginBottom: "15px",
                    }}
                  >
                    <img
                      src={photoUrl}
                      alt="Profile Preview"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                ) : (
                  <div
                    style={{
                      width: "150px",
                      height: "150px",
                      borderRadius: "50%",
                      backgroundColor: "#e0e0e0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: "15px",
                    }}
                  >
                    <p>No photo</p>
                  </div>
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoSelect}
                style={{ marginBottom: "10px" }}
                disabled={uploading}
              />
              {photoError && <p style={{ color: "red", marginBottom: "10px" }}>{photoError}</p>}
              <button
                type="button"
                onClick={handlePhotoUpload}
                disabled={!photoFile || uploading}
                className="form-button"
                style={{
                  backgroundColor: uploading ? "#ccc" : "#4CAF50",
                }}
              >
                {uploading ? "Uploading..." : "Upload Photo"}
              </button>
            </div>
          </div>

          <div className="form-sections-container">
            {user.isbusiness ? (
              // Employer Section
              <div className="form-section employer-section">
                <>
                  <label htmlFor="business_name" className="form-label">
                    Business Name:
                  </label>
                  <input
                    type="text"
                    id="business_name"
                    name="business_name"
                    value={editedUser.business_name || ""}
                    onChange={handleChange}
                    className="input-text"
                  />

                  <label htmlFor="business_phone_number" className="form-label">
                    Business Phone Number:
                  </label>
                  <input
                    type="text"
                    id="business_phone_number"
                    name="business_phone_number"
                    value={editedUser.business_phone_number || ""}
                    onChange={handleChange}
                    className="input-text"
                  />

                  <label htmlFor="business_email" className="form-label">
                    Business Email:
                  </label>
                  <input
                    type="text"
                    id="business_email"
                    name="business_email"
                    value={editedUser.business_email || ""}
                    onChange={handleChange}
                    className="input-text"
                  />

                  <label htmlFor="business_street_address" className="form-label">
                    Business Street Address:
                  </label>
                  <input
                    type="text"
                    id="business_street_address"
                    name="business_street_address"
                    value={editedUser.business_street_address || ""}
                    onChange={handleChange}
                    className="input-text"
                  />

                  <label htmlFor="business_city" className="form-label">
                    Business City:
                  </label>
                  <input
                    type="text"
                    id="business_city"
                    name="business_city"
                    value={editedUser.business_city || ""}
                    onChange={handleChange}
                    className="input-text"
                  />

                  <label htmlFor="business_province" className="form-label">
                    Business Province:
                  </label>
                  <input
                    type="text"
                    id="business_province"
                    name="business_province"
                    value={editedUser.business_province || ""}
                    onChange={handleChange}
                    className="input-text"
                  />

                  <label htmlFor="business_postal_code" className="form-label">
                    Business Postal Code:
                  </label>
                  <input
                    type="text"
                    id="business_postal_code"
                    name="business_postal_code"
                    value={editedUser.business_postal_code || ""}
                    onChange={handleChange}
                    className="input-text"
                  />

                  <label htmlFor="business_description" className="form-label">
                    Company Bio:
                  </label>
                  <textarea
                    id="business_description"
                    name="business_description"
                    value={editedUser.business_description || ""}
                    onChange={handleChange}
                    className="input-text"
                  />

                  <label htmlFor="business_website" className="form-label">
                    Company Website:
                  </label>
                  <input
                    type="url"
                    id="business_website"
                    name="business_website"
                    value={editedUser.business_website || ""}
                    onChange={handleChange}
                    className="input-text"
                  />
                </>
              </div>
            ) : (
              // Worker Section
              <div className="form-section worker-section">
                <>
                  <label htmlFor="biography" className="form-label">
                    Biography:
                  </label>
                  <textarea
                    id="biography"
                    name="biography"
                    value={editedUser.biography || ""}
                    onChange={handleChange}
                    className="input-text"
                    required
                  />

                  <label htmlFor="profile_name" className="form-label">
                    Profile Name:
                  </label>
                  <input
                    type="text"
                    id="profile_name"
                    name="profile_name"
                    value={editedUser.profile_name || ""}
                    onChange={handleChange}
                    className="input-text"
                    placeholder="e.g., Construction Profile, Hospitality Profile"
                    required
                  />

                  <label htmlFor="firstname" className="form-label">
                    First Name:
                  </label>
                  <input
                    type="text"
                    id="firstname"
                    name="firstname"
                    value={editedUser.firstname || ""}
                    onChange={handleChange}
                    className="input-text"
                    required
                  />

                  <label htmlFor="lastName" className="form-label">
                    Last Name:
                  </label>
                  <input
                    type="text"
                    id="lastname"
                    name="lastname"
                    value={editedUser.lastname || ""}
                    onChange={handleChange}
                    className="input-text"
                    required
                  />

                  <label htmlFor="worker_phone_number" className="form-label">
                    Phone Number:
                  </label>
                  <input
                    type="text"
                    id="worker_phone_number"
                    name="worker_phone_number"
                    value={editedUser.worker_phone_number || ""}
                    onChange={handleChange}
                    className="input-text"
                    required
                  />

                  <label htmlFor="worker_street_address" className="form-label">
                    Street Adress:
                  </label>
                  <input
                    type="text"
                    id="worker_street_address"
                    name="worker_street_address"
                    value={editedUser.worker_street_address || ""}
                    onChange={handleChange}
                    className="input-text"
                    required
                  />

                  <label htmlFor="worker_city" className="form-label">
                    City:
                  </label>
                  <input
                    type="text"
                    id="worker_city"
                    name="worker_city"
                    value={editedUser.worker_city || ""}
                    onChange={handleChange}
                    className="input-text"
                    required
                  />

                  <label htmlFor="worker_province" className="form-label">
                    Province:
                  </label>
                  <input
                    type="text"
                    id="worker_province"
                    name="worker_province"
                    value={editedUser.worker_province || ""}
                    onChange={handleChange}
                    className="input-text"
                    required
                  />

                  <label htmlFor="worker_postal_code" className="form-label">
                    Postal Code:
                  </label>
                  <input
                    type="text"
                    id="worker_postal_code"
                    name="worker_postal_code"
                    value={editedUser.worker_postal_code || ""}
                    onChange={handleChange}
                    className="input-text"
                    required
                  />

                  <label htmlFor="desired_work_radius" className="form-label">
                    Work Radius (km):
                  </label>
                  <input
                    type="number"
                    id="desired_work_radius"
                    name="desired_work_radius"
                    value={editedUser.desired_work_radius || ""}
                    onChange={handleChange}
                    className="input-text"
                    required
                  />

                  <label htmlFor="desired_pay" className="form-label">
                    Desired Pay ($/hr):
                  </label>
                  <input
                    type="number"
                    id="desired_pay"
                    name="desired_pay"
                    value={editedUser.desired_pay || ""}
                    onChange={handleChange}
                    className="input-text"
                    required
                  />
                </>
              </div>
            )}
          </div>

          <button type="submit" className="form-button">
            Save Changes
          </button>
          <button type="button" onClick={toggleEdit} className="form-button">
            Cancel
          </button>
        </form>
      </div>
    );
  }

  return !user ? (
    <div>Loading...</div>
  ) : (
    <div className="profile-page">
      <div className="profile-container">
        {/* Profile Photo Display */}
        {photoUrl && (
          <div style={{ textAlign: "center", marginBottom: "20px" }}>
            <div
              style={{
                width: "180px",
                height: "180px",
                borderRadius: "50%",
                overflow: "hidden",
                margin: "0 auto",
                border: "3px solid #4EBBC2",
              }}
            >
              <img src={photoUrl} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          </div>
        )}

        {user.isbusiness ? (
          <div className="business-profile">
            <div className="profile-section">
              <h2>Business Description</h2>
              <p>{user.business_description || ""}</p>
            </div>

            <div className="profile-section">
              <h2>Business Information</h2>
              <p>
                <strong>Name:</strong> {user.business_name}
              </p>
              <p>
                <strong>Phone:</strong> {user.phone_number}
              </p>
              <p>
                <strong>Email:</strong> {user.email}
              </p>
              <p>
                <strong>Address:</strong> {user.street_address} {user.city} {user.province} {user.postal_code}
              </p>
              <p>
                <strong>Website:</strong> {user.business_website}
              </p>
            </div>
          </div>
        ) : (
          <div className="worker-profile">
            {!user.isbusiness && workerProfiles.length > 0 && (
              <div style={{ marginBottom: "20px", padding: "15px", backgroundColor: "#f5f5f5", borderRadius: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                  <label style={{ fontWeight: "bold", fontSize: "16px" }}>Profile:</label>
                  <select
                    value={selectedWorkerId || ""}
                    onChange={(e) => {
                      const wid = Number(e.target.value);
                      setSelectedWorkerId(wid);
                      setWorkerId(wid);
                    }}
                    style={{
                      padding: "8px 12px",
                      fontSize: "16px",
                      borderRadius: "4px",
                      border: "1px solid #ccc",
                      flex: "1",
                      maxWidth: "300px",
                    }}
                  >
                    {workerProfiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.profile_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    style={{
                      backgroundColor: "#4EBBC2",
                      color: "white",
                      padding: "8px 16px",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "14px",
                    }}
                    onClick={() => setIsEditing(true)}
                  >
                    Edit This Profile
                  </button>

                  <button
                    style={{
                      backgroundColor: "#FF6347",
                      color: "white",
                      padding: "8px 16px",
                      border: "none",
                      borderRadius: "4px",
                      cursor: workerProfiles.length <= 1 ? "not-allowed" : "pointer",
                      fontSize: "14px",
                      opacity: workerProfiles.length <= 1 ? 0.5 : 1,
                    }}
                    disabled={workerProfiles.length <= 1}
                    onClick={handleDeleteProfile}
                  >
                    Delete This Profile
                  </button>

                  <button
                    style={{
                      backgroundColor: "#4CAF50",
                      color: "white",
                      padding: "8px 16px",
                      border: "none",
                      borderRadius: "4px",
                      cursor: workerProfiles.length >= 3 ? "not-allowed" : "pointer",
                      fontSize: "14px",
                      opacity: workerProfiles.length >= 3 ? 0.5 : 1,
                    }}
                    disabled={workerProfiles.length >= 3}
                    onClick={async () => {
                      const name = window.prompt("Enter new profile name:");
                      if (!name) return;

                      await axios.post(
                        `/api/profile/create-worker-profile/${user.id}`,
                        { profileName: name },
                        { withCredentials: true }
                      );

                      const res = await axios.get(
                        `/api/profile/worker-profiles/${user.id}`,
                        { withCredentials: true }
                      );

                      setWorkerProfiles(res.data);
                      if (res.data.length > 0) {
                        const newProfile = res.data[res.data.length - 1];
                        setSelectedWorkerId(newProfile.id);
                        setWorkerId(newProfile.id);
                      }
                    }}
                  >
                    + Add Profile
                  </button>
                </div>
              </div>
            )}
            <div className="profile-section">
              <h2>Biography</h2>
              <p>{user.biography || ""}</p>
            </div>

            <div className="profile-section">
              <h2>Contact Information</h2>
              <p>
                <strong>First Name:</strong> {user.firstname}
              </p>
              <p>
                <strong>Last Name:</strong> {user.lastname}
              </p>
              <p>
                <strong>Email:</strong> {user.email}
              </p>
              <p>
                <strong>Phone number:</strong> {user.phone_number}
              </p>
              <p>
                <strong>Location:</strong> {user.street_address} {user.city} {user.province} {user.postal_code}
              </p>
            </div>
            <div className="profile-section">
              <h2>Work Preferences</h2>
              <p>
                <strong>Work Radius:</strong> {user.desired_work_radius} km
              </p>
              <p>
                <strong>Desired Pay (CAD):</strong> ${user.desired_pay}/hr
              </p>
            </div>
          </div>
        )}
      </div>
      {!user.isbusiness && (
        <>
          <div className="profile-container">
            <div className="profile-section">
              <h2>Skills</h2>
              <ul>
                {workerSkills.map((skillObj) => (
                  <div key={skillObj.skill_id} className="displayed-items">
                    {skillObj.skill_name}
                  </div>
                ))}
              </ul>
            </div>
            <button className="edit-button" onClick={toggleEditSkills}>
              Edit Skills
            </button>
          </div>

          <div className="profile-container">
            <div className="profile-section">
              <h2>Experience</h2>
              <ul>
                {workerExp.map((expObj) => (
                  <div key={expObj.experience_id} className="displayed-items">
                    {expObj.experience_name}
                  </div>
                ))}
              </ul>
            </div>
            <button className="edit-button" onClick={toggleEditExp}>
              Edit Experiences
            </button>
          </div>

          <div className="profile-container">
            <ProfileScheduler selectedProfileId={selectedWorkerId} profiles={workerProfiles} />
          </div>
        </>
      )}
    </div>
  );
};

export default ProfilePage;