import "../styles/EmailForm.css";
import { useEffect, useState } from "react";
import FlexygigLogo from "../assets/images/FlexygigLogo.png";

const EmailForm = ({ data, setData, setIsDone }) => {
    const [validEmail, setValidEmail] = useState(false);
    const [validPassword, setValidPassword] = useState(false);
    const [emailError, setEmailError] = useState("");
    const [passwordError, setPasswordError] = useState("");

    useEffect(() => {
        const validateEmail = () => {
            const tester = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            if (!tester.test(data.email)) {
                if (!data.email) setEmailError("");
                else setEmailError("Please enter a valid email");
                setValidEmail(false);
                return;
            }
            setEmailError("");
            setValidEmail(true);
        };
        validateEmail();
    }, [data.email]);

    useEffect(() => {
        const validatePassword = () => {
            // Password validation
            const capitalRegex = /[A-Z]/;
            const numberRegex = /[0-9]/;
            const specialCharRegex = /[!@#$%^&*(),.?":{}|<>]/;
            const minLength = 8;

            if (
                data.password.length < minLength ||
                !capitalRegex.test(data.password) ||
                !numberRegex.test(data.password) ||
                !specialCharRegex.test(data.password)
            ) {
                if (!data.password) setPasswordError("");
                else setPasswordError(
                    "Password must be at least 8 characters long and contain 1 capital letter, 1 number, and 1 special character."
                );
                setValidPassword(false);
                return;
            }
            setPasswordError("");
            setValidPassword(true);
        };
        validatePassword();
    }, [data.password]);

    useEffect(() => { setIsDone(validEmail && validPassword); }, [setIsDone, validEmail, validPassword]);





    const handleChange = (e) => {
        const { name, value } = e.target;
        setData({ ...data, [name]: value });
    };

    const handleGoogleSignUp = () => {
        window.location.href = `${process.env.REACT_APP_BACKEND_URL}/api/auth/google`;
    };

    return (
        <div className="email-form-container">
            <img className="image" src={FlexygigLogo} alt="flexygig-icon" />
            <h1 id="heading">
                {data.accountType === "Worker" ? "Sign Up as a Worker" : "Sign Up as an Employer"}
            </h1>
            <div className="social-login-buttons">
                <button
                    type="button"
                    className="google-signin-btn"
                    onClick={handleGoogleSignUp}
                >
                    <svg viewBox="0 0 24 24" width="20" height="20">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Continue with Google
                </button>
            </div>
            <div className="divider">
                <span>or</span>
            </div>
            <form>
                <label htmlFor="email">Email</label>
                <input
                    type="email"
                    id="email"
                    name="email"
                    value={data.email}
                    onChange={handleChange}
                    placeholder="Enter your email"
                    required
                />
                {!validEmail && <p className="error-msg">{emailError}</p>}
                <label htmlFor="password">Password</label>
                <input
                    type="password"
                    id="password"
                    name="password"
                    value={data.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    required
                />
                {!validPassword && <p className="error-msg">{passwordError}</p>}
            </form>
        </div>
    );
}
 
export default EmailForm;
