import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { InsightsIcon, GoogleIcon } from './Icons';

const LoginScreen: React.FC = () => {
    const [error, setError] = useState<string | null>(null);
    const [isSigningIn, setIsSigningIn] = useState(false);

    const handleLogin = async () => {
        setIsSigningIn(true);
        setError(null);
        
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                // This line is critical for login to work correctly.
                // It tells Google to redirect the user back to the URL where they started the login process.
                // For this to work, you MUST add this URL to the allow-list in your Supabase and Google Cloud settings.
                // Refer to the 'Post-Deployment Configuration' section in the README.md for detailed instructions.
                // Example URLs to add:
                // - For local testing: http://localhost:5173
                // - For your live site: https://your-project-name.vercel.app
                redirectTo: window.location.origin,
            },
        });

        if (error) {
            setError(`Failed to sign in: ${error.message}`);
            setIsSigningIn(false);
        }
        // On success, the user is redirected to Google, and then back to the app.
        // The AuthContext's onAuthStateChange listener will handle the session upon return.
    };

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-background via-slate-900 to-indigo-900/50 p-4">
            <div className="text-center max-w-md w-full bg-surface/50 backdrop-blur-sm p-8 rounded-2xl border border-border/50">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 text-primary mb-6">
                    <InsightsIcon />
                </div>
                <h1 className="text-4xl font-bold text-text-main">Current Solutions AI</h1>
                <p className="mt-4 text-lg text-text-muted">
                    Sign in to access your AI-powered dashboard for sales and inventory insights.
                </p>
                <div className="mt-8 flex justify-center min-h-[40px]">
                    { isSigningIn ? (
                        <div className="flex items-center justify-center p-2.5">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            <span className="ml-3 text-text-main">Redirecting to Google...</span>
                        </div>
                    ) : (
                        <button
                            onClick={handleLogin}
                            type="button"
                            className="text-white bg-[#4285F4] hover:bg-[#4285F4]/90 focus:ring-4 focus:outline-none focus:ring-[#4285F4]/50 font-medium rounded-lg text-sm px-5 py-2.5 text-center inline-flex items-center justify-center dark:focus:ring-[#4285F4]/55 transition-colors"
                        >
                            <GoogleIcon />
                            <span className="ml-3">Sign in with Google</span>
                        </button>
                    )}
                </div>
                 {error && (
                    <p className="mt-4 text-sm text-danger">{error}</p>
                )}
                <p className="mt-6 text-xs text-text-muted">
                    Your application data will be stored securely.
                </p>
            </div>
        </div>
    );
};

export default LoginScreen;