# Current Solutions AI Dashboard

An intelligent dashboard for a small electric retail shop to track sales, manage inventory, and get AI-powered predictions and insights using Google's Gemini API and Supabase.

## Project Setup Guide

This project uses [Vite](https://vitejs.dev/) for its development environment, which handles API keys and secrets through environment variables.

### Part 1: Environment Variable Setup

All secret keys for the application are managed in a local environment file that you must create.

1.  **Create a `.env.local` file:**
    *   In the root directory of your project, create a new file named `.env.local`. This file is listed in `.gitignore` and will not be committed to your repository, keeping your keys safe.

2.  **Add Your Credentials:**
    *   Open the new `.env.local` file and paste the following content into it. You will acquire the actual values for these keys in the following steps.

    ```env
    VITE_SUPABASE_URL="YOUR_SUPABASE_URL_HERE"
    VITE_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY_HERE"
    VITE_GEMINI_API_KEY="YOUR_GEMINI_API_KEY_HERE"
    ```

    **Important:** In Vite, only variables prefixed with `VITE_` are exposed to the client-side code. Do not change these variable names.

### Part 2: Supabase Project Setup

1.  **Create a Supabase Project:**
    *   Go to [supabase.com](https://supabase.com/) and create a new project.
    *   Navigate to your project settings (Gear icon > API).
    *   Find your **Project URL** and **anon public key**.
    *   Open your `.env.local` file and paste these values for `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` respectively.

2.  **Run the Database Schema Script:**
    *   In your Supabase project dashboard, navigate to the **SQL Editor**.
    *   Click **+ New query**.
    *   Find the `supabase/schema.sql` file in this project repository (if it exists) or create the necessary tables (`inventory`, `sales`).
    *   This will create the required tables and security policies.

### Part 3: Google Authentication Setup

This is the most critical part for making login work. It connects your app, Google, and Supabase.

1.  **Go to Google Cloud Console:**
    *   Navigate to the [Credentials page](https://console.cloud.google.com/apis/credentials). Ensure you have a project selected.

2.  **Create OAuth 2.0 Client ID:**
    *   Click **+ CREATE CREDENTIALS** and select **OAuth client ID**.
    *   **Application type**: Select **Web application**.
    *   **Name**: Give it a descriptive name (e.g., "Current Solutions App").

3.  **Configure Authorized Redirect URI:**
    *   Under **Authorized redirect URIs**, click **+ ADD URI**.
    *   Enter your Supabase project's callback URL. Replace `<YOUR_PROJECT_ID>` with your actual Supabase project ID (found in your Supabase project settings):
        ```
        https://<YOUR_PROJECT_ID>.supabase.co/auth/v1/callback
        ```

4.  **Save and Get Credentials:**
    *   Click **CREATE**. A modal will appear with your **Client ID** and **Client Secret**.
    *   **Important:** Copy both the **Client ID** and the **Client Secret**.

5.  **Configure Google Provider in Supabase:**
    *   Go to your Supabase Dashboard -> **Authentication** -> **Providers**.
    *   Find and expand the **Google** provider.
    *   Toggle the switch to **Enable Google provider**.
    *   Paste the **Client ID** and **Client Secret** you just copied from Google Cloud.
    *   Click **Save**.

### Part 4: Gemini API Key Setup

1.  **Get your API Key:**
    *   Visit the [Google AI Studio](https://aistudio.google.com/app/apikey) to generate an API key.

2.  **Add Key to Environment File:**
    *   Open your `.env.local` file.
    *   Paste your new key as the value for `VITE_GEMINI_API_KEY`.

After completing these steps, you must **restart your development server** for the changes in `.env.local` to take effect.

---

## Deployment (Permanent Solution)

To get a public URL that works anywhere, you can deploy your application to a hosting service like Vercel or Netlify.

### Step 1: Push to GitHub

*   Create a repository on [GitHub](https://github.com) and push your project code to it. Ensure your `.env.local` file is listed in `.gitignore` so your keys are not exposed.

### Step 2: Deploy with Vercel

1.  **Sign up:** Go to [vercel.com](https://vercel.com) and sign up with your GitHub account.
2.  **Import Project:** From your Vercel dashboard, click "Add New..." -> "Project", and import your project's GitHub repository.
3.  **Configure Environment Variables:** Before deploying, go to the project's **Settings** tab and find **Environment Variables**. You must add the same variables from your `.env.local` file here.
    *   `VITE_SUPABASE_URL`
    *   `VITE_SUPABASE_ANON_KEY`
    *   `VITE_GEMINI_API_KEY`
4.  **Deploy:** Go back to the deployments tab and trigger a new deployment. Vercel will build and deploy your site using the environment variables you just set.

### Step 3: Post-Deployment Configuration (CRUCIAL)

Google Sign-In will **not** work on your new public URL until you complete these final steps.

1.  **Update Google Cloud Authorized Origins:**
    *   Go back to your [Google Cloud Credentials page](https://console.cloud.google.com/apis/credentials).
    *   Edit the OAuth Client ID you created earlier.
    *   Under **Authorized JavaScript origins**, click **+ ADD URI**.
    *   Enter your new public Vercel URL (e.g., `https://your-project-name.vercel.app`).
    *   **Also add `http://localhost:3000`** to this list if you want to continue testing on your local machine.
    *   Click **Save**.

2.  **Update Supabase Site URL:**
    *   Go to your Supabase dashboard -> **Authentication** -> **URL Configuration**.
    *   In the **Site URL** field, replace the default `localhost` URL with your new public Vercel URL.
    *   Click **Save**.

Your application is now fully configured and deployed. The public URL will work for you and any other users you share it with.