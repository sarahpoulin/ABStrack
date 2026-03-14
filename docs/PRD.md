# ABStrack — Product Requirements Document

**Version:** 1.0  
**Author:** Sarah (NSCC SPRINT Scholar)  
**Status:** Draft  
**Last Updated:** March 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Background & Problem Statement](#background--problem-statement)
3. [Goals & Non-Goals](#goals--non-goals)
4. [Users & Roles](#users--roles)
5. [Technical Stack](#technical-stack)
6. [Architecture Overview](#architecture-overview)
7. [Security & Encryption](#security--encryption)
8. [Feature Requirements](#feature-requirements)
   - [Authentication](#1-authentication)
   - [Symptom Presets](#2-symptom-presets)
   - [Health Marker Presets](#3-health-marker-presets)
   - [Episode Logging](#4-episode-logging)
   - [General Wellness Logging](#5-general-wellness-logging)
   - [Food Diary](#6-food-diary)
   - [Caretaker Account](#7-caretaker-account)
   - [Healthcare Practitioner App](#8-healthcare-practitioner-app)
   - [Charts & Graphs](#9-charts--graphs)
   - [Video & Photo Capture](#10-video--photo-capture)
9. [MVP Scope](#mvp-scope)
10. [Post-MVP Roadmap](#post-mvp-roadmap)

---

## Overview

ABStrack is an open-source, privacy-first health tracking application for individuals living with **Auto-Brewery Syndrome (ABS)** — a rare and poorly understood condition in which endogenous ethanol is produced within the body, causing symptoms of intoxication without alcohol consumption. While fermentation of carbohydrates by gastrointestinal yeast or bacteria is the most commonly documented mechanism, ABS presentations vary significantly between individuals: some produce ethanol in the absence of carbohydrate consumption, and in rare cases fermentation has been documented outside the gastrointestinal tract entirely. The underlying mechanisms are not fully understood, triggers differ between patients, and the condition remains underdiagnosed and frequently dismissed by medical professionals.

The application consists of three sub-applications:

| App | Platform | Audience |
|---|---|---|
| User App | Mobile (React Native/Expo) + Web (Next.js) | Patients with ABS and their caretakers |
| Practitioner App | Web (Next.js) | Healthcare practitioners |

---

## Background & Problem Statement

ABS is a poorly understood and frequently misdiagnosed condition. Patients often experience episodes of intoxication-like symptoms — including cognitive impairment, slurred speech, vertigo, nausea, and some with neurological symptoms — without having consumed alcohol.

Documenting these episodes is critical for diagnosis, treatment, and ongoing care. However, existing general-purpose symptom tracking apps are not designed for:

- **Impaired users.** During an ABS episode, a user may be cognitively impaired, bedridden, or unable to type. The UI must be usable by someone who is effectively intoxicated.
- **ABS-specific health markers.** Blood alcohol content (BAC) readings, glucose levels, blood pressure, and other markers are uniquely relevant to ABS management.
- **Evidence capture.** Neurological symptoms or slurred speech are best documented with short video or photo captures.
- **Practitioner visibility.** The ABS community is small and many practitioners are unfamiliar with the condition. Giving practitioners access to longitudinal data with pattern visualization is essential for effective care.
- **Privacy.** Health data of this nature is extremely sensitive. Even the developer should not have access to user health data.

---

## Goals & Non-Goals

### Goals

- Provide a fast, accessible interface for logging ABS episodes, even while cognitively impaired.
- Allow users to define symptom and health marker presets tailored to their individual ABS presentation.
- Support video and photo capture for neurological symptom documentation.
- Enable secure, encrypted data sharing between a user and their chosen healthcare practitioner.
- Provide charts and graphs to help practitioners and users identify patterns over time.
- Support offline use on mobile, with automatic sync when connectivity is restored.
- Be fully open source and self-hostable.

### Non-Goals (for MVP)

- Integration with device APIs (BACtrac, Dexcom G7) — manual entry only for MVP.
- Multi-language support — English only for MVP.
- Push notification to notify caretaker of an episode.
- Publishing to app stores — Expo Go is sufficient for MVP testing.

---

## Users & Roles

### Patient (Primary User)
An individual diagnosed with or suspected of having ABS. May be cognitively impaired during use. Accesses the app via mobile (primary) or web.

### Caretaker
A trusted person (family member, partner, etc.) who assists the patient during episodes. Has a secondary account linked to the patient's account. Sees everything the patient sees and can complete episode logging on the patient's behalf from their own device. Receives push notifications when the patient logs an episode (post-MVP).

### Healthcare Practitioner
A doctor, specialist, or other clinician chosen by the patient. Receives a credential invitation from the patient. Can view the patient's encrypted health data, leave observation notes, and review media. Accesses the practitioner web app only.

---

## Technical Stack

| Layer | Technology |
|---|---|
| Mobile App | React Native + NativeWind (Expo for development) |
| User Web App | Next.js + Tailwind CSS |
| Practitioner Web App | Next.js + Tailwind CSS |
| Database | Supabase (PostgreSQL) |
| Offline Sync | PowerSync |
| Monorepo Tooling | Nx |
| Package Manager | pnpm |
| Shared Packages | `@abstrack/types`, `@abstrack/supabase`, `@abstrack/ui`, `@abstrack/powersync`, `@abstrack/crypto` |
| Media Storage | Supabase Storage |
| CI/CD | GitHub Actions |

**Hosting:** Supabase cloud for development. Self-hosted on Oracle VM (free tier) for production.

---

## Architecture Overview

```
ABStrack/
├── apps/
│   ├── mobile/          # React Native (Expo) — primary user app
│   ├── web/             # Next.js — user web app
│   └── practitioner/    # Next.js — healthcare practitioner app
└── packages/
    ├── types/           # Shared TypeScript types
    ├── supabase/        # Shared Supabase client & helpers
    ├── ui/              # Shared UI components
    ├── powersync/       # PowerSync schema & sync configuration
    └── crypto/          # Client-side AES-256-GCM encrypt/decrypt utilities
```

All three apps share types, the Supabase client, UI components, and encryption utilities from the shared packages.

**Data access differs by platform:**

- **Mobile app:** PowerSync syncs ciphertext from Supabase to a local SQLite database. The app reads from local SQLite, decrypts in memory using the session DEK, and queries in TypeScript. This enables full offline support.
- **Web apps (user + practitioner):** Query the Supabase API directly. Ciphertext is fetched over the network, decrypted in the browser using the session DEK, and queried in TypeScript. No offline support on web.

The `@abstrack/crypto` package is used identically in all three apps — only the data fetch layer differs.

---

## Security & Encryption

Privacy is a first-class requirement. The developer cannot read user health data without the user's password.

### Encryption Approach: Client-Side AES-256-GCM

ABStrack uses **client-side encryption** — all sensitive data is encrypted on the user's device before it is ever sent to the server. The server stores only ciphertext.

This approach is chosen over server-side alternatives (Supabase Vault, pgcrypto, CipherStash) because:

- All queries in ABStrack are **per-user** — there is no need to search or filter encrypted data across multiple users at the database level.
- The client holds the decryption key in memory during the session.
- Per-user datasets are small enough that decrypting in memory and querying in JavaScript/TypeScript is trivially fast (AES is hardware-accelerated on all modern phones and browsers).
- Server-side encryption approaches either give the developer access to keys (Supabase Vault) or add significant architectural complexity (CipherStash proxy) without benefit for this use case.

### Key Management: Key Wrapping

1. At signup, a random 256-bit **Data Encryption Key (DEK)** is generated for the user.
2. A **Key Encryption Key (KEK)** is derived from the user's password using **Argon2id**. (Argon2id is not available in the browser Web Crypto API — it requires the `argon2id` npm package in the browser and `@sphereon/react-native-argon2` on React Native.)
3. The DEK is encrypted ("wrapped") with the KEK and stored in Supabase.
4. On login, the user's password re-derives the KEK, unwraps the DEK, and holds it in memory for the session.
5. All sensitive fields are encrypted/decrypted using the DEK via **AES-256-GCM** with a fresh random IV per encryption operation.

**Password reset:** When a user resets their password via email link, a new KEK is derived from the new password and the DEK is re-wrapped. The underlying data never needs to be re-encrypted.

**Lost access:** If a user loses both their password and access to their reset email, their data is unrecoverable. This must be clearly communicated during onboarding.

### Client-Side Querying

Because the DEK is held in memory during the session, all querying happens client-side:

1. PowerSync syncs **ciphertext** from Supabase to local SQLite on the device.
2. The app fetches rows from local SQLite.
3. The app decrypts sensitive fields in memory using the session DEK.
4. Filtering, grouping, and aggregation for charts and queries happens in TypeScript after decryption.

**Example — symptom frequency chart:**
```typescript
const rows = await powersync.getAll(
  'SELECT symptom_name FROM episode_symptoms WHERE user_id = ?', [userId]
);
const counts = new Map<string, number>();
for (const row of rows) {
  const name = await decryptField(row.symptom_name, dek);
  counts.set(name, (counts.get(name) ?? 0) + 1);
}
```

### Local Database Encryption (Mobile)

On mobile, PowerSync uses **SQLCipher** via `@powersync/op-sqlite` to encrypt the local SQLite database at rest. This provides two layers of encryption on the device:

1. The local SQLite database file is encrypted by SQLCipher.
2. Individual sensitive field values within the database are encrypted with the user's DEK.

### Practitioner Access: Asymmetric Key Exchange

1. At account creation, each practitioner generates an **X25519 key pair**. The private key is wrapped with the practitioner's password (same KEK/DEK pattern as patients). (X25519 is supported in Chrome 133+, Firefox 130+, Safari 17+. On React Native, `react-native-quick-crypto` provides X25519 via native bindings.)
2. When a patient invites a practitioner, the patient's app encrypts the patient's DEK with the **practitioner's public key** and stores this in a `practitioner_access` table.
3. When the practitioner views patient data, their app unwraps their private key, decrypts the patient's DEK, and uses it to decrypt the patient's data in the browser.
4. **Revoking access** is as simple as deleting the row in `practitioner_access` — the practitioner immediately loses the ability to decrypt the patient's data.

### Caretaker Access: Shared DEK

The caretaker has full read and write access to the patient's data, so the caretaker needs the patient's DEK. The key-sharing mechanism mirrors the practitioner pattern:

1. When the patient creates a caretaker account, the patient's app wraps the patient's DEK with a key derived from the caretaker's password (using Argon2id, the same as the patient's own KEK derivation) and stores this in a `caretaker_access` table.
2. On caretaker login, the caretaker's password re-derives the key, unwraps the patient's DEK, and holds it in memory for the session.
3. Because the caretaker shares the same DEK, any data the caretaker encrypts (e.g., logging an episode on the patient's behalf) is readable by the patient and vice versa.
4. **Revoking access** is done by deleting the row in `caretaker_access`. The patient must then re-wrap their DEK for any remaining authorized users (or generate a new DEK and re-encrypt all data if the revocation is adversarial — this is an edge case for post-MVP consideration).

### The `@abstrack/crypto` Package

All encryption and decryption logic lives in the shared `@abstrack/crypto` package, ensuring identical implementation across all three apps. The package abstracts over platform-specific crypto providers:

- **Browser / Next.js:** native `crypto.subtle` (Web Crypto API)
- **React Native:** `react-native-quick-crypto` (provides a native SubtleCrypto implementation — `crypto.subtle` is not available in React Native by default)

```typescript
// packages/crypto/src/encrypt.ts
export async function encryptField(plaintext: string, dek: CryptoKey): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    dek,
    encoded
  );
  const result = new Uint8Array(iv.length + ciphertext.byteLength);
  result.set(iv);
  result.set(new Uint8Array(ciphertext), iv.length);
  return result;
}

export async function decryptField(blob: Uint8Array, dek: CryptoKey): Promise<string> {
  const iv = blob.slice(0, 12);
  const ciphertext = blob.slice(12);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    dek,
    ciphertext
  );
  return new TextDecoder().decode(plaintext);
}
```

### Columns to Encrypt

| Table | Columns to Encrypt |
|---|---|
| `episodes` | `episode_label` |
| `episode_symptoms` | `symptom_name`, `notes` |
| `health_markers` | `marker_name`, `value`, `notes` |
| `food_diary_entries` | `food_note` |
| `preset_symptoms` | `symptom_name` |
| `preset_health_markers` | `marker_name` |
| `practitioner_access` | `wrapped_patient_dek` |

### Columns to Leave Unencrypted (for PowerSync sync and sorting)

| Table | Unencrypted Columns | Reason |
|---|---|---|
| `episodes` | `id`, `user_id`, `timestamp`, `episode_type` (enum: `ABS` \| `Other`), `ended_at` | Needed for sorting, filtering, sync. Custom episode names are stored in the encrypted `episode_label` column. |
| `episode_symptoms` | `id`, `episode_id`, `user_id`, `created_at` | Needed for joins and sync |
| `health_markers` | `id`, `episode_id`, `user_id`, `recorded_at` | Needed for sorting and sync |
| `food_diary_entries` | `id`, `episode_id`, `user_id`, `meal_tag`, `consumed_at` | Needed for timeline correlation |

> **Database Design Note:** Symptoms, health markers, and food diary entries must be stored as **rows, not columns**. Each symptom is a row in `episode_symptoms` with an encrypted `symptom_name` field — not a dedicated column per symptom. This is critical for both privacy and scalability.

### Row Level Security (RLS)

Supabase RLS policies must be enabled on all tables. Policies enforce:

- A user can only read and write their own rows.
- A caretaker can read and write rows belonging to their linked patient.
- A healthcare practitioner can only read rows for patients who have explicitly granted access via `practitioner_access`.

### Media Storage Security

Videos and images are stored in a **private Supabase Storage bucket** (`episode-media`). See Section 10 for full media encryption details.

---

## Feature Requirements

### 1. Authentication

**MVP**

#### Sign-up & Login
- Email/password sign-up and login for patients, caretakers, and practitioners.
- Patients can create a linked caretaker account during onboarding or from settings.
- Practitioner accounts are created via invitation only (patient-initiated).
- Password reset via email link. On reset, the DEK is re-wrapped with a KEK derived from the new password — no data is lost.

#### Session Persistence

ABStrack is an accessibility-first application. Users may need to log symptoms while cognitively impaired, and friction at login must be minimised.

| Role | Default Behaviour | User-Controlled Option |
|---|---|---|
| Patient | Persistent session — stays logged in across app close, device lock, and browser close | Can enable "Require re-authentication on app open" in security settings |
| Caretaker | Persistent session — same as patient | Can enable "Require re-authentication on app open" in security settings |
| Practitioner | Standard session with expiry | N/A |

Persistent sessions are implemented via Supabase Auth refresh tokens stored in device/browser storage.

#### Two-Factor Authentication (TOTP)

TOTP is implemented via Supabase Auth's built-in MFA API. Compatible with any TOTP authenticator app (Google Authenticator, Authy, 1Password, etc.).

| Role | TOTP | Enforcement |
|---|---|---|
| Patient | Optional — can be enabled in security settings | Not enforced |
| Caretaker | Optional — can be enabled in security settings | Not enforced |
| Practitioner | **Mandatory** — must enrol before first login is granted | Enforced via three layers (see below) |

**Practitioner TOTP enforcement** uses three layers working together:

1. **Custom access token hook** (PL/pgSQL function): runs before each token is issued and injects the user's role (e.g., `practitioner`) into the JWT claims.
2. **RLS policies**: practitioner-accessible tables include a policy that checks `auth.jwt() ->> 'aal' = 'aal2'`, meaning the practitioner must have completed MFA verification to access any patient data.
3. **Frontend gating**: the practitioner app checks the user's MFA enrolment status on login and redirects unenrolled practitioners to the TOTP setup flow before granting access to the app.

**For patients and caretakers with TOTP enabled:** TOTP is prompted at initial login only. With persistent sessions (the default), re-opening the app does not prompt for TOTP again unless the session has fully expired or the user has enabled "Require re-authentication on app open."

**For practitioners:** TOTP is required at every new session. This protects practitioners from liability in the event of unauthorised account access.

**Recovery:** Supabase Auth MFA does not support backup codes. Instead, users can enrol up to 10 TOTP factors. Users are encouraged to enrol a second TOTP factor on a separate device or authenticator app as a recovery mechanism in case their primary device is lost.

---

### 2. Symptom Presets

**MVP**

Symptom presets allow the user to pre-configure the symptoms they commonly experience during an ABS episode. During an episode, the app prompts through the preset list rather than requiring the user to type or search.

#### Preset Setup
- The user can create one or more named symptom presets (e.g., "Typical ABS Episode", "Mild Episode").
- Each preset contains an ordered list of symptoms.
- For each symptom, the user can configure:
  - **Symptom name** (free text or selected from common ABS symptoms)
  - **Response type:**
    - Yes/No
    - Severity scale (e.g., 1–5)
    - Free text note
    - **Photo capture** — user is shown an instruction (e.g., "Smile for the camera") and the app captures a photo.
    - **Video capture** — user is shown a prompt (e.g., "Say: 'The early bird catches the worm'") and the app records a short video (max 15 seconds, user can stop early).
- During preset setup, the app informs the user that photo and video capture are available options.
- Presets can be reordered, edited, and deleted from the preset management screen (not during an active episode prompt).

#### Common ABS Symptom Suggestions (pre-populated list)
- Nausea
- Vomiting
- Vertigo
- Dizziness
- Slurred speech *(video capture recommended)*
- Brain fog / confusion
- Fatigue
- Headache
- Mood changes
- Anxiety

#### Uncommon ABS Symptom Suggestions
- Hemiparesis *(photo/video capture recommended)*
- Facial drooping *(photo capture recommended)*
- Feelings of impending doom

---

### 3. Health Marker Presets

**MVP**

Health marker presets allow the user to pre-configure the health measurements they want to capture during or around an episode.

#### Preset Setup
- The user can add health markers to their preset, including:
  - Blood alcohol content (BAC) — manual entry
  - Blood glucose — manual entry
  - Blood pressure (systolic/diastolic) — manual entry
  - Heart rate — manual entry
  - Weight — manual entry
  - Custom marker (free text name + unit)
- For MVP, all health markers are manually entered.

**Post-MVP**
- BACtrac Bluetooth API integration
- Dexcom G7 CGM API integration

---

### 4. Episode Logging

**MVP**

An "episode" or "flare" is a discrete event where the user experiences ABS-related symptoms.

#### Starting an Episode
- A prominent "I'm having an episode" button is available on the home screen.
- The UI during an episode must be designed for impaired users: large text, large touch targets, minimal cognitive load, high contrast.
- The user selects which symptom preset to use.

#### Episode Prompt Flow
1. The app prompts through each symptom in the selected preset, one at a time.
2. For video/photo symptoms, the camera is launched inline with instructions shown on screen.
3. After all preset symptoms, the app prompts through health marker preset items.
4. At the end of the preset prompts, the user is offered the option to **add additional symptoms or health markers** not in their preset (free text entry).
5. The user can flag the episode type:
   - **ABS** (manually, or automatically suggested if BAC reading is above 0.00)
   - **Other** (default)
   - Optionally, the user can add a custom episode label (e.g., "Non-ABS Vomiting Episode"), which is stored in an encrypted `episode_label` column. The `episode_type` itself is a simple unencrypted enum (`ABS` | `Other`) to allow sorting and filtering without decryption.
6. The user can optionally add a note to the episode.
7. The episode is saved with a timestamp.

#### Ending an Episode
- The user can mark an episode as ended, which records the end timestamp and duration.

---

### 5. General Wellness Logging

**MVP**

When not in an active episode, the user can:

- Log a **"How are you feeling"** entry with a mood/wellness rating and optional notes.
- Capture health markers at any time using their preset.
- Add ad-hoc symptoms without starting a full episode.

---

### 6. Food Diary

**MVP**

Food intake is a significant trigger factor for ABS episodes. The food diary allows the user to log meals and snacks at any time, particularly during or around episodes.

Accessibility is the primary design concern for the food diary. Users may be unwell during logging, so the interface must be low-friction. Careful per-item nutritional logging is not appropriate for this user base.

- The user can add a food diary entry at any time from the home screen.
- During an episode prompt flow, a food diary prompt is included at the end.
- Each entry includes:
  - A **free text note** describing what was eaten (e.g. "Ate 6 slices of bacon and 4 eggs for breakfast. Coffee. Skipped lunch and supper, then had an episode.")
  - A **meal tag** (single tap): Breakfast / Lunch / Dinner / Snack / Other
  - Time of entry (defaults to now, editable)
- Food diary entries are associated with an episode if logged during one, or stored as standalone entries otherwise.
- The free text note is encrypted using the user's DEK via `@abstrack/crypto`.

**Post-MVP**
- AI-assisted parsing of food diary notes into structured nutritional data (foods, quantities, carbohydrate content) for improved pattern analysis in charts and graphs. The AI parsing happens after the fact — the user never has to do careful per-item logging.

---

### 7. Caretaker Account

**MVP**

- A patient can create a caretaker account from their settings.
- The caretaker logs in with their own credentials on their own device.
- The caretaker has full read and write access to the patient's data — they can complete episode logging on the patient's behalf.
- The caretaker sees the same home screen and prompt flows as the patient.
- One patient can have one caretaker account for MVP (multiple caretakers post-MVP).

**Post-MVP**
- Push notification to the caretaker when the patient starts or completes an episode log.

---

### 8. Healthcare Practitioner App

**MVP**

The practitioner app is a separate web application accessible only via invitation.

#### Access & Invitation
- The patient initiates practitioner access from their settings by entering the practitioner's email address.
- The practitioner receives an email invitation to create an account.
- The practitioner can only see data for patients who have invited them.
- The patient can revoke practitioner access at any time. Revocation immediately invalidates the practitioner's ability to decrypt the patient's data.

#### Practitioner Features
- View a patient's full episode history, symptom logs, health markers, and food diary.
- View charts and graphs of patient data (see section 9).
- Review videos and photos captured during episodes.
- Leave **observation notes** on individual episodes or on the overall patient record.
- Receive an in-app notification when the patient shares a specific chart with notes (see section 9).

#### Practitioner Permissions
- Read access to all patient health data (decrypted client-side via X25519 key exchange — see Security section).
- Write access to observation notes only.
- No ability to modify or delete patient data.

---

### 9. Charts & Graphs

**MVP**

Both the user app and the practitioner app display data visualizations to help identify patterns. All charts are built from client-side decrypted data — no server-side aggregation of encrypted fields.

#### Available Charts
- **Episode frequency** over time (daily/weekly/monthly)
- **BAC readings** over time (line chart)
- **Blood glucose** over time (line chart)
- **Symptom frequency** — which symptoms appear most often
- **Episode type breakdown** — ABS vs. Other (pie/donut chart)
- **Food diary correlation** — episodes mapped alongside food entries on a timeline

#### Sharing (User → Practitioner)
- The user can share a specific chart with applied filters to their practitioner, along with written observation notes.
- The practitioner receives an in-app notification of the shared chart.

---

### 10. Video & Photo Capture

**MVP**

#### Recording
- Short video and photo capture is available within the episode prompt flow, as configured in the symptom preset.
- Maximum video duration is **15 seconds**. The user can stop recording early at any time.
- After recording, the user is shown an **immediate playback preview** and given the option to **re-record** before saving.
- Photos are captured as single frames.

#### Encryption
- All media is encrypted client-side using the user's DEK via `@abstrack/crypto` before upload — the same AES-256-GCM approach used for text fields.
- Even with full storage admin access, media files are unreadable without the user's key.
- A small encrypted **thumbnail** is generated and encrypted client-side alongside the full media, for display in episode grids without downloading the full file.
- The `.enc` file extension is used for all encrypted media files in storage.

#### Storage
- Media is stored in a **private Supabase Storage bucket** (`episode-media`).
- Access is controlled via RLS policies on `storage.objects` — only the owning user, their caretaker, and their authorized practitioner can request files.
- **Time-limited signed URLs** (60 seconds) authorize downloading the encrypted blob, which is then decrypted client-side for viewing.
- The Supabase Storage SDK is the only storage interface the app talks to — the underlying backend is swappable via environment variables with no app code changes.

| Phase | Storage Backend | Notes |
|---|---|---|
| Development | Supabase Cloud Storage (1GB free) | Sufficient for dev with compressed ~2-5MB videos |
| Production | Self-hosted S3-compatible backend (RustFS or SeaweedFS on Oracle VM) | Swap via env vars only |

> **Note:** MinIO Community was archived in February 2026. RustFS (Rust-based, ~2GB RAM) and SeaweedFS (Go-based, ~512MB RAM) are the recommended self-hosted S3-compatible replacements. SeaweedFS is preferred for Oracle VM free tier due to its lower memory footprint.

#### Playback
- To view media: download encrypted blob → decrypt in app using session DEK → create object URL → display in `<video>` or `<img>` tag.
- For 15-second compressed videos (~2-5MB), the download-decrypt-display cycle is under one second on any modern device. No streaming required.
- The user sees a brief loading indicator, then the media plays.

#### Offline Media Capture
PowerSync syncs database rows only — not files. A separate offline upload queue handles media:

1. User captures video while offline.
2. App encrypts the video immediately with the session DEK (happens locally on device).
3. The encrypted blob is saved to local device storage (app cache directory).
4. A metadata row is written to local SQLite via PowerSync: `{ episode_id, file_path, media_type, encryption_iv, uploaded: false }`.
5. PowerSync syncs the metadata row to Supabase when connectivity is restored.
6. A background upload queue detects `uploaded: false` rows, uploads the encrypted blobs to Supabase Storage, then sets `uploaded: true`.

Practitioner access to media uses the same X25519 key exchange described in the Security section — once the practitioner has the patient's DEK, they can decrypt both health data and media. No separate mechanism is needed.

**Post-MVP**
- Multiple media captures per symptom prompt.

---

## MVP Scope

The following features are in scope for the two-month internship MVP:

| Feature | Status |
|---|---|
| Authentication (patient, caretaker, practitioner) with TOTP | MVP |
| Symptom preset setup | MVP |
| Health marker preset setup | MVP |
| Episode logging with prompt flow | MVP |
| General wellness logging | MVP |
| Food diary (free text + meal tag) | MVP |
| Video & photo capture with client-side encryption | MVP |
| Caretaker account | MVP |
| Healthcare practitioner app (view data, notes, media) | MVP |
| Charts & graphs (client-side decrypted) | MVP |
| Offline support via PowerSync + SQLCipher (mobile) | MVP |

---

## Post-MVP Roadmap

| Feature | Priority |
|---|---|
| Caretaker push notification on episode logged | High |
| BACtrac Bluetooth API integration | High |
| Dexcom G7 CGM API integration | High |
| AI-assisted food diary parsing (structured nutritional data from free text) | High |
| Self-hosted Supabase + SeaweedFS on Oracle VM | High (production) |
| Native app store publishing (iOS & Android) | High (production) |
| Multiple caretakers per patient | Medium |
| Practitioner-initiated data request | Medium |
| Export data to PDF (for medical appointments) | Medium |
| Multi-language support | Low |