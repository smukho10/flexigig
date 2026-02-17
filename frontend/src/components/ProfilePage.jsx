import axios from "axios";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/ProfilePage.css";
import { useUser } from "./UserContext";
import ProfileScheduler from "./ProfileScheduler";
import Modal from "./Modal";

const ProfilePage = () => {
  const { user, setUser, logout } = useUser();
  const [isEditing, setIsEditing] = useState(false);

  // Modal state
  const [modal, setModal] = useState({ isOpen: false, title: "", message: "", type: "info", onConfirm: null, onCancel: null, showInput: false, inputPlaceholder: "" });

  const showAlert = (title, message, type = "info") => {
    setModal({
      isOpen: true, title, message, type,
      onConfirm: () => setModal((m) => ({ ...m, isOpen: false })),
      onCancel: null, showInput: false, inputPlaceholder: "",
    });
  };

  const showConfirm = (title, message, onConfirm, type = "danger") => {
    setModal({
      isOpen: true, title, message, type,
      onConfirm: () => { setModal((m) => ({ ...m, isOpen: false })); onConfirm(); },
      onCancel: () => setModal((m) => ({ ...m, isOpen: false })),
      showInput: false, inputPlaceholder: "",
    });
  };

  const showPrompt = (title, message, onConfirm, placeholder = "") => {
    setModal({
      isOpen: true, title, message, type: "info",
      onConfirm: (value) => { setModal((m) => ({ ...m, isOpen: false })); onConfirm(value); },
      onCancel: () => setModal((m) => ({ ...m, isOpen: false })),
      showInput: true, inputPlaceholder: placeholder,
    });
  };
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
        `${process.env.REACT_APP_BACKEND_URL}/api/profile/${user.id}${selectedWorkerId ? `?workerId=${selectedWorkerId}` : ""}`,
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
        .get(`${process.env.REACT_APP_BACKEND_URL}/api/profile/worker-profiles/${user.id}`, { withCredentials: true })
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
        .get(`${process.env.REACT_APP_BACKEND_URL}/api/get-worker-skills-id/${workerId}`, { withCredentials: true })
        .then((response) => {
          setWorkerSkills(response.data);
        })
        .catch((error) => {
          console.error("Error fetching worker skills by user id", error);
        });

      axios
        .get(`${process.env.REACT_APP_BACKEND_URL}/api/get-worker-experiences-id/${workerId}`, { withCredentials: true })
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
      .get(`${process.env.REACT_APP_BACKEND_URL}/api/profile/${user.id}`, { withCredentials: true })
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
          `${process.env.REACT_APP_BACKEND_URL}/api/get-worker-skills-id/${workerId}`,
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
          `${process.env.REACT_APP_BACKEND_URL}/api/get-worker-experiences-id/${workerId}`,
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
      .get(`${process.env.REACT_APP_BACKEND_URL}/api/get-all-skills`, { withCredentials: true })
      .then((response) => {
        setSkills(response.data);
      })
      .catch((error) => {
        console.error("Error fetching skills:", error);
      });

    axios
      .get(`${process.env.REACT_APP_BACKEND_URL}/api/get-all-experiences`, { withCredentials: true })
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
      fetchSkills();
    }
    setIsEditingSkills(!isEditingSkills);
  };

  const toggleEditExp = () => {
    if (!isEditingExp) {
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
        `${process.env.REACT_APP_BACKEND_URL}/api/profile/upload-photo-url/${user.id}`,
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
        `${process.env.REACT_APP_BACKEND_URL}/api/profile/save-photo-key/${user.id}`,
        { key },
        { withCredentials: true }
      );

      setPhotoError(null);
      setPhotoFile(null);
      showAlert("Success", "Profile photo uploaded successfully!", "success");

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
        `${process.env.REACT_APP_BACKEND_URL}/api/profile/view-photo-url/${user.id}`,
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
        `${process.env.REACT_APP_BACKEND_URL}/api/profile/update-worker-profile/${selectedWorkerId}`,
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
        `${process.env.REACT_APP_BACKEND_URL}/api/profile/${user.id}?workerId=${selectedWorkerId}`,
        { withCredentials: true }
      );

      setUser((prevUser) => ({
        ...prevUser,
        ...profileRes.data.profileData,
      }));

      setIsEditing(false);
      showAlert("Success", "Profile updated successfully!", "success");
    } catch (error) {
      console.error("Update failed:", error.response || error);
      showAlert("Error", "Failed to update profile. Please try again.", "danger");
    }
  };

  const handleSubmitSkills = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/api/clear-worker-skills/${workerId}`,
        {},
        { withCredentials: true }
      );

      const addPromises = selectedSkills.map((skill) =>
        axios.post(
          `${process.env.REACT_APP_BACKEND_URL}/api/add-worker-skill-ids/${workerId}/${skill.skill_id}`,
          {},
          { withCredentials: true }
        )
      );

      await Promise.all(addPromises);
      await fetchSkills();
      showAlert("Success", "Skills updated successfully!", "success");
      setIsEditingSkills(false);
    } catch (error) {
      console.error("Error updating skills:", error);
      showAlert("Error", "Failed to update skills. Please try again.", "danger");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitExp = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/api/clear-worker-experiences/${workerId}`,
        {},
        { withCredentials: true }
      );

      const addPromises = selectedExp.map((exp) =>
        axios.post(
          `${process.env.REACT_APP_BACKEND_URL}/api/add-worker-experience-ids/${workerId}/${exp.experience_id}`,
          {},
          { withCredentials: true }
        )
      );

      await Promise.all(addPromises);
      await fetchExperiences();
      showAlert("Success", "Experience updated successfully!", "success");
      setIsEditingExp(false);
    } catch (error) {
      console.error("Error updating experiences:", error);
      showAlert("Error", "Failed to update experience. Please try again.", "danger");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProfile = () => {
    if (workerProfiles.length <= 1) {
      showAlert("Cannot Delete", "You must have at least one profile.", "danger");
      return;
    }

    const currentProfile = workerProfiles.find((p) => p.id === selectedWorkerId);
    const profileName = currentProfile ? currentProfile.profile_name : "this profile";

    showConfirm(
      "Delete Profile",
      `Are you sure you want to delete "${profileName}"?\n\nThis will also delete all skills and experiences associated with this profile.\n\nThis action cannot be undone.`,
      async () => {
        try {
          await axios.delete(
            `${process.env.REACT_APP_BACKEND_URL}/api/profile/delete-worker-profile/${selectedWorkerId}`,
            { withCredentials: true }
          );

          const res = await axios.get(
            `${process.env.REACT_APP_BACKEND_URL}/api/profile/worker-profiles/${user.id}`,
            { withCredentials: true }
          );

          setWorkerProfiles(res.data);

          if (res.data.length > 0) {
            setSelectedWorkerId(res.data[0].id);
            setWorkerId(res.data[0].id);
          }

          showAlert("Success", "Profile deleted successfully!", "success");
        } catch (error) {
          console.error("Error deleting profile:", error);
          showAlert("Error", "Failed to delete profile. Please try again.", "danger");
        }
      },
      "danger"
    );
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

      {user.isbusiness ? (
        /* ============ BUSINESS PROFILE ============ */
        <div className="profile-container">
          <div className="business-profile">
            <div className="profile-section">
              <h2>Business Description</h2>
              <p>{user.business_description || ""}</p>
            </div>
            <div className="profile-section">
              <h2>Business Information</h2>
              <p><strong>Name:</strong> {user.business_name}</p>
              <p><strong>Phone:</strong> {user.phone_number}</p>
              <p><strong>Email:</strong> {user.email}</p>
              <p><strong>Address:</strong> {user.street_address} {user.city} {user.province} {user.postal_code}</p>
              <p><strong>Website:</strong> {user.business_website}</p>
            </div>
          </div>
        </div>
      ) : (
        /* ============ WORKER PROFILE ============ */
        <>
          {/* --- Profile Header Banner --- */}
          <div className="profile-header-banner">
            <div className="profile-header-left">
              <div className="profile-avatar">
                {photoUrl ? (
                  <img src={photoUrl} alt="Profile" />
                ) : (
                  <div className="profile-avatar-placeholder">
                    {user.firstname?.charAt(0)}{user.lastname?.charAt(0)}
                  </div>
                )}
              </div>
              <div className="profile-header-info">
                <h1 className="profile-header-name">
                  {user.firstname} {user.lastname}
                  {user.profile_name && <span className="profile-header-title"> - {user.profile_name}</span>}
                </h1>
                {(user.city || user.province) && (
                  <p className="profile-header-location">
                    {user.city}{user.city && user.province ? ", " : ""}{user.province}
                  </p>
                )}
              </div>
            </div>

            <div className="profile-header-actions">
              {workerProfiles.length > 0 && (
                <select
                  className="profile-select"
                  value={selectedWorkerId || ""}
                  onChange={(e) => {
                    const wid = Number(e.target.value);
                    setSelectedWorkerId(wid);
                    setWorkerId(wid);
                  }}
                >
                  {workerProfiles.map((p) => (
                    <option key={p.id} value={p.id}>{p.profile_name}</option>
                  ))}
                </select>
              )}
              <button className="btn-primary" onClick={() => setIsEditing(true)}>Edit Profile</button>
              <button
                className="btn-danger"
                disabled={workerProfiles.length <= 1}
                onClick={handleDeleteProfile}
              >
                Delete
              </button>
              <button
                className="btn-success"
                disabled={workerProfiles.length >= 3}
                onClick={() => {
                  showPrompt(
                    "Add Profile",
                    "Enter a name for your new profile:",
                    async (name) => {
                      try {
                        await axios.post(
                          `${process.env.REACT_APP_BACKEND_URL}/api/profile/create-worker-profile/${user.id}`,
                          { profileName: name },
                          { withCredentials: true }
                        );
                        const res = await axios.get(
                          `${process.env.REACT_APP_BACKEND_URL}/api/profile/worker-profiles/${user.id}`,
                          { withCredentials: true }
                        );
                        setWorkerProfiles(res.data);
                        if (res.data.length > 0) {
                          const newProfile = res.data[res.data.length - 1];
                          setSelectedWorkerId(newProfile.id);
                          setWorkerId(newProfile.id);
                        }
                        showAlert("Success", "Profile created successfully!", "success");
                      } catch (error) {
                        console.error("Error creating profile:", error);
                        showAlert("Error", "Failed to create profile. Please try again.", "danger");
                      }
                    },
                    "e.g., Construction Profile"
                  );
                }}
              >
                + Add Profile
              </button>
            </div>
          </div>

          {/* --- Cards Grid --- */}
          <div className="profile-cards-grid">

            {/* About Me Card */}
            <div className="profile-card">
              <div className="profile-card-header">
                <h2>About Me</h2>
              </div>
              <div className="profile-card-body">
                <p><strong>First Name:</strong> {user.firstname}</p>
                <p><strong>Last Name:</strong> {user.lastname}</p>
                <p><strong>Email:</strong> {user.email}</p>
                <p><strong>Phone:</strong> {user.phone_number || "Not provided"}</p>
                <div className="profile-card-address">
                  <strong>Address:</strong> {user.street_address} {user.city}, {user.province} {user.postal_code}
                </div>
              </div>
            </div>

            {/* Work Preferences Card */}
            <div className="profile-card">
              <div className="profile-card-header">
                <h2>Work Preferences</h2>
              </div>
              <div className="profile-card-body">
                <p><strong>Work Radius:</strong> {user.desired_work_radius} km</p>
                <p><strong>Desired Pay:</strong> ${user.desired_pay}/hr (CAD)</p>
              </div>
            </div>

            {/* Biography Card */}
            <div className="profile-card profile-card-full">
              <div className="profile-card-header">
                <h2>Biography</h2>
              </div>
              <div className="profile-card-body">
                <p>{user.biography || "No biography added yet."}</p>
              </div>
            </div>

            {/* Skills Card */}
            <div className="profile-card">
              <div className="profile-card-header">
                <h2>Skills</h2>
                <button className="btn-icon" onClick={toggleEditSkills}>&#9998;</button>
              </div>
              <div className="profile-card-body">
                <div className="profile-tags">
                  {workerSkills.length > 0 ? workerSkills.map((skillObj, i) => (
                    <span key={i} className="profile-tag">{skillObj.skill_name}</span>
                  )) : <p className="profile-empty-text">No skills added yet.</p>}
                </div>
              </div>
            </div>

            {/* Experience Card */}
            <div className="profile-card">
              <div className="profile-card-header">
                <h2>Experience</h2>
                <button className="btn-icon" onClick={toggleEditExp}>&#9998;</button>
              </div>
              <div className="profile-card-body">
                <div className="profile-tags">
                  {workerExp.length > 0 ? workerExp.map((expObj, i) => (
                    <span key={i} className="profile-tag">{expObj.experience_name}</span>
                  )) : <p className="profile-empty-text">No experience added yet.</p>}
                </div>
              </div>
            </div>
          </div>

          {/* --- Scheduler --- */}
          <div className="profile-card profile-card-full" style={{ margin: "0 0 20px 0" }}>
            <ProfileScheduler selectedProfileId={selectedWorkerId} profiles={workerProfiles} />
          </div>
        </>
      )}

      <Modal
        isOpen={modal.isOpen}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        onConfirm={modal.onConfirm}
        onCancel={modal.onCancel}
        confirmText={modal.showInput ? "Create" : modal.onCancel ? "Yes, Delete" : "OK"}
        cancelText="Cancel"
        showInput={modal.showInput}
        inputPlaceholder={modal.inputPlaceholder}
      />
    </div>
  );
};

export default ProfilePage;
