import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './AuthContext';
// FIX: Import GEMINI_API_KEY from `env.ts` to resolve the TypeScript error and align with the project's configuration file.
import { GEMINI_API_KEY } from './env';

// Polyfill process.env for the Gemini SDK in a browser environment.
// The Gemini SDK requires the API key to be available on `process.env.API_KEY`.
// This polyfill reads the GEMINI_API_KEY from env.ts and makes it available to the SDK.
const geminiApiKey = GEMINI_API_KEY;
if (geminiApiKey) {
  (window as any).process = {
    env: {
      API_KEY: geminiApiKey,
    },
  };
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);