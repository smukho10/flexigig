import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { Calendar, dateFnsLocalizer, Views } from "react-big-calendar";
import format from "date-fns/format";
import parse from "date-fns/parse";
import startOfWeek from "date-fns/startOfWeek";
import getDay from "date-fns/getDay";
import "react-big-calendar/lib/css/react-big-calendar.css";
import ChevronLeft from "../assets/images/ChevronLeft.png";
import "../styles/ApplicantProfileView.css";

const locales = { "en-CA": require("date-fns/locale/en-CA") };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

const ApplicantProfileView = () => {
    const { workerId } = useParams();
    const navigate = useNavigate();

    const [profile, setProfile] = useState(null);
    const [skills, setSkills] = useState([]);
    const [experiences, setExperiences] = useState([]);
    const [calendarEvents, setCalendarEvents] = useState([]);
    const [profilePhotoUrl, setProfilePhotoUrl] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [calendarView, setCalendarView] = useState(Views.WEEK);
    const [calendarDate, setCalendarDate] = useState(new Date());

    useEffect(() => {
        axios
            .get(`/api/applicant-profile/${workerId}`, { withCredentials: true })
            .then((res) => {
                const p = res.data.profile;
                setProfile(p);
                setSkills(res.data.skills || []);
                setExperiences(res.data.experiences || []);
                // Fetch the applicant's profile photo using their user ID
                if (p?.id) {
                    axios
                        .get(`/api/profile/view-photo-url/${p.id}`, { withCredentials: true })
                        .then((photoRes) => setProfilePhotoUrl(photoRes.data.viewUrl || null))
                        .catch(() => setProfilePhotoUrl(null));

                    axios
                        .get(`/api/my-calendar/availability/${p.id}`, { withCredentials: true })
                        .then((calRes) => {
                            const formatted = calRes.data.map((event) => ({
                                id: event.id,
                                title: event.title,
                                start: new Date(`${event.startdate} ${event.starttime}`),
                                end: new Date(`${event.enddate} ${event.endtime}`),
                            }));
                            setCalendarEvents(formatted);
                        })
                        .catch(() => {});
                }
            })
            .catch(() => setError(true))
            .finally(() => setLoading(false));


    }, [workerId]);

    if (loading) {
        return (
            <div className="apv-container">
                <p className="apv-loading">Loading profile...</p>
            </div>
        );
    }

    if (error || !profile) {
        return (
            <div className="apv-container">
                <p className="apv-error">Could not load applicant profile.</p>
            </div>
        );
    }

    return (
        <div className="apv-container">
            {/* Header */}
            <div className="apv-header">
                <img
                    src={ChevronLeft}
                    alt="back"
                    className="apv-back-btn"
                    onClick={() => navigate(-1)}
                />
                <h1 className="apv-title">Applicant Profile</h1>
            </div>

            {/* Profile card */}
            <div className="apv-card apv-card-main">
                <div className="apv-name-row">
                    <div className="apv-avatar">
                        {profilePhotoUrl ? (
                            <img
                                src={profilePhotoUrl}
                                alt="profile"
                                style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }}
                            />
                        ) : (
                            <>{profile.firstname?.[0]}{profile.lastname?.[0]}</>
                        )}
                    </div>
                    <div>
                        <h2 className="apv-name">{profile.firstname} {profile.lastname}</h2>
                        {profile.profile_name && (
                            <span className="apv-profile-tag">{profile.profile_name}</span>
                        )}
                        <p className="apv-email">{profile.email}</p>
                    </div>
                </div>
            </div>

            {/* About */}
            {profile.biography && (
                <div className="apv-card">
                    <h3 className="apv-section-title">About</h3>
                    <p className="apv-bio">{profile.biography}</p>
                </div>
            )}

            {/* Work Preferences */}
            <div className="apv-card">
                <h3 className="apv-section-title">Work Preferences</h3>
                <div className="apv-pref-grid">
                    {profile.desired_pay && (
                        <div className="apv-pref-item">
                            <span className="apv-pref-label">Desired Pay</span>
                            <span className="apv-pref-value">${profile.desired_pay}/hr</span>
                        </div>
                    )}
                    {profile.desired_work_radius && (
                        <div className="apv-pref-item">
                            <span className="apv-pref-label">Work Radius</span>
                            <span className="apv-pref-value">{profile.desired_work_radius} km</span>
                        </div>
                    )}
                    {profile.city && (
                        <div className="apv-pref-item">
                            <span className="apv-pref-label">Location</span>
                            <span className="apv-pref-value">
                                {[profile.city, profile.province].filter(Boolean).join(", ")}
                            </span>
                        </div>
                    )}
                    {profile.phone_number && (
                        <div className="apv-pref-item">
                            <span className="apv-pref-label">Phone</span>
                            <span className="apv-pref-value">{profile.phone_number}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Skills */}
            {skills.length > 0 && (
                <div className="apv-card">
                    <h3 className="apv-section-title">Skills</h3>
                    <div className="apv-tags">
                        {skills.map((s) => (
                            <span key={s.skill_id} className="apv-tag">{s.skill_name}</span>
                        ))}
                    </div>
                </div>
            )}

            {/* Experience */}
            {experiences.length > 0 && (
                <div className="apv-card">
                    <h3 className="apv-section-title">Experience</h3>
                    <div className="apv-tags">
                        {experiences.map((e) => (
                            <span key={e.experience_id} className="apv-tag apv-tag-exp">{e.experience_name}</span>
                        ))}
                    </div>
                </div>
            )}

            {/* Availability Calendar */}
            <div className="apv-card">
                <h3 className="apv-section-title">Availability</h3>
                {calendarEvents.length === 0 ? (
                    <p className="apv-no-availability">No availability set by this applicant.</p>
                ) : (
                    <div className="apv-calendar-wrapper">
                        <Calendar
                            key={calendarDate.toString() + calendarView + workerId}
                            localizer={localizer}
                            events={calendarEvents}
                            startAccessor={(e) => new Date(e.start)}
                            endAccessor={(e) => new Date(e.end)}
                            style={{ height: 500 }}
                            views={["month", "week", "day"]}
                            view={calendarView}
                            date={calendarDate}
                            onView={setCalendarView}
                            onNavigate={setCalendarDate}
                            defaultView="week"
                            scrollToTime={new Date(1970, 1, 1, 0, 0, 0)}
                            enableAutoScroll={false}
                            min={new Date(1970, 1, 1, 0, 0, 0)}
                            max={new Date(1970, 1, 1, 23, 59, 59)}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default ApplicantProfileView;