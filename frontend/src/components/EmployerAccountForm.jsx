import { useState } from "react";
import "../styles/EmployerAccountForm.css";
import FlexygigLogo from "../assets/images/FlexygigLogo.png";

const EmployerAccountForm = ({ data, setData }) => {
  const [errorMessage, setErrorMessage] = useState({});

  const validateField = (value) => {
    let error = "";
    if (!value.trim()) {
      error = "This field is required";
    }
    return error;
  };

  // auto-formats any input into ###-###-#### (max 10 digits)
  const formatPhone = (value) => {
    const digits = (value || "").replace(/\D/g, "").slice(0, 10);
    const a = digits.slice(0, 3);
    const b = digits.slice(3, 6);
    const c = digits.slice(6, 10);

    if (digits.length <= 3) return a;
    if (digits.length <= 6) return `${a}-${b}`;
    return `${a}-${b}-${c}`;
  };

  // checks if phone is complete and valid (10 digits)
  const validatePhone = (value) => {
    const digits = (value || "").replace(/\D/g, "");
    return digits.length === 10;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Special handling for phone number: format as user types
    if (name === "phone_number") {
      const formatted = formatPhone(value);
      setData({ ...data, [name]: formatted });

      const digits = formatted.replace(/\D/g, "");
      if (digits.length > 0 && digits.length < 10) {
        setErrorMessage({
          ...errorMessage,
          [name]: "Enter a 10-digit phone number",
        });
        return;
      }

      // Clear error if valid or empty
      setErrorMessage({
        ...errorMessage,
        [name]:
          digits.length === 10 || digits.length === 0
            ? ""
            : "Enter a 10-digit phone number",
      });
      return;
    }

    // Default handling for other fields
    setData({ ...data, [name]: value });
    setErrorMessage({ ...errorMessage, [name]: validateField(value) });
  };

  return (
    <div className="employer-account-form-container">
      <img className="image" src={FlexygigLogo} alt="flexygig-icon" />
      <h1 id="heading">Create My Flexygig Business Account</h1>
      <form>
        <label htmlFor="businessName">Business Name</label>
        <input
          type="text"
          id="businessName"
          name="businessName"
          value={data.businessName}
          onChange={handleChange}
          placeholder="Enter your business name"
          required
        />
        {errorMessage.businessName && (
          <p className="error-msg">{errorMessage.businessName}</p>
        )}

        <label htmlFor="businessDescription">Business Description</label>
        <textarea
          id="businessDescription"
          name="businessDescription"
          value={data.businessDescription}
          onChange={handleChange}
          placeholder="Enter your business description"
          required
        />
        {errorMessage.businessDescription && (
          <p className="error-msg">{errorMessage.businessDescription}</p>
        )}

        <label htmlFor="phone_number">Business Phone Number</label>
        <input
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          id="phone_number"
          name="phone_number"
          value={data.phone_number || ""}
          onChange={handleChange}
          placeholder="123-456-7890"
          maxLength={12}
          required
        />
        {errorMessage.phone_number && (
          <p className="error-msg">{errorMessage.phone_number}</p>
        )}
      </form>
    </div>
  );
};

export default EmployerAccountForm;
