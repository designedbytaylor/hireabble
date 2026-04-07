import React from "react";
import ReactDOM from "react-dom/client";
import * as Sentry from "@sentry/react";
import axios from "axios";
import { Capacitor } from "@capacitor/core";
import "@/index.css";
import App from "@/App";

// Tag every request with the client platform so the backend can enforce
// platform-specific rules (e.g. reject Stripe checkout on iOS native per
// Apple Guideline 3.1.1).
try {
  const _platform = Capacitor.getPlatform(); // 'ios' | 'android' | 'web'
  const _native = Capacitor.isNativePlatform();
  axios.defaults.headers.common["X-Platform"] =
    _native && _platform === "ios"
      ? "ios-native"
      : _native && _platform === "android"
      ? "android-native"
      : "web";
} catch {
  axios.defaults.headers.common["X-Platform"] = "web";
}

if (process.env.REACT_APP_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.REACT_APP_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
  });
}

// Suppress console output in production (Apple App Store compliance)
if (process.env.NODE_ENV === 'production') {
  const noop = () => {};
  console.log = noop;
  console.debug = noop;
  console.info = noop;
  console.warn = noop;
  // Keep console.error — Sentry captures these
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Register service worker for PWA support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {});
  });

  // Respond to service worker requests for auth token (offline swipe sync)
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'GET_AUTH_TOKEN') {
      const token = localStorage.getItem('token');
      event.ports[0]?.postMessage({ token });
    }
  });
}
