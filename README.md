# Current Solutions AI Dashboard

An intelligent dashboard for a small electric retail shop to track sales, manage inventory, and get AI-powered predictions and insights using Google's Gemini API and Supabase.

## Project Setup Guide

This project requires you to place your secret API keys in a single configuration file.

### Part 1: API Key Setup

1.  **Locate the `env.ts` file:**
    *   In the root directory of your project, find and open the file named `env.ts`.

2.  **Add Your Credentials:**
    *   This file contains placeholders for your Supabase and Gemini API keys. You will need to replace the placeholder values with your actual keys, which you will acquire in the following steps.

    ```typescript
    // env.ts

    // ...
    export const SUPABASE_URL = 'YOUR_SUPABASE_URL_HERE';
    export const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY_HERE';

    // ...
    export const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY_HERE';
    ```

    **Important:** This file is included in your project's code. For better security in a production application, it's recommended to use environment variables. However, for simplicity in this setup, we will edit this file directly.

### Part 2: Supabase Project Setup

1.  **Create a Supabase Project:**
    *   Go to [supabase.com](https://supabase.com/) and create a new project.
    *   Navigate to your project settings (Gear icon > API).
    *   Find your **Project URL** and **anon public key**.
    *   Open your `env.ts` file and paste these values into the `SUPABASE_URL` and `SUPABASE_ANON_KEY` variables.

2.  **Run the Database Schema Script:**
    *   In your Supabase project dashboard, navigate to the **SQL Editor**.
    *   Click **+ New query**.
    *   Create the `inventory` and `sales` tables. You can use the `supabase/schema.sql` file in this repository as a reference for the table structure.
    *   Run the script to create the required tables and security policies.

### Part 3: Google Authentication Setup

This section connects your app, Google, and Supabase to enable sign-in.

1.  **Go to Google Cloud Console:**
    *   Navigate to the [Credentials page](https://console.cloud.google.com/apis/credentials). Ensure you have a project selected.

2.  **Create OAuth 2.0 Client ID:**
    *   Click **+ CREATE CREDENTIALS** and select **OAuth client ID**.
    *   **Application type**: Select **Web application**.
    *   **Name**: Give it a descriptive name (e.g., "Current Solutions App").

3.  **Configure Authorized Redirect URI (For Supabase):**
    *   Under **Authorized redirect URIs**, click **+ ADD URI**.
    *   Enter your Supabase project's callback URL. Replace `<YOUR_PROJECT_ID>` with your actual Supabase project ID (found in your Supabase project URL):
        ```
        https://<YOUR_PROJECT_ID>.supabase.co/auth/v1/callback
        ```

4.  **Save and Get Credentials:**
    *   Click **CREATE**. A modal will appear with your **Client ID** and **Client Secret**. Copy both.

5.  **Configure Google Provider in Supabase:**
    *   Go to your Supabase Dashboard -> **Authentication** -> **Providers**.
    *   Find and expand the **Google** provider.
    *   Toggle the switch to **Enable Google provider**.
    *   Paste the **Client ID** and **Client Secret** you just copied from Google Cloud.
    *   Click **Save**.

### Part 4: Gemini API Key Setup

1.  **Get your API Key:**
    *   Visit the [Google AI Studio](https://aistudio.google.com/app/apikey) to generate an API key.

2.  **Add Key to `env.ts`:**
    *   Open your `env.ts` file and paste your new key as the value for the `GEMINI_API_KEY` variable.

After completing these steps, you must **restart your development server** for the changes in `env.ts` to take effect.

---

## Deployment to Vercel

### Step 1: Push to GitHub

*   Create a repository on [GitHub](https://github.com) and push your project code to it.

### Step 2: Deploy with Vercel

1.  **Sign up:** Go to [vercel.com](https://vercel.com) and sign up with your GitHub account.
2.  **Import Project:** From your Vercel dashboard, import your project's GitHub repository.
3.  **Important:** Vercel will automatically build and deploy your site. Since your API keys are in the `env.ts` file, you do **not** need to configure environment variables on Vercel for this specific project structure.
4.  Wait for the deployment to finish. Vercel will give you a public URL (e.g., `https://your-project-name.vercel.app`).

### Step 3: Post-Deployment Configuration (CRUCIAL LOGIN FIX)

Google Sign-In will **fail** on your new live Vercel URL until you whitelist it in both Supabase and Google Cloud. This is the most common reason for login problems.

1.  **Update Supabase URL Configuration:**
    *   Go to your Supabase dashboard -> **Authentication** -> **URL Configuration**.
    *   In the **Site URL** field, enter your new public Vercel URL (e.g., `https://your-project-name.vercel.app`).
    *   Under **Redirect URLs**, you must add **ALL** the URLs where you will use your app. Add each URL on a new line. **This is critical for both your live site and local testing to work.**
        ```
        https://your-project-name.vercel.app
        http://localhost:5173
        ```
        *(If you use other local ports, like 3000, add them here too)*.
    *   Click **Save**.

2.  **Update Google Cloud Authorized Origins:**
    *   Go back to your [Google Cloud Credentials page](https://console.cloud.google.com/apis/credentials).
    *   Find and **Edit** the OAuth Client ID you created earlier.
    *   Under **Authorized JavaScript origins**, click **+ ADD URI**.
    *   You must add **ALL** the same base URLs here.
        *   Add your Vercel URL (e.g., `https://your-project-name.vercel.app`).
        *   Add your local development URL (e.g., `http://localhost:5173`).
    *   Click **Save**.

Your application is now fully configured and deployed. The login process should now work correctly on both your live Vercel URL and your local machine.