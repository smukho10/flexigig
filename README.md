# FlexiGig

FlexiGig connects part-time workers with employers offering short-term gigs. Workers can browse and apply for jobs, while employers can post listings, manage applicants, and hire talent — all in one place.

> **Setting up the app for the first time?** See the full technical setup guide: [Technical_Documentation_Setup_and_Deployment.md](Technical_Documentation_Setup_and_Deployment.md)

---

## Two Types of Accounts

Before you sign up, decide which type of account fits you:

| Account Type | What you can do |
|---|---|
| **Worker** | Browse gigs, apply, track application status, message employers |
| **Employer** | Post job listings, review applicants, accept/reject candidates, message workers |

---

## Step 1 — Create Your Account

1. Open the app in your browser at `http://localhost:3000`
2. Click **Get Started** on the landing page
3. Choose **Worker** or **Employer**
4. Fill in your name, email, and password, then submit
5. Check your email inbox for a verification link and click it to activate your account

> Already have an account? Click **Sign In**, enter your email and password, and you'll land on your dashboard.

---

## Step 2 — Set Up Your Profile

A complete profile helps employers find you (workers) or builds trust with applicants (employers).

1. After logging in, click your name or avatar in the top corner
2. Go to **Profile** or **Edit Profile**
3. Fill in your details:
   - **Workers:** add a bio, skills, and your availability (days/hours you're free to work)
   - **Employers:** add a company name, description, and contact info
4. Click **Save** — your profile is now visible to others

---

## If You're a Worker

### Finding Gigs

1. From your dashboard, click **Find Gigs** in the navigation
2. You'll see a list of all available job postings
3. **To search:** type a job title or keyword in the search bar at the top
4. **To filter:** use the filter options to narrow results by:
   - Location (city or area)
   - Employer rating (e.g., only show employers rated 4 stars and above)
5. Click any job card to open the full details — pay, schedule, location, and description
6. If it looks good, click **Apply** to submit your application

### Checking Your Application Status

After applying, you can track where things stand at any time:

1. Click **Jobs Applied** in the navigation
2. You'll see all the jobs you've applied to, each with a status label:
   - **Applied** — your application was submitted and is waiting to be reviewed
   - **In Review** — the employer is actively considering you
   - **Accepted** — congratulations, you got the gig!
   - **Rejected** — the employer went with someone else this time
3. Use the search bar to find a specific application if you have many

### Viewing Accepted Gigs

1. Click **My Gigs** in the navigation
2. This shows only the gigs where you were accepted
3. Use the search bar to find a specific gig, or use the page buttons to browse if you have many

### Messaging an Employer

1. Click **Messages** in the navigation
2. You'll see a list of all your conversations
3. Click on a conversation to open the chat
4. Type your message in the box at the bottom and hit send
5. You can also use the quick-reply buttons: **"On my way"**, **"Can't make it"**, or **"Confirmed"**
6. New messages appear automatically — no need to refresh the page

---

## If You're an Employer

### Posting a Job

1. From your dashboard, click **Post a Gig** in the navigation
2. Fill in the job details:
   - **Title** — what the job is called (e.g., "Weekend Event Staff")
   - **Description** — what the worker will be doing
   - **Pay** — hourly rate or flat fee
   - **Location** — where the job takes place
   - **Schedule** — dates and times
3. Optional: check **Save as Template** if you post similar jobs often — you can reuse it next time
4. Click **Submit** — your listing goes live immediately and workers can start applying

### Reviewing Applicants

1. Click **My Jobs** in the navigation to see all your job postings
2. Click **View Applicants** on any listing
3. You'll see a list of everyone who applied — click on a name to view their profile and availability
4. For each applicant, choose an action:
   - **Accept** — hire them for the gig
   - **In Review** — save them as a maybe while you consider others
   - **Reject** — decline their application (they'll see their status update)
   - **Message** — open a direct chat to ask questions before deciding
5. Once the job is done, mark it as **Completed** and you'll be prompted to rate the workers you hired

### Messaging a Worker

1. Click the **Message** button next to any applicant to start a chat
2. Or go to **Messages** in the navigation to see all your ongoing conversations
3. Conversations are sorted by most recent activity, so active chats always appear at the top

---

## Quick Reference — Where to Find Things

| Task | Where to go |
|---|---|
| Browse available jobs | **Find Gigs** (worker dashboard) |
| Check your application status | **Jobs Applied** (worker dashboard) |
| See accepted gigs | **My Gigs** (worker dashboard) |
| Post a new job | **Post a Gig** (employer dashboard) |
| See who applied to your jobs | **My Jobs → View Applicants** |
| Chat with someone | **Messages** (either dashboard) |
| Edit your profile | Click your name/avatar → **Profile** |

---

## Setup & Technical Documentation

For installation instructions, environment configuration, database setup, deployment, and running tests — see the full guide:

**[Technical_Documentation_Setup_and_Deployment.md](Technical_Documentation_Setup_and_Deployment.md)**
