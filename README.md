# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Firebase Setup

This project uses Firebase for authentication and database services. To connect your Firebase project:

1.  **Create a Firebase Project:**
    *   Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project or use an existing one.
    *   In your project settings, add a new Web App (`</>`).
    *   During the app registration, Firebase will provide you with a `firebaseConfig` object. You will need the values from this object.

2.  **Configure Environment Variables:**
    *   In the root directory of this project (next to `package.json`), locate the file named `.env.local.example`.
    *   **Rename or copy** this file to create a new file named `.env.local` in the same directory. If `.env.local` already exists, ensure it has all the necessary variables.
    *   Open your newly created or existing `.env.local` file.
    *   Replace the placeholder values (like `YOUR_API_KEY`, `YOUR_PROJECT_ID`, `YOUR_AUTH_DOMAIN`) in `.env.local` with the actual values from your Firebase project's `firebaseConfig` object. You can find these values in your Firebase project settings under "General" -> "Your apps" -> Select your web app -> "SDK setup and configuration".

    **Example content for `.env.local` (after you fill it with your values):**
    ```env
    NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXX
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1234567890
    NEXT_PUBLIC_FIREBASE_APP_ID=1:1234567890:web:XXXXXXXXXXXXXXXXXXXXXX
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX # Optional, for Analytics
    ```

3.  **Enable Authentication Methods:**
    *   In the Firebase Console, go to "Authentication" -> "Sign-in method" (or "Build" -> "Authentication" -> "Sign-in method" tab).
    *   Enable the sign-in providers you want to use (e.g., Email/Password). This app is configured for Email/Password.

4.  **Firestore (Database) Setup (If not already done):**
    *   In the Firebase Console, go to "Firestore Database" (or "Build" -> "Firestore Database").
    *   Click "Create database".
    *   Choose "Start in **test mode**" for initial development. **Important:** Remember to set up proper security rules before deploying to production.
    *   Select a location for your database.

5.  **Restart Your Development Server:**
    *   **THIS IS A CRUCIAL STEP!** If your development server (`npm run dev --turbopack -p 9002` in Firebase Studio) is running, stop it (Ctrl+C in the terminal window within Firebase Studio).
    *   Then, restart it by running `npm run dev --turbopack -p 9002` again. This allows Next.js to load the new environment variables from your `.env.local` file.

## Troubleshooting Firebase Configuration Errors

If you encounter an `auth/invalid-api-key` error or similar Firebase configuration errors (like "Missing environment variable NEXT_PUBLIC_FIREBASE_API_KEY" or "Missing environment variable NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"), it usually means:
*   The Firebase API key, auth domain, or other configuration values in your `.env.local` file are incorrect, missing, or still placeholders. Ensure all `NEXT_PUBLIC_FIREBASE_...` variables in `.env.local` have correct values from your Firebase project.
*   The environment variable names in `.env.local` do not start with `NEXT_PUBLIC_`. All Firebase environment variables used by the client-side code **must** start with `NEXT_PUBLIC_`.
*   **The development server was not restarted after creating or updating the `.env.local` file.** This is the most common reason. Next.js only loads environment variables from `.env.local` when the server starts. Stop your server (Ctrl+C) and restart it (`npm run dev --turbopack -p 9002`).
*   You might have copied the values incorrectly from the Firebase console. Double-check them meticulously.
*   The `.env.local` file is not in the root directory of the project (i.e., it's not in the same folder as `package.json`).
*   There might be a typo in the variable names within `.env.local` or in how they are accessed in `src/lib/firebase.ts`.

**Specifically for "Missing environment variable NEXT_PUBLIC_FIREBASE_API_KEY" or "Missing environment variable NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN":**
1. Ensure `.env.local` exists in the project root.
2. Ensure it contains the lines `NEXT_PUBLIC_FIREBASE_API_KEY=YourActualApiKey` and `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=YourActualAuthDomain` (replace placeholders with your actual values).
3. **Stop and restart the development server.**
```