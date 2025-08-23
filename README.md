# VaryTest

A React + Firebase teacher/student portal for creating dynamic question banks, managing classes and subjects, integrating with Google Classroom/Gmail, and letting students join classes via codes.

Last updated: 2025-08-23

---

## TL;DR

- Stack: Create React App, Firebase Auth + Firestore, Firebase Hosting, Cloud Functions, Google Classroom + Gmail APIs, Tailwind via CDN.
- Roles: Teacher and Student.
- Core paths in Firestore namespaced under an App ID: `artifacts/{APP_ID}/users/{userId}/...`.
- Key collections: subjects, classes, questions, joinRequests (CF), assignmentRequests (Gmail/GC integration), testAssignments (results storage).
- Class joining: client checks `classes` via collectionGroup, enforces `isJoinable`, writes to class.students and user.joinedClasses. A Cloud Function exists for join-by-request too.

---

## Project Structure

```
varytest-app/
  firebase.json                 # Firebase Hosting + Functions config
  package.json                  # CRA app package
  public/index.html             # Tailwind CDN, CRA template
  functions/                    # Firebase Cloud Functions (Node 22)
    index.js                    # processJoinRequest on joinRequests
    package.json
  src/
    App.js                      # App init, auth, routing between dashboards
    AuthScreen.js               # Login/Signup toggle container
    Auth/                       # Auth components
      Login.js
      Signup.js
    Teacher/
      TeacherDashboard.js       # Tabs: subjects, classes, Google Classroom, results
      SubjectList.js            # Create/list subjects, link indicator
      ClassList.js              # Create/list classes, toggle isJoinable
      QuestionBank.js           # Subject-specific question list, add form
      DynamicQuestionForm.js    # Build questions with variables and formulas
      GoogleClassroomLinker.js  # Link subjects to GC courses, email/assign requests
      GoogleClassroom.js        # Presentational GC roster viewer (legacy)
      StudentRosterViewer.js    # Presentational email sender (legacy)
      TestResults.js            # View testAssignments and details modal
    Student/
      StudentDashboard.js       # Join + list joined classes
      JoinClass.js              # Join by class code (respects isJoinable)
      StudentClassList.js       # Resolve joined class details
    utils/
      firebaseConfig.js         # Local Firebase config fallback
      helpers.js                # Canvas globals + cursor insert helpers
```

---

## Runtime Architecture

- React app initializes Firebase using either:
  - Canvas-provided globals (`__firebase_config`, `__app_id`, `__initial_auth_token`) if present, or
  - Local `firebaseConfig.js` export for standalone runs.
- Auth flows:
  - `onAuthStateChanged` drives UI. If Canvas supplies a custom token, app tries `signInWithCustomToken` when user is unauthenticated.
  - Logout uses `signOut` and resets view back to `AuthScreen`.
- Data domain (namespaced by `APP_ID`):
  - Teacher-owned resources live under `artifacts/{APP_ID}/users/{teacherId}/...`.
  - Cross-teacher search uses Firestore `collectionGroup` (e.g., to locate a class by its `uniqueCode`).
- Google integrations:
  - Google Classroom roster + courses via `gapi.client.classroom`.
  - Gmail sending via `gapi.client.gmail.users.messages.send` (BCC selected students).
- Cloud Functions:
  - `processJoinRequest` listens on `joinRequests/{requestId}` and atomically adds student to a class + updates their profile, then deletes the request. Admin-privileged, bypasses rules.

---

## Firestore Data Model

Note: Firestore rules are not in this repo; see Security section for recommendations.

- users/{userId}
  - name: string
  - role: 'Teacher' | 'Student' | ...
  - joinedClasses: Array<{ classId: string, teacherId: string }>
  - lastJoinAttemptStatus?: string

- artifacts/{APP_ID}/users/{teacherId}/subjects/{subjectId}
  - name: string
  - createdAt: Timestamp
  - linkedClassroom: { id: string, name: string } | null

- artifacts/{APP_ID}/users/{teacherId}/classes/{classId}
  - name: string
  - uniqueCode: string (A-Z0-9, 6 chars)
  - linkedSubjectId: string (subjectId)
  - teacherId: string (owner uid)
  - students: string[] (student userIds)
  - isJoinable: boolean
  - createdAt: Timestamp

- artifacts/{APP_ID}/users/{teacherId}/questions/{questionId}
  - subjectId: string
  - questionText: string (can include placeholders like {{var_1}})
  - variables: Array<{ name: string, values: string[] }>
  - formula: string (uses var_X identifiers, supports operators and functions)
  - createdAt: Timestamp

- joinRequests/{requestId}  (used by Cloud Function)
  - userId: string
  - classCode: string (e.g., ABC123)
  - appId: string (APP_ID)

- assignmentRequests/{requestId}
  - teacherId: string
  - appId: string
  - subjectId: string
  - studentEmails: string[]
  - courseName: string
  - status: 'pending' | 'processed' | 'failed'
  - createdAt: Timestamp

- testAssignments/{assignmentId}
  - teacherId: string
  - studentEmail: string
  - courseName: string
  - status: 'Assigned' | 'Graded' | ...
  - assignedAt: Timestamp
  - questions: Array<{ text: string, answer: string, ... }>
  - submittedAnswers?: string[]
  - score?: number  (when graded)

---

## Key Flows

- Teacher
  - Create Subjects: `SubjectList` writes to `subjects` under their namespace.
  - Create Classes: `ClassList` writes to `classes` with server-side `isJoinable` default true; toggled in UI.
  - Build Question Bank: `QuestionBank` filters questions by `subjectId`; `DynamicQuestionForm` extracts variables ({{var_N}}), collects values, and saves `formula`.
  - Google Classroom: `TeacherDashboard` loads gapi + GIS, lists courses, fetches students, links a course to a subject, selects students, sends Gmail messages, and raises `assignmentRequests` for assigning tests.
  - Test Results: `TestResults` queries `testAssignments` by `teacherId` and shows a details modal when graded.

- Student
  - Join by Code: `JoinClass`
    - `collectionGroup` search for `classes` with `uniqueCode`.
    - Respects `isJoinable`.
    - Prevents duplicates using `userProfile.joinedClasses` check.
    - Writes:
      - class doc: `students: arrayUnion(userId)`
      - user doc: `joinedClasses: arrayUnion({ classId, teacherId })`
  - View Joined Classes: `StudentClassList` dereferences each joined class + subject to present names and metadata.

- Cloud Function Join (alternative)
  - Create `joinRequests` doc: `{ userId, classCode, appId }`.
  - `processJoinRequest` finds class via collection group, checks `isJoinable` and duplicates, writes both sides in a transaction, updates `users/{userId}.lastJoinAttemptStatus`, then deletes the request.

---

## APIs and Libraries Used

- Firebase (Web v9 modular)
  - Auth: `getAuth`, `onAuthStateChanged`, `signOut`, `signInWithCustomToken`.
  - Firestore: `getFirestore`, `collection`, `doc`, `addDoc`, `updateDoc`, `deleteDoc`, `getDoc`, `getDocs`, `onSnapshot`, `query`, `where`, `collectionGroup`, `arrayUnion`.
- Firebase Hosting: SPA rewrite to `/index.html`.
- Firebase Cloud Functions (Node 22): Firestore trigger `onCreate` for `joinRequests`.
- Google APIs
  - gapi client with Classroom discovery: `classroom.courses.list`, `classroom.courses.students.list`.
  - Gmail: `gmail.users.messages.send` sending base64url-encoded raw email (BCC).
- Tailwind CSS via CDN in `public/index.html`.

---

## Configuration and Environments

The app can run in two environments:

1) Canvas-embedded (or host page provides globals)
- `__firebase_config`: JSON string of Firebase config.
- `__app_id`: string, used as `APP_ID` namespace.
- `__initial_auth_token`: optional Firebase custom auth token for SSO.

2) Local standalone
- `src/utils/firebaseConfig.js` provides the Firebase config used at runtime.
- `APP_ID` resolves to `firebaseConfig.appId` unless overridden by Canvas.

Important: Firebase client config values (apiKey etc.) are public and safe to expose. Enforce data access via Firestore Security Rules.

---

## Setup (Local Development)

Prerequisites:
- Node.js 18+ (Functions use Node 22 in Cloud; local dev can be Node 18/20/22).
- Firebase CLI installed and logged in.

Install dependencies:

```powershell
# From project root
npm install

# Functions workspace
cd functions; npm install; cd ..
```

Run the app locally:

```powershell
npm start
```

Optional: run functions emulator only (not wired to UI by default):

```powershell
cd functions; npm run serve
```

---

## Deployment

Build and deploy Hosting:

```powershell
npm run build; firebase deploy --only hosting
```

Deploy Cloud Functions:

```powershell
cd functions; npm run deploy
```

Notes:
- `firebase.json` hosts `build/` and rewrites all routes to `/index.html`.
- Functions predeploy runs `npm run lint` in the functions folder.

---

## Google API Setup

To use Classroom and Gmail actions in Teacher dashboard:

- Create a Google Cloud project and OAuth 2.0 Client ID (Web application):
  - Authorized JavaScript origins: your hosting domain(s)
  - Authorized redirect URIs: not required for token client (implicit)
- Enable APIs:
  - Google Classroom API
  - Gmail API
- In `TeacherDashboard.js` set:
  - `GOOGLE_CLIENT_ID` to your OAuth client ID
  - `GOOGLE_API_KEY` to your Google API key (can reuse Firebase Web API key)
- Scopes requested:
  - `classroom.courses.readonly`
  - `classroom.rosters.readonly`
  - `classroom.profile.emails`
  - `gmail.send`

Caution: Gmail scope requires verification for production.

---

## Security Rules (Recommendations)

Rules are not included in the repo; implement to match the data model:

- Only authenticated users can read/write.
- Teachers can read/write under `artifacts/{APP_ID}/users/{teacherId=auth.uid}/...`.
- Students can only update their own user document `users/{auth.uid}` and must not write to other users or teacher artifacts except via controlled operations (e.g., joining only updates `students` array on a class). Consider custom rules:
  - Allow class join if `request.resource.data.diff().changedKeys().hasOnly(['students'])` for class doc, and ensure `isJoinable == true`.
  - Allow user profile update with `joinedClasses` updates on `users/{auth.uid}`.
- Block direct writes to `testAssignments` and `assignmentRequests` unless performed by trusted backend or callable functions.
- Prefer Cloud Functions for cross-document atomicity (as in `processJoinRequest`).

---

## Known Gaps / Future Work

- Assignment processing: `assignmentRequests` are created, but no function is provided to generate and distribute individualized tests and persist `testAssignments`.
- Security Rules: add and test a comprehensive set matching the above recommendations.
- Admin role: scaffolding exists in `App.js` but lacks dedicated views.
- Error handling/UI polish for Google integrations and network failures.
- i18n/accessibility and responsive enhancements.

---

## Conventions & Tips

- Use `APP_ID` consistently for all teacher-owned data: `artifacts/{APP_ID}/users/{userId}/...`.
- Dynamic questions: use `{{var_N}}` placeholders inside `questionText`. The form auto-detects variables and lets you input multiple allowed values per variable. `formula` is a simple string expression using `var_N`; evaluation/execution happens server-side or in future features.
- Class joinability: `isJoinable` controls whether students can self-join by code; toggled in `ClassList`.
- When editing docs programmatically, prefer transactions/`runTransaction` for multi-document updates (see Cloud Function example).

---

## Scripts

Root (CRA app):
- `npm start` – dev server
- `npm run build` – production build
- `npm test` – CRA tests

Functions:
- `npm run serve` – functions emulator
- `npm run deploy` – deploy functions
- `npm run logs` – view logs
- `npm run lint` – ESLint (Google style)

---

## Using this README as the living "brain"

- Any time you add a collection, field, or workflow, update the Data Model and Key Flows sections.
- When adding features that cross-write multiple docs, prefer a Cloud Function and document the request/response shape here.
- Keep the Google API setup values and scopes listed here in sync with the code.
- Add a brief note in Known Gaps when you intentionally defer a piece of functionality.
