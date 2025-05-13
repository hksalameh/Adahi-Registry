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
    *   In the root directory of this project (next to `package.json`), create a new file named `.env.local`.
    *   Copy the content of the `.env.local.example` file (also in the root directory) into your newly created `.env.local` file.
    *   Replace the placeholder values (like `YOUR_API_KEY`) in `.env.local` with the actual values from your Firebase project's `firebaseConfig` object.

    **Example content for `.env.local` (after you fill it with your values):**
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
    *   In the Firebase Console, go to "Authentication" -> "Sign-in method" (or "Build" -> "Authentication" -> "Sign-in method" tab).
    *   Enable the sign-in providers you want to use (e.g., Email/Password).

4.  **Firestore (Database) Setup (If not already done):**
    *   In the Firebase Console, go to "Firestore Database" (or "Build" -> "Firestore Database").
    *   Click "Create database".
    *   Choose "Start in **test mode**" for initial development. **Important:** Remember to set up proper security rules before deploying to production.
    *   Select a location for your database.

5.  **Restart Your Development Server:**
    *   **This is a crucial step!** If your development server (`npm run dev`) is running, stop it (Ctrl+C in the terminal) and then restart it by running `npm run dev` again. This allows Next.js to load the new environment variables from your `.env.local` file.

If you encounter an `auth/invalid-api-key` error or similar Firebase configuration errors, it usually means:
*   The Firebase API key (or other configuration values) in your `.env.local` file are incorrect or missing.
*   The environment variable names in `.env.local` do not start with `NEXT_PUBLIC_`.
*   The development server was not restarted after updating the `.env.local` file.
*   You might have copied the values incorrectly from the Firebase console. Double-check them.
```