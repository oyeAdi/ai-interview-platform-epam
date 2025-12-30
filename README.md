# AI Interview Platform - Premium Edition 🤖💼

A robust, AI-powered interview platform designed for high-integrity technical assessments. This platform features advanced anti-cheating protocols, modular reporting, and state-of-the-art AI evaluation.

## 🚀 Key Features

### 🛡️ Premium Protocol Upgrade (Proctoring & Integrity)
- **Focus Shield**: Advanced browser monitoring to detect tab switching, window blurring, and multi-tab access.
- **One-Strike Policy**: Candidates receive **one warning** upon exiting fullscreen mode. A second violation results in **immediate assessment termination**.
- **Fullscreen Locking**: Force-enforced fullscreen mode to ensure a dedicated assessment environment.
- **Security Audit Logs**: All violations are time-stamped and recorded in the technical report metadata.

### 💾 State Synchronization (Persistence)
- **Checkpoint System**: Incremental saving of interview progress (chat transcript, code, evaluations) ensures data is never lost, even on refresh or network failure.
- **Stable Session Tracking**: Persistent session IDs maintain continuity across the entire interview lifecycle.

### 📊 Advanced Modular Reporting
- **Executive Summaries**: AI-synthesized high-level overview featuring:
  - **Verdict Panel**: Hire/No-Hire recommendations with confidence scores.
  - **Plagiarism Dashboard**: AI analysis of response patterns to detect unethical assistance.
  - **Evaluation Breakdown**: Skill-by-skill performance analysis.
- **Round-Specific Protocols**: Granular markdown reports generated for every round (MCQ, Conceptual, Coding, System Design).

## 🛠️ Technology Stack
- **Frontend**: Next.js 14, Tailwind CSS, Lucide React
- **Backend**: Next.js API Routes, Supabase (PostgreSQL & Storage)
- **AI Engine**: Google Gemini (via `@google/generative-ai`), Hugging Face Inference
- **Infrastructure**: Firebase (Cloud Storage for recordings)

## 🏁 Getting Started

### 1. Installation
```bash
npm install
```

### 2. Environment Setup
Create a `.env` file with the following:
- `GEMINI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FIREBASE_PROJECT_ID`
- (Other required keys for storage and LLMs)

### 3. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the platform in action.

## 📄 License
Internal Product - All Rights Reserved.
