```markdown
# MASTER PROJECT CONTEXT: GetWell RhythmX Virtual Care (Phase 1)

## 1. Project Overview & Objectives
**Role:** Principal Solution Architect & Full-Stack Developer.
**Goal:** Build "Phase 1" of the inpatient Virtual Care Platform. This system enables nurses to initiate ad-hoc, bi-directional video calls from a web console to a patient's room TV via a dedicated camera device.

### Success Metrics (Strict Constraints)
*   **Latency:** Median time-to-connect must be **< 2 seconds** from the moment the patient accepts.
*   **Reliability:** Call setup success rate **≥ 99.9%**; Video service uptime **≥ 99.99%**.
*   **Quality:** 1080p video (FHD) with low latency.
*   **Compliance:** HIPAA compliant (PHI safe), **AWS GovCloud** deployable (FedRAMP Moderate).

---

## 2. Architecture & Tech Stack
Based on *GW RhythmX Proposal* and *Contractor Job Descriptions*:

*   **Frontend (Nurse Console):** Vue.js / Vuetify (embedded via SingleSPA).
*   **Backend (Orchestrator):** Node.js (NestJS recommended) or Python.
*   **Database:** PostgreSQL (Relational data), Redis (Session state/Caching for <2s latency).
*   **Infrastructure:** AWS GovCloud (FedRAMP).
*   **Video Engine:** **Amazon Chime SDK** (WebRTC).
*   **Hardware:** Android/Linux-based camera device with PTZ/IR capabilities, connected via HDMI-CEC.

---

## 3. The "Digital Knock" Workflow (Core Logic)
*Source: Virtual Care Phase 1 PRD & GW-Video-Integration-REST-API*

### POC Flow (Nurse ↔ Patient Browser)

The POC implements a **browser-to-browser** flow where both nurse and patient use web clients:

1.  **Nurse Initiates Call:** Nurse clicks "Call" in the web console (e.g. room-101).
2.  **Meeting Creation:** Backend calls AWS Chime SDK to create a meeting and nurse attendee.
3.  **Patient Notification:** Backend emits WebSocket `incoming_call` to patient(s) registered for that room (via Socket.IO).
4.  **Patient Prompt:** Patient browser (at `/patient/room-101`) shows "Incoming Video Call" dialog.
5.  **Patient Action:**
    *   **IF ACCEPTED:** Patient browser calls `POST /api/calls/patient-accept`. Backend creates patient attendee, returns Chime credentials. Patient joins Chime meeting directly (WebRTC video/audio).
    *   **IF DECLINED:** Patient browser calls `POST /api/calls/patient-decline`. Backend tears down Chime meeting and notifies Nurse.
6.  **Termination:** Call ends (nurse or patient). Backend tears down Chime meeting, notifies both sides via WebSocket.

### Production Flow (TV + Camera Device)

The system also supports the full hardware flow:

1.  **Nurse Initiates Call** → Backend creates Chime meeting.
2.  **TV Signal (The Knock):** Backend POSTs to **GetWell Stay API** (`/start_call`) with `meetingId` and `locationId`.
3.  **Patient Prompt:** TV shows "Incoming Call from [Nurse Name]."
4.  **Patient Action:**
    *   **IF ACCEPTED:** TV webhook → Backend signals Camera Device via WebSocket → Camera joins Chime meeting.
    *   **IF DECLINED:** TV webhook → Backend tears down meeting.
    *   **IF EMERGENCY (Override):** Camera auto-joins without patient input.
6.  **Termination:** Backend POSTs to GetWell Stay API (`/end_call`) to restore TV state.

---

## 4. API Integration Specifications
*Source: GW-Video-Integration-REST-API.pdf*

### A. Authentication (Outbound to TV System)
*   **Mechanism:** OAuth2 Client Credentials.
*   **Endpoint:** `POST /oauth/token`
*   **Header:** `Authorization: Basic <Base64 client_id:client_secret>`

### B. TV Control Endpoints (You call these)
**1. Start Call (Trigger "Knock")**
*   **POST** `/api/video/integration/v1/start_call`
*   **Payload:**
    ```json
    {
      "locationId": "room-123",      // Mapped to physical room
      "meetingId": "unique-uuid",    // Your internal session ID
      "callerName": "Nurse Joy",     // Displayed on TV
      "systemName": "GetWell",
      "callType": "regular"          // or "override" for emergency
    }
    ```

**2. End Call (Restore TV)**
*   **POST** `/api/video/integration/v1/end_call`
*   **Payload:**
    ```json
    {
      "locationId": "room-123",
      "meetingId": "unique-uuid",
      "systemName": "GetWell"
    }
    ```

### C. Webhook Handler (You receive these)
**Patient Action Callback**
*   **POST** `/api/ipc/client/action` (Your endpoint)
*   **Payload:**
    ```json
    {
      "action": "ACCEPTED",          // Values: ACCEPTED, DECLINED, IGNORED
      "time": "2026-02-06T10:00:00Z",
      "locationId": "room-123",
      "meetingId": "unique-uuid"
    }
    ```

---

## 5. Amazon Chime SDK Implementation Rules
*Source: chime-sdk-dg.pdf (Strict adherence required)*

1.  **Idempotency:** You MUST generate and send a unique `ClientRequestToken` when creating meetings (`CreateMeeting`) or media pipelines (`CreateMediaCapturePipeline`) to prevent duplicate billing/resources on retries.
2.  **Region Selection:** Implement logic to ping `https://nearest-media-region.l.chime.aws` from the client to determine the lowest latency `MediaRegion` before creating the meeting.
3.  **Media Capture (Recording):**
    *   Phase 1 requires recording enabled.
    *   Use **Media Capture Pipelines**.
    *   Configure artifacts to store in an encrypted S3 bucket (`SSE-S3` or `SSE-KMS`).
    *   Do not enable "Live Transcription" or "Voice Analytics" for Phase 1 unless explicitly requested for future AI training data collection.
4.  **Device Layout:** For the frontend (Nurse Console), implement `GridView` for video tiles as defined in the SDK documentation.

---

## 6. Hardware & Client Constraints
*Source: Hardware Requirements.pdf & In-Room Endpoint Engineer Job Description*

*   **Device Identity:** The camera hardware acts as a "Kiosk." It must have a persistent WebSocket connection to the backend to receive the "Wake Up" signal.
*   **PTZ Control:** The Nurse Console must implement PTZ (Pan-Tilt-Zoom) controls. These commands must be sent via signaling (WebSocket/Data Channel) to the camera hardware to mechanically move the lens.
*   **Health Checks:** The hardware client must implement a "Heartbeat" or "Watchdog" to report health status to the backend. If the camera is offline, the backend must reject the call attempt immediately.

## 7. Security & Compliance (Non-Negotiable)
*   **No PHI in Logs:** Never log patient names or MRNs. Use anonymized `meetingId` or `locationId`.
*   **Encryption:** All data in transit must use TLS 1.2+. Recordings must be encrypted at rest in S3.
*   **Audit Trails:** Every "Call Attempt," "Connect," "Drop," and "Termination" event must be logged for HIPAA auditing.
```