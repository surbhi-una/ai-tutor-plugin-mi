# StudyVoice

Voice-powered AI tutoring that connects to your Canvas LMS courses. Talk to an AI tutor about your course material in real time.

## Features

- **Canvas LMS Integration** – Connect with your Canvas account, browse courses and modules, select content to study
- **Voice AI** – Real-time voice conversation with VAPI or Speechmatics
- **Multi-format support** – Pages, Assignments, Discussions, Quizzes, Files (PPTX, text)
- **Chrome Extension** – Study directly from Canvas course pages

## Tech Stack

- Next.js 15, React 19
- Convex (backend, real-time)
- VAPI + Speechmatics (voice)
- Tailwind CSS, Shadcn UI

## Getting Started

### Prerequisites

- Node.js 18+
- Convex account
- Canvas LMS personal access token

### Setup

1. Clone and install:

```bash
npm install
```

2. Set up Convex:

```bash
npx convex dev
```

3. Configure environment variables (see `.env.local.example`)

4. Run the dev server:

```bash
npm run dev
```

### Canvas Token

Generate a personal access token from Canvas: **Settings → Approved Integrations → + New Access Token**

## Chrome Extension

The `extension/` folder contains a Chrome extension that injects a floating button on Canvas course pages. Configure `APP_URL` and `CONVEX_HTTP_URL` in `background.js` and `sidepanel.html` after deploying.

## License

MIT
