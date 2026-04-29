# OTS Frontend (`ots-frontend`)

This repository contains the web-based User Interface for the **Original Tale Studio (OTS)** translation platform. It serves as the primary gateway for clients to create translation orders, upload documents, and track their pipeline status. 

The frontend relies heavily on modern UI principles, utilizing a custom paper-themed aesthetic (`bg-paper`, `text-ink`, `gold` accents) aligned with the literary context of the company.

## Tech Stack

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
- **Language**: TypeScript and React 18
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) with custom design tokens.
- **Authentication**: GCP Identity Platform / [Firebase Auth](https://firebase.google.com/docs/auth) (Email/Password & Google OAuth).
- **Internationalization (i18n)**: [`next-intl`](https://next-intl-docs.vercel.app/) with path-based locale routing (e.g., `/[locale]/login`).
- **Data Fetching**: [SWR](https://swr.vercel.app/) for fast, reactive client-side data fetching from the `ots-api` backend.
- **Date Formatting**: `dayjs`
- **Class Utilities**: `clsx`

## Directory Structure

*   `src/app/[locale]/`: The core Next.js App Router structure. The `[locale]` directory enables seamless internationalization out of the box.
*   `src/lib/`: Core library files, including Firebase/GCP Identity configuration (`firebase.ts`).
*   `messages/`: JSON files containing the translation strings for `next-intl` (e.g., `en.json`, `zh.json`).
*   `public/`: Static assets such as images or fonts.

## Local Development

### Prerequisites
Make sure you have Node.js (v20+) and npm installed.

### Setup
1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Environment Variables:**
   Create a `.env.local` file in the root of the frontend directory. You'll need the Firebase configuration variables to run the local server properly:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY="your_api_key"
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your_auth_domain"
   NEXT_PUBLIC_FIREBASE_PROJECT_ID="ots-translation"
   # ... other Firebase config variables
   ```

3. **Start the Development Server:**
   ```bash
   npm run dev
   ```
   The application will be available at [http://localhost:3000](http://localhost:3000).

## Available Scripts

- `npm run dev`: Starts the Next.js development server with Fast Refresh.
- `npm run build`: Builds the application for production usage.
- `npm run start`: Starts the production server (requires `npm run build` to be run first).
- `npm run lint`: Runs ESLint to catch potential code quality issues.

## Authentication Architecture

This frontend interfaces directly with **GCP Identity Platform (via the Firebase SDK)** to provide centralized Single Sign-On (SSO). This SSO token is used securely to communicate with the `ots-api` backend services, as well as providing future interoperability with other OTS services (e.g., Thinkific, WooCommerce, Open edX).
