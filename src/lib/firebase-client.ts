"use client";

import { getApp, getApps, initializeApp, type FirebaseOptions } from "firebase/app";

/** Firebase web config comes from NEXT_PUBLIC_* env vars (public by design; access is enforced server-side). */
const config: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export const firebaseConfigured = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);

export function firebaseApp() {
  return getApps().length ? getApp() : initializeApp(config);
}

/** Google Analytics for Firebase, only in browsers that support it and only when a measurement id is set. */
export async function startAnalytics() {
  if (!firebaseConfigured || !config.measurementId) return;
  const { getAnalytics, isSupported } = await import("firebase/analytics");
  if (await isSupported()) getAnalytics(firebaseApp());
}
