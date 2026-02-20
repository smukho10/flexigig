import "../styles/NewGigWidget.css";
import Arrow from "../assets/images/arrow-more.svg";
import Money from "../assets/images/gigwidget-money.svg";
import Calendar from "../assets/images/gigwidget-calendar.svg";
import Star from "../assets/images/gigwidget-star.svg";
import Grid from "../assets/images/gigwidget-grid.svg";

function NewGigWidget({ jobs = [] }) {
  const formatDate = (dateStr) => {
    if (!dateStr) return "TBD";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
      ", " +
      date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  };

  if (!jobs || jobs.length === 0) {
    return (
      <div className="newgig">
        <h1>New Gigs</h1>
        <div className="newgig-details">
          <p>No new gigs available at the moment.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="newgig">
      <h1>New Gigs</h1>
      {jobs.map((job) => (
        <div className="newgig-details" key={job.job_id}>
          <div id="newgig-jobtitle">
            {job.jobtitle}
            <img id="newgig-arrow" src={Arrow} alt="More details" />
          </div>
          <p id="newgig-hourlyrate">
            <img id="newgig-icons" src={Money} alt="Hourly rate" /> ${job.hourlyrate}/hr
          </p>
          <p id="newgig-businessrating">
            <img id="newgig-icons" src={Star} alt="Business rating" /> 5/5
          </p>
          <p id="newgig-date">
            <img id="newgig-icons" src={Calendar} alt="Date and time" /> {formatDate(job.jobstart)}
          </p>
          <p id="newgig-businessname">
            <img id="newgig-icons" src={Grid} alt="Business name" /> {job.business_name}
          </p>
          <div className="newgig-morebtn">
            <button>More</button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default NewGigWidget;
