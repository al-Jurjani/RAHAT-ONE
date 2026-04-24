# RAHAT-ONE

Robotic Automation for Human Assistance and Transformation.

RAHAT-ONE is a multi-service HR operations platform built around Odoo ERP, with a Node.js backend, React frontend, n8n orchestrations, and a Modal-hosted fraud analysis service.

## What This Repo Contains

- HR onboarding pipeline (invite, registration, AI + HR verification)
- Attendance operations and HR attendance overview
- Leave request and decision workflows
- Expense submission and multi-stage approval with fraud checks
- Odoo custom modules and local Odoo+Postgres development stack
- Modal service for layered expense fraud analysis
- n8n flow definitions for orchestrated automation

## High-Level Architecture

1. Frontend (React) calls backend REST APIs.
2. Backend (Express) handles auth, policy checks, Odoo data access, and orchestration triggers.
3. Odoo (with custom addons) is the system of record for HR/expense/leave data.
4. n8n flows handle asynchronous business processes and decision handoffs.
5. Modal service handles layered fraud analysis for expense receipts.

## Repository Layout

```text
.
|- backend/               # Express API, Odoo adapter, controllers/routes/services
|- frontend/              # React application (HR + Employee portals)
|- modal/                 # Modal fraud analysis service (Python)
|- n8n-flows/             # JSON exports for automation flows
|- src/odoo_custom/       # Custom Odoo addons
|- config/                # Odoo config mounted into Docker Odoo container
|- scripts/               # Python utility/data scripts
|- tests/                 # Python test root
|- docker-compose.yml     # Local Odoo + Postgres stack
|- pyproject.toml         # Python tooling/test config
|- requirements.txt       # Python dependencies
```

## Key Subsystems

### Backend

- Runtime: Node.js (CommonJS)
- Entry point: `backend/server.js`
- App setup: `backend/src/app.js`
- API prefix: `/api`
- Health endpoints:
	- `GET /health`
	- `GET /test-odoo`

Primary API route groups:

- `/api/auth`
- `/api/onboarding`
- `/api/registration`
- `/api/hr/verification`
- `/api/lookup`
- `/api/employees` and `/api/employee`
- `/api/departments`
- `/api/branches`
- `/api/attendance`
- `/api/leaves`
- `/api/expenses`
- `/api/hr`
- `/api/audit`

### Frontend

- Runtime: React (Create React App)
- Main HR pages include:
	- HR home and verification
	- Expense management dashboards
	- Leave dashboards
	- Attendance overview
	- Branch and department management
	- Employee directory

### Modal Fraud Service

- File: `modal/fraud_detection.py`
- Modal app name: `rahat-fraud-detection`
- Exposes an ASGI endpoint used by backend/n8n (`/analyze`)
- Current layered framing in service docs:
	- Layer 1: Global duplicate check (MD5)
	- Layer 2: Receipt validation
	- Layer 3: Statistical anomaly detection

### n8n Flows

Flow exports are organized by domain:

- `n8n-flows/onboarding/`
- `n8n-flows/expense/`
- `n8n-flows/leaves/`
- `n8n-flows/attendance/`
- `n8n-flows/hr/`

## Prerequisites

- Node.js 18+
- npm 9+
- Python 3.10+
- Docker Desktop (for local Odoo + Postgres)
- Modal CLI (only if deploying/updating modal service)
- n8n instance (local or remote)

## Quick Start

### 1. Start Odoo + Postgres

From repo root:

```bash
docker compose up -d
```

This starts:

- Postgres 15 (`db`)
- Odoo 17 (`odoo`) on port `8069`

### 2. Run Backend

```bash
cd backend
npm install
npm run dev
```

Backend default URL: `http://localhost:5000`

### 3. Run Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend default URL: `http://localhost:3000`

## Environment Variables

Create `backend/.env` and `frontend/.env` as needed.

### Backend (`backend/.env`) Suggested Keys

```env
PORT=5000
NODE_ENV=development

ALLOWED_ORIGINS=http://localhost:3000
MAX_FILE_SIZE=5242880

JWT_SECRET=change-me

ODOO_URL=http://localhost:8069
ODOO_DB=rahatone_db
ODOO_USERNAME=admin
ODOO_PASSWORD=admin

DATABASE_URL=

AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=
AZURE_DOCUMENT_INTELLIGENCE_KEY=

MODAL_WEBHOOK_URL=

HR_EMAIL=hr@outfitters.com

N8N_ONBOARDING_WEBHOOK=
N8N_ONBOARDING_INVITE_URL=
N8N_ONBOARDING_DECISION_URL=

N8N_LEAVE_FLOW_URL=
N8N_LEAVE_MANAGER_DECISION_WEBHOOK=

N8N_EXPENSE_WEBHOOK_URL=
N8N_MANAGER_DECISION_WEBHOOK=
N8N_HR_DECISION_WEBHOOK=

N8N_ATTENDANCE_WEBHOOK_URL=
N8N_HR_BRANCH_SHIFT_ASSIGNMENT_WEBHOOK=
N8N_BRANCH_MANAGER_ASSIGN_WEBHOOK=
N8N_DEPARTMENT_MANAGER_CASCADE_WEBHOOK=
N8N_WEBHOOK_BASE_URL=

AI_VERIFICATION_THRESHOLD=80
NAME_MATCH_THRESHOLD=70
```

### Frontend (`frontend/.env`) Suggested Keys

```env
REACT_APP_API_URL=http://localhost:5000/api
```

## Scripts and Commands

### Backend

```bash
npm start        # start server
npm run dev      # start with nodemon
npm test         # jest watch mode
npm run migrate  # run DB migration script
```

### Frontend

```bash
npm start
npm run dev
npm run build
npm test
npm run generate-icons
```

### Python Tooling (Repo Root)

```bash
pip install -r requirements.txt
pytest
black .
isort .
flake8
mypy .
```

### Modal Service

```bash
modal deploy modal/fraud_detection.py
```

## Odoo Custom Addons

Custom modules are mounted from:

- `src/odoo_custom/employee_onboarding`
- `src/odoo_custom/fraud_detection`
- `src/odoo_custom/rahat_attendance`
- `src/odoo_custom/user_auth`

With Docker Compose, these are mounted into Odoo at `/mnt/extra-addons`.

## Utility Scripts

The `scripts/` folder contains operational and data scripts such as:

- mock data population
- leave type setup
- leave balance debugging
- Odoo cleanup and data consistency checks

Run them from repo root with your active Python environment.

## Troubleshooting

- Frontend cannot reach backend:
	- Verify `REACT_APP_API_URL`
	- Verify backend is running on expected port

- Backend Odoo errors:
	- Check Odoo container is up (`docker compose ps`)
	- Verify Odoo credentials/DB in `backend/.env`

- CORS blocked:
	- Add frontend origin to `ALLOWED_ORIGINS`

- Fraud analysis unavailable:
	- Verify `MODAL_WEBHOOK_URL`
	- Ensure Modal app is deployed and reachable

- Workflow actions not firing:
	- Verify n8n webhook URLs in `backend/.env`
	- Check n8n flow activation and execution logs

## Notes

- Existing detailed backend endpoint docs are in `backend/API.md`.
- `docs/` is currently empty and can be used for additional architecture/runbooks.
