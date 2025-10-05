# Current Solutions AI Dashboard

An intelligent dashboard for a small electric retail shop to track sales, manage inventory, and get AI-powered predictions and insights using Google's Gemini API and Supabase.

## Project Setup Guide

Follow these steps carefully to get the application running.

### Part 1: Supabase Project Setup

1.  **Create a Supabase Project:**
    *   Go to [supabase.com](https://supabase.com/) and create a new project.
    *   Save your **Project URL** and **anon public key**. You will need them soon.

2.  **Run the Database Schema Script:**
    *   In your Supabase project dashboard, navigate to the **SQL Editor**.
    *   Click **+ New query**.
    *   Copy the entire contents of the `supabase/schema.sql` file from this project.
    *   Paste the SQL content into the editor and click the **RUN** button. This will create the `inventory` and `sales` tables and enable Row Level Security policies.

3.  **Configure Application Keys:**
    *   Open the `config.ts` file in this project.
    *   Replace the placeholder values for `SUPABASE_URL` and `SUPABASE_ANON_KEY` with the ones from your project.

### Part 2: Google Authentication Setup

This is the most critical part for making login work. It involves configuring credentials in Google Cloud and then adding them to your Supabase project. The error `{"code":400,"error_code":"validation_failed","msg":"Unsupported provider: missing OAuth secret"}` is a direct result of not completing these steps.

#### A. Create Google OAuth Credentials

1.  **Go to Google Cloud Console:**
    *   Navigate to the [Credentials page](https://console.cloud.google.com/apis/credentials). Ensure you have a project selected.

2.  **Create OAuth 2.0 Client ID:**
    *   Click **+ CREATE CREDENTIALS** at the top and select **OAuth client ID**.
    *   For **Application type**, select **Web application**.
    *   Give it a descriptive name (e.g., "Current Solutions App").

3.  **Configure Authorized Origins and URIs:**
    *   Under **Authorized JavaScript origins**, click **+ ADD URI** and enter the following URL:
        ```
        https://aistudio.google.com
        ```
    *   Under **Authorized redirect URIs**, click **+ ADD URI** and enter your Supabase project's callback URL. It will look like this (replace `<YOUR_PROJECT_ID>` with your actual Supabase project ID):
        ```
        https://<YOUR_PROJECT_ID>.supabase.co/auth/v1/callback
        ```

4.  **Save and Get Credentials:**
    *   Click **CREATE**. A modal will appear with your **Client ID** and **Client Secret**.
    *   **Important:** Copy both the **Client ID** and the **Client Secret**. You will need them in the next steps.

#### B. Configure Google Provider in Supabase

1.  **Go to your Supabase Dashboard:**
    *   Navigate to your project.
    *   In the left sidebar, click the **Authentication** icon.
    *   Go to the **Providers** section.

2.  **Enable and Configure Google:**
    *   Find **Google** in the list of providers and click on it to expand.
    *   Toggle the switch to **Enable Google provider**.
    *   Paste the **Client ID** from the previous step into the `Client ID` field.
    *   Paste the **Client Secret** from the previous step into the `Client secret` field.
    *   Click **Save**.

#### C. Update Application Code

1.  **Update App Config:**
    *   Open the `config.ts` file in this project.
    *   Paste your Google **Client ID** as the value for `GOOGLE_CLIENT_ID`. The Client Secret should **NOT** be placed here.

### Part 3: Gemini API Key Setup

The AI features (Sales Forecast and Inventory Analysis) require a Google Gemini API key.

1.  **Get your API Key:**
    *   Visit the [Google AI Studio](https://aistudio.google.com/app/apikey) to generate an API key.

2.  **Configure Application Key:**
    *   Open the `config.ts` file in this project.
    *   Find the `GEMINI_API_KEY` constant.
    *   Replace the placeholder value with your own Gemini API key.

**Note on Security:** Storing the API key directly in the client-side code is simple for development but is not a secure practice for production applications, as it can be exposed to end-users. For a production environment, it is highly recommended to proxy API calls through a secure backend (like a Supabase Edge Function) where the key can be stored safely.