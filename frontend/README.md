# LandGuard Frontend

This is the frontend for the LandGuard platform, built with Next.js 14, Material UI, and integrates with the LandGuard Backend API.

## Table of Contents

-   [Features](#features)
-   [Tech Stack](#tech-stack)
-   [Prerequisites](#prerequisites)
-   [Setup](#setup)
    -   [Clone Repository](#clone-repository)
    -   [Install Dependencies](#install-dependencies)
    -   [Environment Variables (`.env.local`)](#environment-variables-envlocal)
    -   [Firebase Configuration](#firebase-configuration)
-   [Running Locally](#running-locally)
-   [Deployment](#deployment)
-   [Project Structure](#project-structure)

## Features

*   **User Authentication:** Secure sign-up/sign-in using Firebase Authentication.
*   **Document Upload:** Interface to upload PDF and image land documents.
*   **Real-time Analysis Progress:** Displays live updates of document analysis using Server-Sent Events (SSE).
*   **Analysis Report Viewer:** Presents detailed analysis reports including risk scores, legal findings, fraud detections, and verification checklists.
*   **Responsive UI:** Built with Material UI (MUI) for a consistent and responsive user experience.
*   **Document Viewer:** Integrates `react-pdf` for displaying uploaded PDF documents directly in the browser.
*   **Ownership Chain Visualization:** (Planned, will use `reactflow`)

## Tech Stack

*   **Framework:** Next.js 14 (App Router)
*   **Language:** TypeScript
*   **UI Library:** Material UI (MUI) v5
*   **Styling:** Emotion (integrated with MUI)
*   **PDF Viewer:** `react-pdf`
*   **State Management:** React Context API or Zustand (TBD)
*   **Authentication:** Firebase Client SDK
*   **Data Fetching:** Native `fetch` or React Query (TBD)

## Prerequisites

*   Node.js (LTS version recommended)
*   npm or yarn

## Setup

### Clone Repository

```bash
git clone YOUR_REPOSITORY_URL_HERE
cd land-guard/frontend
```

### Install Dependencies

```bash
npm install
# or
yarn install
```

### Environment Variables (`.env.local`)

Create a `.env.local` file in the `frontend/` directory by copying `.env.local.example`.

```bash
cp .env.local.example .env.local
```

Now, edit the `.env.local` file with your specific configurations:

```ini
# Backend API URL (adjust if your backend is not on localhost:8000)
NEXT_PUBLIC_BACKEND_API_URL=http://localhost:8000/api/v1

# Firebase Configuration for Frontend (from your Firebase Project settings)
NEXT_PUBLIC_FIREBASE_API_KEY="AIzaSyC..."
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your-project-id.appspot.com"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="1234567890"
NEXT_PUBLIC_FIREBASE_APP_ID="1:1234567890:web:abcdef12345"
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="G-ABCDEFG123"
```
**Important:** Ensure these Firebase credentials match your Firebase project settings. These are public keys and are safe to include in your frontend build.

### Firebase Configuration

The frontend will interact with Firebase Authentication directly. Ensure your Firebase project is properly set up and its web app configuration is used in `.env.local`.

## Running Locally

To run the Next.js development server:

```bash
npm run dev
# or
yarn dev
```

Open `http://localhost:3000` in your browser to see the application.

## Deployment

The frontend is a Next.js application, suitable for deployment on platforms like Vercel, Netlify, or Google Cloud Run (as a static site or server-side rendered application).
A `Dockerfile` (to be created) will facilitate deployment on Cloud Run.

## Project Structure

```
frontend/
├── app/                            # Next.js App Router
│   ├── (main)/                     # Group for authenticated routes (e.g., dashboard, document view)
│   │   ├── dashboard/              # Dashboard page
│   │   ├── documents/[id]/         # Dynamic route for individual document analysis
│   │   └── layout.tsx              # Layout for authenticated sections
│   ├── api/                        # Next.js API routes (if needed for server-side logic)
│   └── page.tsx                    # Root landing page (e.g., login/marketing)
├── components/
│   ├── ui/                         # Reusable, generic UI components (e.g., Button, Modal)
│   ├── dashboard/                  # Components specific to the dashboard view
│   └── analysis/                   # Components for document analysis display (viewer, report)
├── hooks/                          # Custom React hooks (e.g., useAuth, useSSE)
├── lib/                            # Utility functions, API clients, Firebase init
├── styles/                         # Global styles, Material UI theme configuration
├── public/                         # Static assets (images, fonts, favicons)
├── package.json                    # Node.js dependencies and scripts
├── tsconfig.json                   # TypeScript configuration
├── next.config.mjs                 # Next.js configuration
├── .env.local.example              # Example local environment variables
└── README.md                       # This README file
```
