import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { useUser } from "./UserContext";

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setUser } = useUser();

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      navigate("/signin?error=oauth_failed");
      return;
    }

    axios
      .get(`/api/auth/google/exchange?token=${token}`, { withCredentials: true })
      .then((res) => {
        const data = res.data;

        if (data.type === "login") {
          // Existing user — session is established, update context and go to dashboard
          setUser(data.user);
          localStorage.setItem("user", JSON.stringify(data.user));
          navigate("/dashboard");
        } else if (data.type === "pending") {
          // New user — session has pendingOAuth set, go to account selection
          const accountTypeParam = data.preSelectedAccountType
            ? `&accountType=${data.preSelectedAccountType}`
            : "";
          navigate(`/account-selection?oauth=google${accountTypeParam}`);
        } else {
          navigate("/signin?error=oauth_failed");
        }
      })
      .catch((err) => {
        console.error("OAuth exchange error:", err);
        navigate("/signin?error=oauth_failed");
      });
  }, []);

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
      <p>Signing you in...</p>
    </div>
  );
};

export default AuthCallback;
