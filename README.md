# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Firebase Setup

This project uses Firebase for authentication and database services. To connect your Firebase project:

1.  **Create a Firebase Project:**
    *   Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project or use an existing one.
    *   In your project settings, add a new Web App (`</>`).
    *   Copy the `firebaseConfig` object values provided during the app registration.

2.  **Configure Environment Variables:**
    *   Create a file named `.env.local` in the root directory of this project (next to `package.json`).
    *   Copy the content of `.env.local.example` into `.env.local`.
    *   Replace the placeholder values (like `YOUR_API_KEY`) in `.env.local` with the actual values from your Firebase project's `firebaseConfig`.

    Example content for `.env.local`:
    ```env
    NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXX
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1234567890
    NEXT_PUBLIC_FIREBASE_APP_ID=1:1234567890:web:XXXXXXXXXXXXXXXXXXXXXX
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
    ```

3.  **Enable Authentication Methods:**
    *   In the Firebase Console, go to "Authentication" -> "Sign-in method".
    *   Enable the sign-in providers you want to use (e.g., Email/Password).

4.  **Firestore (Database) Setup (If not already done by the template):**
    *   In the Firebase Console, go to "Firestore Database".
    *   Click "Create database".
    *   Choose "Start in **test mode**" for initial development (be sure to set up proper security rules before production).
    *   Select a location for your database.

5.  **Restart Your Development Server:**
    *   If your development server (`npm run dev`) is running, stop it (Ctrl+C) and restart it to load the new environment variables.

If you encounter an `auth/invalid-api-key` error, it means the Firebase API key (or other configuration values) in your `.env.local` file are incorrect or missing, or the development server was not restarted after updating the file.
