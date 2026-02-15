# Testing Amazon Chime SDK Integration

This guide provides step-by-step instructions to test the end-to-end audio/video functionality using Amazon Chime SDK.

---

## Prerequisites

Before testing, ensure you have:

1. **Valid AWS Credentials** with Chime SDK permissions:
   - `chime:CreateMeeting`
   - `chime:DeleteMeeting`
   - `chime:CreateAttendee`
   - `chime:ListAttendees`

2. **Browser with WebRTC support**:
   - Chrome 80+ (recommended)
   - Firefox 75+
   - Edge 80+
   - Safari 13+ (may have limitations)

3. **Microphone and Camera** (or virtual devices for testing).

4. **Application running locally**:
   - Backend: `http://localhost:3000`
   - Frontend: `http://localhost:5173`

---

## Step 1: Configure AWS Credentials

### Option A: Environment Variables (Backend)

Edit `backend/.env`:

```bash
# Amazon Chime SDK
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...YOUR_KEY
AWS_SECRET_ACCESS_KEY=your-secret-access-key

# Optional: For recording (requires S3 bucket + KMS)
CHIME_RECORDING_BUCKET=arn:aws:s3:::your-bucket-name
CHIME_KMS_KEY_ARN=arn:aws:kms:us-east-1:123456789012:key/...
```

### Option B: AWS CLI Profile

If you have configured AWS CLI (`aws configure`), the backend SDK will automatically use the default profile or the one specified in `AWS_PROFILE` environment variable.

```bash
# In backend/.env
AWS_PROFILE=default
AWS_REGION=us-east-1
```

### Verify Credentials

```bash
# From backend directory
cd backend
npx ts-node -e "import { ChimeSDKMeetingsClient } from '@aws-sdk/client-chime-sdk-meetings'; const client = new ChimeSDKMeetingsClient({ region: 'us-east-1' }); console.log('Chime client initialized successfully');"
```

---

## Step 2: Start the Application

### Terminal 1: Backend

```bash
cd backend
npm run start:dev
```

**Expected logs:**
- `Chime SDK initialized in region: us-east-1`
- `Nest application successfully started`
- `PostgreSQL connected`
- `Redis connected`

### Terminal 2: Frontend

```bash
cd frontend
npm run dev
```

**Expected output:**
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

---

## Step 3: Test Region Selection API

Open a new terminal and test the nearest region endpoint:

```bash
curl http://localhost:3000/api/chime/nearest-region
```

**Expected response:**
```json
{
  "region": "us-east-1"
}
```

Or (if you're geographically closer to another region):
```json
{
  "region": "us-west-2"
}
```

---

## Step 4: Login to Nurse Console

1. Open browser: [http://localhost:5173](http://localhost:5173)
2. Login with default credentials:
   - **Email:** `nurse1@rhythmx.dev`
   - **Password:** `Test1234!`
3. You should be redirected to the **Dashboard**.

---

## Step 5: Initiate a Test Call

### 5.1 Single Tab Test (Nurse Only)

This tests if the Chime SDK initializes correctly and requests device permissions.

1. **Select a room** from the Room Selector (e.g., `room-101`).
2. Click **"Call"** button.
3. **Browser will prompt for permissions** → Click **"Allow"** for both microphone and camera.
4. **Expected behavior:**
   - Call status changes to "RINGING".
   - Call dialog opens showing "Ringing patient room..." with animated icon.
   - Backend logs show:
     ```
     [ChimeService] Creating Chime meeting...
     [CallOrchestrationService] Chime meeting session created
     ```
5. **Check browser console (F12):**
   - `[CallStore] Nearest Chime region: us-east-1`
   - `[Chime] Session initialized`
   - `[Chime] Audio/Video started`

**Result:** This confirms AWS credentials work, Chime meeting is created, and the SDK initializes on the frontend.

### 5.2 Two-Tab Test (Nurse + Simulated Patient)

This tests full bidirectional audio/video with remote video tile binding.

**Tab 1 (Nurse):**
1. Login as `nurse1@rhythmx.dev`.
2. Select `room-101`.
3. Click **"Call"**.
4. Allow browser permissions.
5. **Keep this tab open** — you should see "Ringing patient room...".

**Tab 2 (Simulated Patient Device):**
1. Open a **new Incognito/Private window** or a **different browser**.
2. Navigate to [http://localhost:5173](http://localhost:5173).
3. Login (same user or register a new one).
4. **Immediately** select **the same room** (`room-101`).
5. Click **"Call"**.
6. Allow browser permissions.

**Expected behavior:**
- **Both tabs** should connect to the **same Chime meeting** (same `meetingId`).
- **Tab 1 (Nurse):** The main video area should now show **Tab 2's camera feed** (remote video).
- **Tab 2 (Patient):** The main video area should show **Tab 1's camera feed**.
- **Local video preview** in bottom right of each tab shows their own camera (mirrored).

**Test Controls:**
- Click **microphone icon** → Audio should mute/unmute (red icon when muted).
- Click **video icon** → Local video should turn off/on (red icon when off).
- Speak in one tab → Audio should be heard in the other tab.

### 5.3 End Call

- Click **"End Call"** in either tab.
- Backend calls `ChimeService.deleteMeeting()`.
- Meeting terminates for both participants.
- Call dialog closes.

---

## Step 6: Verify Backend Logs

Check backend terminal for Chime SDK operations:

**During call initiation:**
```
[ChimeService] Creating Chime meeting
  meetingToken: mtg-xxxxx
  mediaRegion: us-east-1
  locationId: room-101

[CallOrchestrationService] Chime meeting session created
  meetingId: abc123...
  status: INITIATING → RINGING
```

**During call end:**
```
[CallOrchestrationService] Call termination initiated
[ChimeService] Deleting Chime meeting
  meetingId: abc123...
```

---

## Step 7: Verify Frontend Console Logs

Open browser DevTools (F12) → Console tab.

**Expected logs:**

1. **Region fetch:**
   ```
   [CallStore] Nearest Chime region: us-east-1
   ```

2. **Chime SDK initialization:**
   ```
   [Chime] Session initialized { meetingId: "abc123...", attendeeId: "xyz..." }
   [Chime] Audio/Video started
   ```

3. **Video tile updates (when remote joins):**
   ```
   [Chime] Video tile updated 1 false
   ```
   - `1` = tile ID
   - `false` = not local tile (remote video)

4. **Local video tile:**
   ```
   [Chime] Video tile updated 0 true
   ```
   - `0` = tile ID
   - `true` = local tile

---

## Troubleshooting

### Error: "Failed to initialize Chime session"

**Check:**
1. AWS credentials are valid (test with `aws sts get-caller-identity`).
2. IAM user/role has `chime:CreateMeeting` and `chime:CreateAttendee` permissions.
3. Backend logs show Chime meeting created successfully.

**Browser console error examples:**
- `NotAllowedError` → User denied camera/mic permissions. Reload page and click "Allow".
- `NotFoundError` → No camera/mic detected. Connect a device or use virtual camera.

### No Audio/Video Between Tabs

**Possible causes:**
1. **Different meetings:** Check `meetingId` in console logs — must match.
2. **Network/firewall:** Ensure UDP ports 3478, 5349 are open (WebRTC).
3. **Browser compatibility:** Use Chrome/Firefox. Safari can be unreliable.

**Debug steps:**
1. Check browser console for `[Chime] Video tile updated` events.
2. Inspect `<video>` elements in DevTools → Should have `srcObject` set to a MediaStream.
3. Right-click video element → "Inspect" → Check `videoWidth` and `videoHeight` (should be > 0).

### Audio Works but No Video

- Check if video is muted/disabled in browser settings.
- Verify camera is not being used by another application.
- Test with Chrome's `chrome://webrtc-internals/` to see raw WebRTC stats.

### High Latency or Poor Quality

- Chime SDK auto-adjusts bitrate based on network conditions.
- Check `mediaRegion` in backend logs — should be nearest region.
- Test network speed: WebRTC requires at least 1-2 Mbps for smooth video.

---

## Advanced Testing

### Test with Multiple Rooms

1. Open **3 tabs**.
2. Tab 1 & 2: Call `room-101` → Should see each other.
3. Tab 3: Call `room-102` → Independent meeting, won't see Tab 1/2.

### Test Media Capture Pipeline (Recording)

**Requires:**
- S3 bucket configured in `CHIME_RECORDING_BUCKET`.
- KMS key ARN in `CHIME_KMS_KEY_ARN`.

**Steps:**
1. Initiate a call.
2. Backend automatically starts `MediaCapturePipeline` (see `ChimeService.startRecording`).
3. Check S3 bucket after 5-10 seconds → Should see 5-second chunks (MP4/WAV).

**Note:** Recording is optional and not required for basic audio/video to work.

---

## IAM Policy Example

If you need to create a policy for the backend IAM user:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "chime:CreateMeeting",
        "chime:DeleteMeeting",
        "chime:CreateAttendee",
        "chime:ListAttendees",
        "chime:CreateMediaCapturePipeline",
        "chime:DeleteMediaCapturePipeline"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::your-recording-bucket/*"
    }
  ]
}
```

---

## Success Criteria

✅ **Backend:** Creates Chime meeting successfully (check logs for `meetingId`).  
✅ **Frontend:** Fetches nearest region, receives join token, initializes SDK.  
✅ **Browser:** Requests and receives camera/mic permissions.  
✅ **Local Video:** Shows nurse's camera feed (mirrored) in bottom-right preview.  
✅ **Remote Video:** Shows patient's camera feed in main video area (two-tab test).  
✅ **Audio:** Clear bidirectional audio between participants.  
✅ **Controls:** Mute/unmute, video on/off work as expected.  
✅ **End Call:** Cleans up meeting, closes dialog, stops media streams.

If all criteria pass, the Amazon Chime SDK integration is working correctly! 🎉

---

## Next Steps

- **Production:** Configure GovCloud region (`us-gov-west-1`) and FedRAMP-compliant IAM policies.
- **Hardware Integration:** Connect actual patient room camera device to auto-join meetings.
- **Recording:** Implement media concatenation pipeline for playback.
- **Monitoring:** Add EventBridge listeners for `MeetingStarted`, `MeetingEnded`, `AttendeeJoined` events.
