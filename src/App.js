/* eslint-disable no-unused-vars */
/* global __app_id, __initial_auth_token, __firebase_config */

import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';

// Import components from their new paths
import firebaseConfig from './utils/firebaseConfig'; // Import firebaseConfig from utils
import { getCanvasFirebaseConfigJson, getCanvasAppId, getCanvasInitialAuthToken } from './utils/helpers'; // Import helpers
import AuthScreen from './AuthScreen'; // AuthScreen is now a standalone component
import TeacherDashboard from './Teacher/TeacherDashboard'; // TeacherDashboard is now a standalone component
import StudentDashboard from './Student/StudentDashboard'; // Import StudentDashboard

// Main App Component
function App() {
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null); // Stores Firebase Auth user object
  const [userProfile, setUserProfile] = useState(null); // Stores user's role etc. from Firestore
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Determine which Firebase config to use
  const currentFirebaseConfig = getCanvasFirebaseConfigJson() ? JSON.parse(getCanvasFirebaseConfigJson()) : firebaseConfig;

  // Resolve APP_ID and INITIAL_AUTH_TOKEN using the currentFirebaseConfig's appId
  const APP_ID = getCanvasAppId() || currentFirebaseConfig.appId; // Use Canvas ID if present, else from current config
  const INITIAL_AUTH_TOKEN = getCanvasInitialAuthToken();


  // Initialize Firebase and authenticate
  useEffect(() => {
    let unsubscribeProfile = () => {}; // Initialize as no-op function

    try {
      const app = initializeApp(currentFirebaseConfig);
      const firestoreDb = getFirestore(app);
      const firebaseAuth = getAuth(app);

      setDb(firestoreDb);
      setAuth(firebaseAuth);

      // Listen for auth state changes
      const unsubscribeAuth = onAuthStateChanged(firebaseAuth, async (user) => {
        // First, clean up any previous profile listener to prevent stale data/errors
        unsubscribeProfile();

        if (user) {
          setCurrentUser(user);
          setUserId(user.uid);
          setError(null); // Clear any previous errors

          // Fetch user profile from Firestore
          const userDocRef = doc(firestoreDb, 'users', user.uid);
          unsubscribeProfile = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
              setUserProfile(docSnap.data());
            } else {
              console.log("No user profile found in Firestore for:", user.uid);
              // If profile doesn't exist (e.g., brand new signup before profile is written),
              // set userProfile to null and ensure loading is false so AuthScreen appears.
              setUserProfile(null);
            }
            setLoading(false); // Set loading to false once profile is attempted to be fetched
          }, (profileError) => {
            console.error("Error fetching user profile:", profileError);
            setError("Failed to load user profile.");
            setLoading(false);
          });
        } else {
          // If no user, clear all user-related states immediately and set loading to false
          setCurrentUser(null);
          setUserId(null);
          setUserProfile(null);
          setError(null); // Clear any previous errors
          setLoading(false);

          // For Canvas environment, try initial auth token if available, but don't block display
          if (INITIAL_AUTH_TOKEN) {
            signInWithCustomToken(firebaseAuth, INITIAL_AUTH_TOKEN).catch(e => {
              console.error("Firebase initial authentication failed:", e);
              // Do not set global error here to avoid showing error screen on expected anonymous sign-in failure
            });
          }
        }
      });

      return () => {
        unsubscribeAuth(); // Clean up auth listener
        unsubscribeProfile(); // Ensure profile listener is also cleaned up on unmount
      };
    } catch (e) {
      console.error("Firebase initialization failed:", e);
      setError("Failed to initialize the application. Check Firebase config.");
      setLoading(false);
    }
  }, [currentFirebaseConfig, INITIAL_AUTH_TOKEN]);

  const handleLogout = async () => {
    if (auth) {
      try {
        setLoading(true); // Show loading spinner immediately on logout click
        setError(null); // Clear any existing error
        await signOut(auth);
        // The onAuthStateChanged listener will handle clearing states and rendering AuthScreen
      } catch (e) {
        console.error("Error logging out:", e);
        setError("Failed to log out. Please try again.");
        setLoading(false); // Stop loading if logout itself fails
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-xl font-semibold text-gray-700">Loading VaryTest Portal...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-100 text-red-700 p-4 rounded-lg shadow-md">
        <p>Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-inter text-gray-800 p-4 sm:p-6 lg:p-8">
      <h1 className="text-4xl font-extrabold text-indigo-700 mb-8 text-center">
        VaryTest Portal
      </h1>

      <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8 max-w-6xl mx-auto">
        {!currentUser ? ( // If no current user, show AuthScreen immediately
          <AuthScreen db={db} auth={auth} />
        ) : ( // If there is a current user, then proceed to check userProfile
          userProfile ? (
            <>
              <div className="mb-6 pb-6 border-b border-gray-200 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-indigo-600 mb-2">Welcome, {userProfile.name}!</h2>
                  <p className="text-lg text-gray-700">User ID: <span className="font-mono bg-gray-100 p-1 rounded-md text-sm break-words">{userId}</span></p>
                  <p className="text-sm text-gray-500 mt-1">Email: {currentUser.email} | Role: {userProfile.role}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-red-600 text-white rounded-md shadow-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200"
                >
                  Logout
                </button>
              </div>

              {/* Conditional Content based on Role */}
              {userProfile.role === 'Teacher' ? (
                <TeacherDashboard
                  db={db}
                  userId={userId}
                  APP_ID={APP_ID}
                />
              ) : userProfile.role === 'Student' ? ( // Render StudentDashboard for Student role
                <StudentDashboard
                  db={db}
                  userId={userId}
                  APP_ID={APP_ID}
                  userProfile={userProfile}
                />
              ) : (
                // Placeholder for Admin or other roles
                <div className="text-center py-8 text-gray-500">
                  <p>Welcome, {userProfile.name} ({userProfile.role})!</p>
                  <p>Your dashboard is under construction.</p>
                </div>
              )}
            </>
          ) : (
            // If currentUser exists but userProfile is null (still loading or not found)
            <div className="text-center py-8 text-gray-500">
              <p>Loading user profile...</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default App;
