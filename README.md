# Contract Career Compass

**AI-ready job intelligence dashboard for contract, freelance and project-based technology roles.**

Contract Career Compass is a prototype designed to turn fragmented contract-job searches into a structured daily workflow.

Rather than functioning as a conventional job board, the application is designed around **job discovery, structured extraction, role classification, candidate matching and prioritisation**.

## The problem

Finding suitable contract roles requires repeatedly searching multiple sources, filtering irrelevant vacancies, interpreting inconsistent job titles and comparing requirements against a candidate profile.

Contract Career Compass explores how this process could be supported by an AI-powered workflow.
## Workflow & System Modelling
[AI-Assisted Workflow Design](diagram/AI-assisted-workflow-design.png) — human, AI and system responsibilities


The project uses a combination of workflow and system models to show how the solution works from different perspectives.

[Use Case Model — actors and system capabilities](diagram/LinkedIn-Insights-Use-Case-Model.png)

[Activity Diagram — user and system activities](diagram/LinkedIn-Insights-Activity-Diagram.png)

[Process Workflow — end-to-end business process](diagram/LinkedIn-Insights-Process-Workflow.png)

[Sequence Diagram — interactions between components](diagram/Sequence%20Diagram.png)

[Domain Model — key entities, data and relationships](diagram/LinkedIn-Insights-Domain-Model.png)

The architecture separates the job-search and analysis layer from the frontend, allowing the prototype data source to be replaced by a real search/AI service later.

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


