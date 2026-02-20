import React from "react";
import Messages from "./MessageWidget";
import CalendarWidget from "./CalendarWidget";
import NewGigWidget from "./NewGigWidget";
import ApplicationsWidget from "./ApplicationsWidget";
import { Link } from "react-router-dom";
import { useUser } from "./UserContext";
import "../styles/Dashboard.css";

const Dashboard = () => {
  const { user } = useUser();
  const [jobs, setJobs] = React.useState([]);

  React.useEffect(() => {
    if (user && !user.isbusiness) {
      const fetchJobs = async () => {
        try {
          const res = await fetch("/api/all-jobs");
          const data = await res.json();
          // Sort by newest first (highest job_id)
          const latestJobs = data
            .filter((job) => !job.jobfilled && !['draft', 'filled', 'complete', 'completed'].includes(job.status))
            .sort((a, b) => b.job_id - a.job_id);
          setJobs(latestJobs);
        } catch (error) {
          console.error("Error fetching jobs in dashboard:", error);
        }
      };
      fetchJobs();
    }
  }, [user]);

  return (
    <div className="dashboard">
      <main className="dashboard-content">
        {/* Top Side - Messages, Summary, and Calendar */}
        <section className="dashboard-top">
          {/* Messages */}
          <div className="dashboard-messages">
            <Link
              id="dashboard-messages-link"
              className="custom-link"
              to="/messages">
              <Messages />
            </Link>
          </div>
          {/* Summary */}
          <div className="dashboard-summary">
            <div id="summary-header">
              Monthly Summary
            </div>
            <p id="summary-subheader">October Summary</p>
            <div id="summary-bubble-container">
              <div id="summary-bubble2">
                <p id="summary-bubble2-rating">4/5</p>
                <p id="summary-bubble2-text">Rating</p>
              </div>
              <div id="summary-bubble3">
                <p id="summary-bubble3-gigcount">2 gigs</p>
                <p id="summary-bubble3-text">Gigs Posted</p>
              </div>
              <div id="summary-bubble1">
                <p id="summary-bubble1-text">xyzxyz</p>
              </div>
            </div>
          </div>
          {/* Calendar */}
          <div className="dashboard-calendar">
            <Link to="/my-calendar">
              <CalendarWidget />
            </Link>
          </div>
        </section>

        {/* Bottom Side - New gigs */}
        <aside className="dashboard-bottom">
          {user?.isbusiness ? (
            // Business-specific content
            <div className="dashboard-applications">
              <ApplicationsWidget />
            </div>
          ) : (
            // Worker-specific content
            <div className="dashboard-newgig">
              <Link
                id="dashboard-newgig-link"
                className="custom-link"
                to="/find-gigs">
                <NewGigWidget jobs={jobs} />
              </Link>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
};

export default Dashboard;
