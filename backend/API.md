# RAHAT-ONE Backend API Documentation

**Version:** 1.0
**Base URL:** `http://localhost:5000`
**Last Updated:** December 27, 2025

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Registration Endpoints](#registration-endpoints)
4. [HR Verification Endpoints](#hr-verification-endpoints)
5. [Lookup Endpoints](#lookup-endpoints)
6. [Legacy Onboarding Endpoints](#legacy-onboarding-endpoints)
7. [Error Handling](#error-handling)
8. [Database Schema](#database-schema)

---

## Overview

The RAHAT-ONE backend provides RESTful APIs for managing employee onboarding with AI-powered document verification. The system integrates with Odoo ERP for data storage and Power Automate for workflow orchestration.

**Technology Stack:**
- Node.js + Express
- Odoo 17 (via XML-RPC)
- Azure Document Intelligence (OCR)
- Power Automate (workflow automation)

---

## Authentication

**Current Status:** No authentication implemented (MVP phase)

**Future:** JWT-based authentication will be added with the following roles:
- `employee` - Can view own data and submit requests
- `hr_staff` - Can review and approve/reject registrations
- `hr_admin` - Full system access

---

## Registration Endpoints

### 1. Initiate Onboarding

**Endpoint:** `POST /api/registration/initiate`

**Description:** HR initiates onboarding by sending an invitation email to the candidate's personal email.

**Request Body:**
```json
{
  "personalEmail": "ahmed.candidate@gmail.com",
  "name": "Ahmed Khan"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "employeeId": 493,
    "status": "initiated",
    "message": "Invitation email sent successfully"
  }
}
```

**Errors:**
- `400 Bad Request` - Missing personalEmail

**Side Effects:**
- Creates employee record in Odoo with status "initiated"
- Triggers Power Automate flow to send invitation email
- Sets AI and HR verification status to "pending"

---

### 2. Complete Registration

**Endpoint:** `POST /api/registration/complete`

**Description:** Candidate completes registration by providing personal information and uploading required documents. Triggers AI verification automatically.

**Content-Type:** `multipart/form-data`

**Form Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| personalEmail | Text | Yes | Personal email used in invitation |
| name | Text | Yes | Full name |
| cnicNumber | Text | Yes | CNIC number (13 digits) |
| fatherName | Text | Yes | Father's full name |
| dateOfBirth | Text | Yes | Date of birth (YYYY-MM-DD) |
| phone | Text | Yes | Mobile phone number |
| departmentId | Text | Yes | Department ID from lookup |
| jobPositionId | Text | Yes | Job position ID from lookup |
| password | Text | Yes | Account password |
| cnic | File | Yes | CNIC image (JPG/PNG) |
| degree | File | No | Degree certificate (PDF) |
| medical | File | No | Medical certificate (PDF) |

**Example Request (Postman):**
```
POST http://localhost:5000/api/registration/complete
Content-Type: multipart/form-data

personalEmail: ahmed.candidate@gmail.com
name: Ahmed Ali Khan
cnicNumber: 42101-1234567-8
fatherName: Ali Muhammad Khan
dateOfBirth: 1995-05-15
phone: +92-300-1234567
departmentId: 11
jobPositionId: 21
password: SecurePass123!
cnic: [file: cnic_image.jpg]
degree: [file: degree.pdf]
medical: [file: medical.pdf]
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "employeeId": 495,
    "workEmail": "ahmed.khan@outfitters.com",
    "status": "documents_submitted",
    "message": "Registration completed! Your documents are being verified. You will receive an email once verification is complete."
  }
}
```

**Errors:**
- `400 Bad Request` - Missing required fields
- `400 Bad Request` - CNIC document is required
- `404 Not Found` - No pending registration found for this email

**Side Effects:**
- Uploads documents to Odoo (ir.attachment)
- Updates employee record with registration data
- Generates work email: `firstname.lastname@outfitters.com`
- Triggers AI verification asynchronously
- Updates status to "documents_submitted"

**Console Output:**
```
📋 Registration data received:
  departmentId: 11 number
  jobPositionId: 21 number
File uploaded to Odoo. Attachment ID: 5508
👤 User account should be created: ahmed.khan@outfitters.com
🤖 Running AI verification for employee 495
✅ AI verification complete: PASSED
```

---

### 3. Get Registration Status

**Endpoint:** `GET /api/registration/status`

**Description:** Candidate checks their registration status using their personal email.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| personalEmail | String | Yes | Personal email address |

**Example Request:**
```
GET http://localhost:5000/api/registration/status?personalEmail=ahmed.candidate@gmail.com
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "employeeId": 495,
    "status": "verification_pending",
    "progress": 50,
    "aiVerification": {
      "status": "passed",
      "score": 95
    },
    "hrVerification": {
      "status": "pending"
    },
    "workEmail": "ahmed.khan@outfitters.com",
    "rejectionReason": null,
    "rejectionDetails": null
  }
}
```

**Errors:**
- `400 Bad Request` - Personal email is required
- `404 Not Found` - No registration found

**Notes:**
- If multiple employees exist with same email, returns the most recent one (highest ID)
- Progress percentage is calculated from completed onboarding steps

---

## HR Verification Endpoints

### 4. Get Pending Registrations

**Endpoint:** `GET /api/hr/verification/pending`

**Description:** Returns list of all candidates awaiting HR verification.

**Example Request:**
```
GET http://localhost:5000/api/hr/verification/pending
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": 495,
      "name": "Ahmed Ali Khan",
      "personalEmail": "ahmed.candidate@gmail.com",
      "workEmail": "ahmed.khan@outfitters.com",
      "department": "IT Department",
      "position": "Junior Developer",
      "onboardingStatus": "verification_pending",
      "aiVerification": {
        "status": "passed",
        "score": 95,
        "date": "2025-12-27 09:15:30"
      },
      "hrVerification": {
        "status": "pending"
      },
      "documentsUploaded": {
        "cnic": true,
        "degree": true,
        "medical": false
      },
      "submittedDate": "2025-12-27 09:13:03"
    }
  ]
}
```

**Filters:**
- Only shows employees with status "documents_submitted" or "verification_pending"
- Ordered by submission date (newest first)

---

### 5. Get Verification Details

**Endpoint:** `GET /api/hr/verification/details/:employeeId`

**Description:** Returns detailed verification information for a specific candidate, including side-by-side comparison of entered vs extracted data.

**URL Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| employeeId | Integer | Yes | Employee ID |

**Example Request:**
```
GET http://localhost:5000/api/hr/verification/details/495
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "employee": {
      "id": 495,
      "name": "Ahmed Ali Khan",
      "personalEmail": "ahmed.candidate@gmail.com",
      "workEmail": "ahmed.khan@outfitters.com",
      "phone": "+92-300-1234567",
      "department": "IT Department",
      "position": "Junior Developer"
    },
    "enteredData": {
      "name": "Ahmed Ali Khan",
      "cnicNumber": "42101-1234567-8",
      "fatherName": "Ali Muhammad Khan",
      "dateOfBirth": "1995-05-15"
    },
    "extractedData": {
      "name": "Ahmed Ali Khan",
      "cnicNumber": "42101-1234567-8",
      "fatherName": "Ali Muhammad Khan",
      "dateOfBirth": "1995-05-15",
      "ocrConfidence": 92.5
    },
    "aiVerification": {
      "status": "passed",
      "score": 95,
      "date": "2025-12-27 09:15:30",
      "details": {
        "name": {
          "extracted": "Ahmed Ali Khan",
          "entered": "Ahmed Ali Khan",
          "score": 100,
          "match": true
        },
        "cnic": {
          "extracted": "42101-1234567-8",
          "entered": "42101-1234567-8",
          "score": 100,
          "match": true
        },
        "fatherName": {
          "extracted": "Ali Muhammad Khan",
          "entered": "Ali Muhammad Khan",
          "score": 100,
          "match": true
        },
        "dob": {
          "extracted": "1995-05-15",
          "entered": "1995-05-15",
          "score": 100,
          "match": true
        }
      }
    },
    "hrVerification": {
      "status": "pending",
      "notes": null
    },
    "documents": [
      {
        "id": 5508,
        "name": "CNIC",
        "filename": "cnic_Ahmed_Ali_Khan.jpg",
        "type": "image/jpeg",
        "uploadedDate": "2025-12-27 09:13:05"
      },
      {
        "id": 5509,
        "name": "Degree",
        "filename": "degree_Ahmed_Ali_Khan.pdf",
        "type": "application/pdf",
        "uploadedDate": "2025-12-27 09:13:07"
      }
    ],
    "onboardingStatus": "verification_pending"
  }
}
```

**Errors:**
- `404 Not Found` - Employee with ID not found

---

### 6. Approve Candidate

**Endpoint:** `POST /api/hr/verification/approve/:employeeId`

**Description:** HR approves candidate after reviewing documents and verification results.

**URL Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| employeeId | Integer | Yes | Employee ID to approve |

**Request Body:**
```json
{
  "notes": "All documents verified. Department and role confirmed. Approved for activation."
}
```

**Example Request:**
```
POST http://localhost:5000/api/hr/verification/approve/495
Content-Type: application/json

{
  "notes": "Documents look good. Approved for onboarding."
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "message": "Candidate approved successfully",
    "status": "verified"
  }
}
```

**Errors:**
- `404 Not Found` - Employee not found

**Side Effects:**
- Updates `hr_verification_status` to "approved"
- Stores HR notes and verified_by user
- If both AI and HR verification passed, updates `onboarding_status` to "verified"
- TODO: Triggers email provisioning flow via Power Automate

---

### 7. Reject Candidate

**Endpoint:** `POST /api/hr/verification/reject/:employeeId`

**Description:** HR rejects candidate with a specific reason.

**URL Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| employeeId | Integer | Yes | Employee ID to reject |

**Request Body:**
```json
{
  "reason": "cnic_mismatch",
  "details": "The CNIC number extracted does not match the entered data."
}
```

**Rejection Reasons (Selection Field):**
- `cnic_mismatch` - CNIC data does not match
- `name_mismatch` - Name does not match
- `dob_mismatch` - Date of birth does not match
- `invalid_documents` - Documents are invalid or unclear
- `wrong_department` - Selected wrong department
- `duplicate_entry` - Duplicate registration
- `failed_background_check` - Background check failed
- `other` - Other reason (specify in details)

**Example Request:**
```
POST http://localhost:5000/api/hr/verification/reject/496
Content-Type: application/json

{
  "reason": "invalid_documents",
  "details": "CNIC image is not clear enough for verification. Please upload a clearer image."
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "message": "Candidate rejected",
    "reason": "invalid_documents"
  }
}
```

**Errors:**
- `400 Bad Request` - Rejection reason is required
- `404 Not Found` - Employee not found

**Side Effects:**
- Updates `hr_verification_status` to "rejected"
- Updates `onboarding_status` to "rejected"
- Stores rejection reason and details
- Records rejection timestamp
- TODO: Triggers rejection email via Power Automate

---

## Lookup Endpoints

### 8. Get Departments

**Endpoint:** `GET /api/lookup/departments`

**Description:** Returns all departments for candidate selection during registration.

**Example Request:**
```
GET http://localhost:5000/api/lookup/departments
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": 9,
      "name": "Human Resources"
    },
    {
      "id": 10,
      "name": "Finance & Accounting"
    },
    {
      "id": 11,
      "name": "IT Department"
    },
    {
      "id": 12,
      "name": "Sales & Marketing"
    },
    {
      "id": 13,
      "name": "Operations"
    },
    {
      "id": 14,
      "name": "Customer Service"
    },
    {
      "id": 15,
      "name": "Supply Chain & Logistics"
    }
  ]
}
```

---

### 9. Get Job Positions

**Endpoint:** `GET /api/lookup/positions`

**Description:** Returns job positions, optionally filtered by department.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| departmentId | Integer | No | Filter positions by department |

**Example Request (All Positions):**
```
GET http://localhost:5000/api/lookup/positions
```

**Example Request (Filtered by Department):**
```
GET http://localhost:5000/api/lookup/positions?departmentId=11
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": 18,
      "name": "IT Manager",
      "departmentId": 11,
      "departmentName": "IT Department"
    },
    {
      "id": 19,
      "name": "Senior Developer",
      "departmentId": 11,
      "departmentName": "IT Department"
    },
    {
      "id": 20,
      "name": "Software Developer",
      "departmentId": 11,
      "departmentName": "IT Department"
    },
    {
      "id": 21,
      "name": "Junior Developer",
      "departmentId": 11,
      "departmentName": "IT Department"
    }
  ]
}
```

---

## Legacy Onboarding Endpoints

### 10. Initiate Onboarding (Legacy)

**Endpoint:** `POST /api/onboarding/initiate`

**Description:** Original onboarding initiation endpoint (replaced by `/api/registration/initiate`)

**Status:** Kept for backward compatibility

**Request Body:**
```json
{
  "employeeData": {
    "name": "Ahmed Khan",
    "email": "ahmed@example.com",
    "department": "IT",
    "position": "Developer"
  }
}
```

---

### 11. Upload Document (Legacy)

**Endpoint:** `POST /api/onboarding/upload-document`

**Description:** Original document upload endpoint (replaced by `/api/registration/complete`)

**Status:** Kept for backward compatibility

---

### 12. Get Onboarding Status

**Endpoint:** `GET /api/onboarding/status/:employeeId`

**Description:** Returns onboarding progress for an employee.

**URL Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| employeeId | Integer | Yes | Employee ID |

**Example Request:**
```
GET http://localhost:5000/api/onboarding/status/495
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "employeeId": 495,
    "name": "Ahmed Ali Khan",
    "status": "verified",
    "progress": 70,
    "email": "ahmed.khan@outfitters.com"
  }
}
```

---

## Error Handling

All endpoints follow a consistent error response format:

**Error Response Structure:**
```json
{
  "success": false,
  "message": "Error description here"
}
```

**HTTP Status Codes:**
- `200 OK` - Request succeeded
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid request data
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

**Common Error Messages:**

| Status | Message | Cause |
|--------|---------|-------|
| 400 | Missing required fields | Required field not provided |
| 400 | Personal email is required | Missing personalEmail parameter |
| 400 | CNIC document is required | CNIC file not uploaded |
| 400 | Rejection reason is required | Missing reason in reject request |
| 404 | No registration found | Employee with email doesn't exist |
| 404 | Employee with ID X not found | Invalid employee ID |
| 500 | Odoo connection failed | Odoo server unreachable |
| 500 | XML-RPC fault: ... | Odoo internal error |

---

## Database Schema

### Custom Odoo Fields (hr.employee model)

**Module:** `rahatone_custom`

#### Onboarding Status Fields

| Field | Type | Description |
|-------|------|-------------|
| onboarding_status | Selection | Current onboarding stage |
| onboarding_progress_percentage | Float | Completion percentage (0-100) |
| onboarding_initiated_date | Datetime | When onboarding started |
| onboarding_completed_date | Datetime | When onboarding finished |

**Onboarding Status Values:**
- `not_started` - Initial state
- `initiated` - HR sent invitation
- `documents_submitted` - Candidate completed registration
- `verification_pending` - Awaiting AI/HR verification
- `verified` - Both AI and HR approved
- `provisioning` - Email/system access being created
- `activated` - Fully onboarded
- `rejected` - Rejected by HR or AI

#### Document Flags

| Field | Type | Description |
|-------|------|-------------|
| cnic_uploaded | Boolean | CNIC document uploaded |
| degree_uploaded | Boolean | Degree certificate uploaded |
| medical_uploaded | Boolean | Medical certificate uploaded |
| documents_verified | Boolean | All documents verified |

#### AI Verification Fields

| Field | Type | Description |
|-------|------|-------------|
| ai_verification_status | Selection | AI verification result |
| ai_verification_score | Float | Overall AI score (0-100) |
| ai_verification_details | Text | JSON with detailed breakdown |
| ai_verification_date | Datetime | When AI verification ran |
| extracted_name | Char | Name extracted from CNIC |
| extracted_cnic_number | Char | CNIC number extracted |
| extracted_father_name | Char | Father's name extracted |
| extracted_dob | Date | Date of birth extracted |
| ocr_confidence | Float | OCR confidence score |

**AI Verification Status Values:**
- `pending` - Not yet verified
- `passed` - AI verification successful
- `failed` - AI verification failed

#### User-Entered Data Fields

| Field | Type | Description |
|-------|------|-------------|
| entered_cnic_number | Char | CNIC number entered by user |
| entered_father_name | Char | Father's name entered by user |
| private_email | Char | Personal email address |

#### HR Manual Verification Fields

| Field | Type | Description |
|-------|------|-------------|
| hr_verification_status | Selection | HR verification result |
| hr_verification_notes | Text | HR reviewer notes |
| hr_verified_by | Many2one(res.users) | HR user who verified |
| hr_verified_date | Datetime | When HR verified |

**HR Verification Status Values:**
- `pending` - Awaiting HR review
- `approved` - HR approved
- `rejected` - HR rejected

#### Rejection Fields

| Field | Type | Description |
|-------|------|-------------|
| rejection_reason | Selection | Reason for rejection |
| rejection_details | Text | Additional rejection details |
| rejection_date | Datetime | When rejected |

**Rejection Reason Values:**
- `cnic_mismatch` - CNIC data mismatch
- `name_mismatch` - Name mismatch
- `dob_mismatch` - DOB mismatch
- `invalid_documents` - Invalid documents
- `wrong_department` - Wrong department selected
- `duplicate_entry` - Duplicate registration
- `failed_background_check` - Failed background check
- `other` - Other reason

#### Provisioning Flags

| Field | Type | Description |
|-------|------|-------------|
| email_provisioned | Boolean | Work email created |
| system_access_provisioned | Boolean | System access granted |
| orientation_completed | Boolean | Orientation completed |

---

## AI Verification Algorithm

### Scoring Methodology

**Weighted Scoring System:**

| Component | Weight | Description |
|-----------|--------|-------------|
| CNIC Number | 40% | Exact match required |
| Name | 35% | Fuzzy matching (Levenshtein + Dice coefficient) |
| Date of Birth | 15% | Exact match |
| Father's Name | 10% | Fuzzy matching |

**Thresholds:**
- Overall pass threshold: 80% (configurable via `AI_VERIFICATION_THRESHOLD`)
- Name match threshold: 70% (configurable via `NAME_MATCH_THRESHOLD`)

**Example AI Verification Details JSON:**
```json
{
  "overallScore": 95,
  "passed": true,
  "details": {
    "name": {
      "extracted": "Ahmed Ali Khan",
      "entered": "Ahmed Ali Khan",
      "score": 100,
      "match": true
    },
    "cnic": {
      "extracted": "42101-1234567-8",
      "entered": "42101-1234567-8",
      "score": 100,
      "match": true
    },
    "fatherName": {
      "extracted": "Ali Muhammad Khan",
      "entered": "Ali Muhammad Khan",
      "score": 100,
      "match": true
    },
    "dob": {
      "extracted": "1995-05-15",
      "entered": "1995-05-15",
      "score": 100,
      "match": true
    }
  },
  "reasons": []
}
```

---

## Testing Guide

### Prerequisites
1. Odoo server running at `http://localhost:8069`
2. Backend server running at `http://localhost:5000`
3. Postman or similar API testing tool

### Complete Test Flow

**Step 1: Get Lookup Data**
```
GET /api/lookup/departments
GET /api/lookup/positions?departmentId=11
```

**Step 2: HR Initiates Onboarding**
```
POST /api/registration/initiate
{
  "personalEmail": "test@gmail.com",
  "name": "Test Candidate"
}
```

**Step 3: Candidate Completes Registration**
```
POST /api/registration/complete
(form-data with all fields + files)
```

**Step 4: Check Registration Status**
```
GET /api/registration/status?personalEmail=test@gmail.com
```

**Step 5: HR Reviews Pending**
```
GET /api/hr/verification/pending
```

**Step 6: HR Views Details**
```
GET /api/hr/verification/details/{employeeId}
```

**Step 7: HR Approves**
```
POST /api/hr/verification/approve/{employeeId}
{
  "notes": "Approved"
}
```

**Step 8: Verify Final Status**
```
GET /api/registration/status?personalEmail=test@gmail.com
```

---

## Environment Variables

**File:** `backend/.env`
```env
# Odoo Configuration
ODOO_URL=http://localhost:8069
ODOO_DB=odoo
ODOO_USERNAME=admin
ODOO_PASSWORD=admin

# Power Automate
POWER_AUTOMATE_FLOW_URL=https://prod-xx.azure.com/workflows/.../triggers/manual/invoke

# n8n HR assignment flows
N8N_HR_BRANCH_SHIFT_ASSIGNMENT_WEBHOOK=http://localhost:5678/webhook/hr-employee-branch-shift-assign
N8N_DEPARTMENT_MANAGER_CASCADE_WEBHOOK=http://localhost:5678/webhook/department-manager-cascade

# Azure Document Intelligence
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
AZURE_DOCUMENT_INTELLIGENCE_KEY=your-api-key-here

# AI Verification Thresholds
AI_VERIFICATION_THRESHOLD=80
NAME_MATCH_THRESHOLD=70
CNIC_EXACT_MATCH_REQUIRED=true

# Server
PORT=5000
NODE_ENV=development
```

---

## Known Issues & TODOs

### Current Limitations
- No authentication/authorization implemented
- AI verification uses mock data (Azure not configured)
- Email provisioning not implemented (console log only)
- Password not hashed (stored as plain text)
- No file size validation beyond 5MB limit
- Multiple employees can have same personal email

### Pending Implementation
- [ ] JWT authentication middleware
- [ ] Azure Document Intelligence integration
- [ ] Power Automate webhook triggers
- [ ] Password hashing (bcrypt)
- [ ] Email provisioning via Microsoft Graph API
- [ ] File cleanup scheduler for temp directory
- [ ] Unique constraint on private_email field
- [ ] Rate limiting on API endpoints
- [ ] Request logging middleware

---

## Changelog

### Version 1.0 (December 27, 2025)
- Initial API implementation
- Registration flow with AI verification
- HR verification endpoints
- Lookup endpoints for departments/positions
- Odoo integration via XML-RPC
- Mock AI verification service
- Complete onboarding status tracking

---

**End of API Documentation**
