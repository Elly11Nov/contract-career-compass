# Contract Career Compass

Create a web application called Contract Job Finder.

The purpose of the application is to provide a daily dashboard of relevant contract job vacancies.

Core purpose

The application should display contract, freelance, temporary, fixed-term and project-based vacancies for:

Roles

Technical Writer

Senior Technical Writer

Documentation Engineer

Technical Documentation Specialist

API Technical Writer

Developer Documentation Writer

Technical Author

Documentation Specialist

Business Analyst

Senior Business Analyst

IT Business Analyst

Technical Business Analyst

Requirements Engineer

Requirements Analyst

Technical Requirements Engineer

Requirements Manager

closely related roles

Countries

Germany

France

Sweden

Denmark

Finland

Language

The working language must be English.

Local languages may be listed as additional/preferred languages but should not be mandatory as the primary working language.

Date

Only show vacancies published within the last 15 days.

Contract

Prioritize:

Contract

Freelance

Fixed-term

Temporary

Project-based

Contractor

Consulting assignment

Interim

Dashboard

Create a clean, professional dashboard that I can open every day.

At the top show:

Contract Job Finder

Then display:

Last updated

Number of new jobs

Number of qualifying jobs

Number of Technical Writer jobs

Number of Business Analyst jobs

Countries represented

Filters

Add interactive filters for:

Role

Country

Contract type

Date posted

Match score

Remote / Hybrid / Onsite

Allow multiple filters to be selected.

Job cards

Display each vacancy as a card containing:

Job title

Company

Country / city

Contract type

Duration, if known

Remote / Hybrid / Onsite

Publication date

English working language

Match score out of 100
Link to the vacancy

Recommendation:

Apply

Maybe

Don't apply

Show a short explanation of why the job matches.

Each card should have:

View job

which opens the original job advertisement.

Match score

Use a 0–100 match score.

Display:

90–100 = Excellent match
80–89 = Strong match
70–79 = Good match
60–69 = Possible match
Below 60 = Weak match

Use a visually clear score indicator.

Job detail view

Clicking a job should open a detailed view containing:

Job information

Job title

Company

Location

Contract type

Duration

Work model

Publication date

Source

Original job link

Match analysis

Show:

Strong matches

Partial matches

Missing requirements

Transferable experience

Potential red flags

Language assessment

Recommendation

Daily workflow

The dashboard should be designed around a daily workflow.

I want to be able to open the website and immediately see:

New today

Jobs that appeared since my previous visit.

Last 15 days

All currently qualifying jobs.

Saved

Jobs I have marked as interesting.

Applied

Jobs I have applied for.

Rejected

Jobs I have decided not to pursue.

Job status

Allow me to change a job's status:

New

Interested

Applied

Interview

Rejected

Closed

Persist these statuses.

Search history

Keep track of:

Last search date

Number of jobs found

Number added

Number removed

Search criteria

Design

Create a modern, clean professional interface.

It should feel like a personal job intelligence dashboard rather than a generic job board.

Prioritize readability and information density.

Use a desktop-first responsive design but make it usable on tablet and mobile.

Use clear typography, cards, badges and filtering controls.

Avoid unnecessary animations.

Important architecture requirement

Separate the UI from the job-search/search engine.

For the initial prototype:

Use realistic mock job data.

Build the complete dashboard and interaction model.

Create a clear data structure/API interface for job records.

Do NOT hard-code the job cards into the UI.

The application should be designed so that a real AI/job-search backend can later replace the mock data without redesigning the frontend.

Create reusable components for:

JobCard

JobDetail

FilterBar

MatchScore

StatusSelector

DashboardStats

SearchHistory

SavedJobs

Data model

Each job should support:

id

title

company

country

city

role_category

contract_type

duration

work_model

publication_date

source

url

language

match_score

recommendation

strong_matches

partial_matches

missing_requirements

transferable_experience

red_flags

status

date_added

Future integration

Design the application so it can later receive job data from an external AI/search service.

The frontend should not assume that mock data is permanent.

Include a clear placeholder/service layer such as:

getJobs()
getJob(id)
updateJobStatus(id, status)

so the mock data source can later be replaced with a real API.

For now, focus on building a polished, functional dashboard with realistic sample data.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://contract-hunt-daily.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8c8728fe-029e-497d-8fa1-72771baf3c0f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
