# Contract Career Compass

**AI-ready job intelligence dashboard for contract, freelance and project-based technology roles.**

Contract Career Compass is a prototype designed to turn fragmented contract-job searches into a structured daily workflow.

Rather than functioning as a conventional job board, the application is designed around **job discovery, structured extraction, role classification, candidate matching and prioritisation**.

## The problem

Finding suitable contract roles requires repeatedly searching multiple sources, filtering irrelevant vacancies, interpreting inconsistent job titles and comparing requirements against a candidate profile.

Contract Career Compass explores how this process could be supported by an AI-powered workflow.

## Core workflow

```text
Job sources
    ↓
Job discovery
    ↓
Structured extraction
    ↓
Role classification
    ↓
Contract / language / location filtering
    ↓
Candidate-job matching
    ↓
Match scoring
    ↓
Recommendation
    ↓
Daily dashboard
    ↓
Human decision
```

The architecture separates the **job-search and analysis layer from the frontend**, allowing the prototype data source to be replaced by a real search/AI service later.

## AI capabilities

The planned AI workflow demonstrates five capabilities:

### 1. Job discovery

Identify newly published contract, freelance, temporary, fixed-term and project-based vacancies matching defined role and geographic criteria.

### 2. Role classification

Map different job titles into broader role categories such as:

* Technical Writing
* Business Analysis
* Requirements Engineering
* Documentation Engineering

This allows related roles to be identified even when employers use different terminology.

### 3. Structured extraction

Convert unstructured job advertisements into a consistent job record containing fields such as:

```text
title
company
location
contract_type
work_model
publication_date
language
requirements
source
url
```

### 4. Candidate-job matching

Compare extracted job requirements against a candidate profile and identify:

* Strong matches
* Partial matches
* Missing requirements
* Transferable experience
* Potential red flags

The prototype uses a 0–100 match score and a recommendation of:

**Apply / Maybe / Don't apply**

### 5. Workflow automation

The intended daily workflow is:

**Discover → analyse → prioritise → review → save/apply/reject**

The human remains in control of the final decision.

## Current prototype

The current version uses **realistic mock job data** to demonstrate the complete dashboard and interaction model.

Implemented:

* Job dashboard
* Job cards and detailed job views
* Interactive filtering
* Match scores
* Recommendations
* Saved jobs
* Application status tracking
* Search history
* Structured job data model
* Service layer separating data from the UI

The prototype is intentionally designed so that the mock data source can later be replaced by a real API or AI-powered search service without redesigning the frontend.

## Architecture

The frontend communicates with a service layer rather than directly depending on hard-coded job cards.

Example interface:

```text
getJobs()
getJob(id)
updateJobStatus(id, status)
```

This separation allows future integration with:

* Job-search APIs
* Web-search services
* AI extraction/classification
* Candidate-profile matching
* Automated daily searches

## Data model

Each job is represented as structured data including:

```text
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
```

## Why this project

The project explores the intersection of:

* AI-assisted information processing
* Knowledge and information architecture
* Requirements analysis
* Structured data
* Workflow design
* Human-in-the-loop decision making

The goal is not simply to build a job board, but to explore how an AI-assisted workflow can transform **unstructured job information into actionable career intelligence**.

## Technology

* Lovable
* React / TypeScript
* Structured JSON data
* Service-layer architecture
* GitHub

## Future architecture

The next evolution would replace the mock data source with an AI/search pipeline:

```text
External job sources
        ↓
Search / retrieval
        ↓
Extraction
        ↓
Classification
        ↓
Deduplication
        ↓
Candidate matching
        ↓
Scoring & recommendations
        ↓
Job intelligence API
        ↓
Contract Career Compass UI
```

This creates a path from a frontend prototype to a **real AI-powered job intelligence system**.

## Live prototype

**Live app:** https://contract-hunt-daily.lovable.app

Built as an AI-assisted prototype using Lovable.


