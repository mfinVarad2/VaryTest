/* eslint-disable no-unused-vars */
/* global __app_id, __initial_auth_token, __firebase_config */

import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, query, where, setDoc, doc } from 'firebase/firestore';

// Ensure Tailwind CSS is loaded (usually done in index.html or global CSS)
// For this standalone example, we assume it's available.

// IMPORTANT: For local deployment, replace the placeholder with your actual Firebase config object.
// This variable MUST be defined for local builds.
const firebaseConfig = {
  apiKey: "AIzaSyCCh7b1VzE5KzPPBb_ghP_80QMoauQ56uQ",
  authDomain: "varytest-project.firebaseapp.com",
  projectId: "varytest-project",
  storageBucket: "varytest-project.firebasestorage.app",
  messagingSenderId: "89085157807",
  appId: "1:89085157807:web:5b5d17961e77c3cd828f5a",
  measurementId: "G-J3N7DYWTS1"
};

// Helper functions to safely access Canvas-specific global variables,
// providing fallbacks for local builds. This satisfies ESLint's no-undef rule.
const getCanvasFirebaseConfigJson = () => typeof __firebase_config !== 'undefined' ? __firebase_config : null;
const getCanvasAppId = () => typeof __app_id !== 'undefined' ? __app_id : null;
const getCanvasInitialAuthToken = () => typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;


// Main App Component
function App() {
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null); // Stores Firebase Auth user object
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);

  // Determine which Firebase config to use
  // If CANVAS_FIREBASE_CONFIG_JSON is provided by Canvas, parse it. Otherwise, use the locally defined firebaseConfig.
  const currentFirebaseConfig = getCanvasFirebaseConfigJson() ? JSON.parse(getCanvasFirebaseConfigJson()) : firebaseConfig;

  // Resolve APP_ID and INITIAL_AUTH_TOKEN using the currentFirebaseConfig's appId
  // This ensures APP_ID is always the correct one for the Firebase project.
  const APP_ID = getCanvasAppId() || currentFirebaseConfig.appId; // Use Canvas ID if present, else from current config
  const INITIAL_AUTH_TOKEN = getCanvasInitialAuthToken();


  // Initialize Firebase and authenticate
  useEffect(() => {
    try {
      const app = initializeApp(currentFirebaseConfig); // Use the determined config here
      const firestoreDb = getFirestore(app);
      const firebaseAuth = getAuth(app);

      setDb(firestoreDb);
      setAuth(firebaseAuth);

      // Listen for auth state changes
      const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
        if (user) {
          setCurrentUser(user);
          setUserId(user.uid);
          setLoading(false);
        } else {
          // If no user, try signing in with custom token (for Canvas) or remain unauthenticated (for local login)
          try {
            if (INITIAL_AUTH_TOKEN) { // Use the top-level defined INITIAL_AUTH_TOKEN
              await signInWithCustomToken(firebaseAuth, INITIAL_AUTH_TOKEN);
            } else {
              // For local deployment, we want to show the login/signup screen,
              // so we don't sign in anonymously by default here.
              // The user will explicitly sign up/in.
              setLoading(false);
            }
          } catch (e) {
            console.error("Firebase authentication failed:", e);
            setError("Authentication failed. Please try again.");
            setLoading(false);
          }
        }
      });

      return () => unsubscribe(); // Clean up auth listener
    } catch (e) {
      console.error("Firebase initialization failed:", e);
      setError("Failed to initialize the application. Check Firebase config.");
      setLoading(false);
    }
  }, [currentFirebaseConfig, INITIAL_AUTH_TOKEN]); // Added INITIAL_AUTH_TOKEN to dependencies

  const handleLogout = async () => {
    if (auth) {
      try {
        await signOut(auth);
        setCurrentUser(null);
        setUserId(null);
        setSelectedSubject(null); // Clear selected subject on logout
      } catch (e) {
        console.error("Error logging out:", e);
        setError("Failed to log out. Please try again.");
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
        VaryTest Teacher Portal
      </h1>

      <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8 max-w-6xl mx-auto">
        {currentUser ? (
          <>
            <div className="mb-6 pb-6 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-indigo-600 mb-2">Welcome!</h2>
                <p className="text-lg text-gray-700">User ID: <span className="font-mono bg-gray-100 p-1 rounded-md text-sm break-words">{userId}</span></p>
                <p className="text-sm text-gray-500 mt-1">Email: {currentUser.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-600 text-white rounded-md shadow-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200"
              >
                Logout
              </button>
            </div>
            {/* Conditional rendering based on selectedSubject */}
            {selectedSubject ? (
              <QuestionBank
                db={db}
                userId={userId}
                subject={selectedSubject}
                APP_ID={APP_ID} // Pass APP_ID down
                onBack={() => setSelectedSubject(null)}
              />
            ) : (
              <SubjectList
                db={db}
                userId={userId}
                APP_ID={APP_ID} // Pass APP_ID down
                onSelectSubject={setSelectedSubject}
              />
            )}
          </>
        ) : (
          <AuthScreen db={db} auth={auth} />
        )}
      </div>
    </div>
  );
}

// AuthScreen Component
function AuthScreen({ db, auth }) {
  const [showLogin, setShowLogin] = useState(true);

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-xl">
      <div className="flex justify-center mb-6">
        <button
          onClick={() => setShowLogin(true)}
          className={`px-6 py-2 rounded-l-lg font-semibold ${showLogin ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
        >
          Login
        </button>
        <button
          onClick={() => setShowLogin(false)}
          className={`px-6 py-2 rounded-r-lg font-semibold ${!showLogin ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
        >
          Sign Up
        </button>
      </div>

      {showLogin ? (
        <Login auth={auth} />
      ) : (
        <Signup db={db} auth={auth} onSignupSuccess={() => setShowLogin(true)} />
      )}
    </div>
  );
}

// Login Component
function Login({ auth }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Auth state change listener in App.js will handle redirect
    } catch (e) {
      console.error("Login error:", e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      <h2 className="text-2xl font-bold text-center text-indigo-700 mb-6">Login to VaryTest</h2>
      {error && <p className="text-red-500 text-sm text-center">{error}</p>}
      <div>
        <label htmlFor="loginEmail" className="sr-only">Email</label>
        <input
          type="email"
          id="loginEmail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email Address"
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          required
        />
      </div>
      <div>
        <label htmlFor="loginPassword" className="sr-only">Password</label>
        <input
          type="password"
          id="loginPassword"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          required
        />
      </div>
      <button
        type="submit"
        className="w-full bg-indigo-600 text-white py-2 rounded-md font-semibold hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
        disabled={loading}
      >
        {loading ? 'Logging In...' : 'Login'}
      </button>
    </form>
  );
}

// Signup Component
function Signup({ db, auth, onSignupSuccess }) {
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Teacher'); // Default role
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    if (!agreeTerms) {
      setError("You must agree to the terms and conditions.");
      return;
    }

    setLoading(true);
    try {
      // 1. Create user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Save additional user profile data to Firestore
      await setDoc(doc(db, 'users', user.uid), {
        name: name.trim(),
        surname: surname.trim(),
        email: email.trim(),
        role: role,
        createdAt: new Date(),
      });

      onSignupSuccess(); // Navigate to login tab
    } catch (e) {
      console.error("Signup error:", e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSignup} className="space-y-4">
      <h2 className="text-2xl font-bold text-center text-indigo-700 mb-6">Sign Up for VaryTest</h2>
      {error && <p className="text-red-500 text-sm text-center">{error}</p>}
      <div>
        <label htmlFor="signupName" className="sr-only">Name</label>
        <input
          type="text"
          id="signupName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="First Name"
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          required
        />
      </div>
      <div>
        <label htmlFor="signupSurname" className="sr-only">Surname</label>
        <input
          type="text"
          id="signupSurname"
          value={surname}
          onChange={(e) => setSurname(e.target.value)}
          placeholder="Last Name"
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          required
        />
      </div>
      <div>
        <label htmlFor="signupEmail" className="sr-only">Email</label>
        <input
          type="email"
          id="signupEmail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email Address"
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          required
        />
      </div>
      <div>
        <label htmlFor="signupPassword" className="sr-only">Password</label>
        <input
          type="password"
          id="signupPassword"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Set Password (min 6 characters)"
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          required
        />
      </div>
      <div>
        <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">Role</label>
        <select
          id="role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="Teacher">Teacher</option>
          <option value="Admin">Admin</option>
        </select>
      </div>
      <div className="flex items-center">
        <input
          type="checkbox"
          id="agreeTerms"
          checked={agreeTerms}
          onChange={(e) => setAgreeTerms(e.target.checked)}
          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
          required
        />
        <label htmlFor="agreeTerms" className="ml-2 block text-sm text-gray-900">
          I agree to the <a href="/terms" className="text-indigo-600 hover:underline">terms & conditions</a>
        </label>
      </div>
      <button
        type="submit"
        className="w-full bg-green-600 text-white py-2 rounded-md font-semibold hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-200"
        disabled={loading}
      >
        {loading ? 'Signing Up...' : 'Sign Up'}
      </button>
    </form>
  );
}

// SubjectList Component (remains mostly the same, now receives db, userId)
function SubjectList({ db, userId, onSelectSubject, APP_ID }) { // Added APP_ID prop
  const [allSubjects, setAllSubjects] = useState([]); // Stores all subjects
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectCode, setNewSubjectCode] = useState('');
  const [isAddingSubject, setIsAddingSubject] = useState(false);
  const [showAllSubjects, setShowAllSubjects] = useState(false); // State to toggle between recent and all

  // Fetch all subjects initially and sort client-side
  useEffect(() => {
    if (!db || !userId || !APP_ID) return; // Ensure APP_ID is available

    const subjectsCollectionRef = collection(db, `artifacts/${APP_ID}/users/${userId}/subjects`);
    const q = query(subjectsCollectionRef); // Fetch all subjects without orderBy or limit

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedSubjects = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Sort client-side by creation date (descending)
      fetchedSubjects.sort((a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0));
      setAllSubjects(fetchedSubjects);
    }, (err) => {
      console.error("Error fetching subjects:", err);
    });

    return () => unsubscribe(); // Clean up listener
  }, [db, userId, APP_ID]); // Added APP_ID to dependencies

  // Subjects to display: either top 5 recent or all
  const subjectsToDisplay = showAllSubjects ? allSubjects : allSubjects.slice(0, 5);

  // Handle adding a new subject
  const handleAddSubject = async (e) => {
    e.preventDefault();
    if (!newSubjectName.trim() || !newSubjectCode.trim()) {
      console.warn("Subject Name and Code cannot be empty.");
      return;
    }

    setIsAddingSubject(true);
    try {
      const subjectsCollectionRef = collection(db, `artifacts/${APP_ID}/users/${userId}/subjects`);
      await addDoc(subjectsCollectionRef, {
        name: newSubjectName.trim(),
        code: newSubjectCode.trim().toUpperCase(),
        createdAt: new Date(),
      });
      setNewSubjectName('');
      setNewSubjectCode('');
    } catch (e) {
      console.error("Error adding subject:", e);
      console.error("Failed to add subject. Please try again.");
    } finally {
      setIsAddingSubject(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-indigo-600 mb-6">Your Subjects</h2>

      {/* Add New Subject Form */}
      <form onSubmit={handleAddSubject} className="mb-8 p-6 bg-indigo-50 rounded-lg shadow-inner">
        <h3 className="text-xl font-semibold text-indigo-700 mb-4">Create New Subject</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label htmlFor="subjectName" className="block text-sm font-medium text-gray-700 mb-1">Subject Name</label>
            <input
              type="text"
              id="subjectName"
              value={newSubjectName}
              onChange={(e) => setNewSubjectName(e.target.value)}
              placeholder="e.g., Mathematics"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              required
            />
          </div>
          <div>
            <label htmlFor="subjectCode" className="block text-sm font-medium text-gray-700 mb-1">Subject Code</label>
            <input
              type="text"
              id="subjectCode"
              value={newSubjectCode}
              onChange={(e) => setNewSubjectCode(e.target.value)}
              placeholder="e.g., MATH101"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              required
            />
          </div>
        </div>
        <button
          type="submit"
          className="w-full md:w-auto px-6 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
          disabled={isAddingSubject}
        >
          {isAddingSubject ? 'Adding Subject...' : 'Add Subject'}
        </button>
      </form>

      {/* List of Subjects */}
      {allSubjects.length === 0 ? (
        <p className="text-center text-gray-500 py-8">No subjects created yet. Start by adding one above!</p>
      ) : (
        <>
          <h3 className="text-2xl font-bold text-indigo-600 mt-10 mb-6">
            {showAllSubjects ? 'All Subjects' : 'Recently Created Subjects'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {subjectsToDisplay.map((subject) => (
              <div
                key={subject.id}
                onClick={() => onSelectSubject(subject)}
                className="bg-white border border-gray-200 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 cursor-pointer p-6 flex flex-col justify-between items-start"
              >
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{subject.name}</h3>
                  <p className="text-sm text-indigo-600 font-medium bg-indigo-50 px-3 py-1 rounded-full inline-block">
                    {subject.code}
                  </p>
                </div>
                <p className="text-xs text-gray-500 mt-4">
                  Created: {subject.createdAt?.toDate().toLocaleDateString() || 'N/A'}
                </p>
              </div>
            ))}
          </div>
          {allSubjects.length > 5 && (
            <div className="text-center mt-8">
              <button
                onClick={() => setShowAllSubjects(!showAllSubjects)}
                className="px-6 py-3 bg-gray-700 text-white rounded-md shadow-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-600 transition-colors duration-200"
              >
                {showAllSubjects ? 'Show Recent Subjects' : `View All Subjects (${allSubjects.length})`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// QuestionBank Component (remains mostly the same, now receives db, userId)
function QuestionBank({ db, userId, subject, onBack, APP_ID }) { // Added APP_ID prop
  const [allQuestions, setAllQuestions] = useState([]); // Stores all questions for the subject
  const [showAddQuestionForm, setShowAddQuestionForm] = useState(false);
  const [showAllQuestions, setShowAllQuestions] = useState(false); // State to toggle between recent and all

  // Fetch all questions for the selected subject initially and sort client-side
  useEffect(() => {
    if (!db || !userId || !subject?.id || !APP_ID) return; // Ensure APP_ID is available

    const questionsCollectionRef = collection(db, `artifacts/${APP_ID}/users/${userId}/questions`);
    const q = query(questionsCollectionRef, where("subjectId", "==", subject.id));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedQuestions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Sort client-side by creation date (descending)
      fetchedQuestions.sort((a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0));
      setAllQuestions(fetchedQuestions);
    }, (err) => {
      console.error("Error fetching questions:", err);
    });

    return () => unsubscribe(); // Clean up listener
  }, [db, userId, subject?.id, APP_ID]); // Added APP_ID to dependencies

  // Questions to display: either top 5 recent or all
  const questionsToDisplay = showAllQuestions ? allQuestions : allQuestions.slice(0, 5);

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-6 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors duration-200 flex items-center"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        Back to Subjects
      </button>

      <h2 className="text-3xl font-bold text-indigo-700 mb-6">
        Question Bank for <span className="text-indigo-900">{subject.name} ({subject.code})</span>
      </h2>
      <p className="text-lg text-gray-700 mb-4">Total Questions: <span className="font-semibold">{allQuestions.length}</span></p>


      <button
        onClick={() => setShowAddQuestionForm(!showAddQuestionForm)}
        className="mb-8 px-6 py-3 bg-green-600 text-white rounded-md shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-200 flex items-center justify-center"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        {showAddQuestionForm ? 'Hide Form' : 'Add New Dynamic Question'}
      </button>

      {showAddQuestionForm && (
        <DynamicQuestionForm
          db={db}
          userId={userId}
          subjectId={subject.id}
          APP_ID={APP_ID} // Pass APP_ID down
          onQuestionAdded={() => setShowAddQuestionForm(false)}
        />
      )}

      <h3 className="text-2xl font-bold text-indigo-600 mt-10 mb-6">
        {showAllQuestions ? 'All Questions' : 'Recently Added Questions'}
      </h3>

      {allQuestions.length === 0 ? (
        <p className="text-center text-gray-500 py-8">No questions in this subject yet. Add one above!</p>
      ) : (
        <>
          <div className="overflow-x-auto bg-white rounded-lg shadow-md">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Question Text
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Variables
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Formula
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Added On
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {questionsToDisplay.map((question) => (
                  <tr key={question.id}>
                    <td className="px-6 py-4 whitespace-normal text-sm font-medium text-gray-900 max-w-xs overflow-hidden text-ellipsis">
                      {question.questionText}
                    </td>
                    <td className="px-6 py-4 whitespace-normal text-sm text-gray-500 max-w-xs">
                      {question.variables.map(v => (
                        <div key={v.name}>
                          <span className="font-mono bg-gray-100 px-1 rounded-sm text-xs">{v.name}</span>: {v.values.join(', ')}
                        </div>
                      ))}
                    </td>
                    <td className="px-6 py-4 whitespace-normal text-sm text-gray-500 font-mono max-w-xs overflow-hidden text-ellipsis">
                      {question.formula}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {question.createdAt?.toDate().toLocaleDateString() || 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {allQuestions.length > 5 && (
            <div className="text-center mt-8">
              <button
                onClick={() => setShowAllQuestions(!showAllQuestions)}
                className="px-6 py-3 bg-gray-700 text-white rounded-md shadow-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-600 transition-colors duration-200"
              >
                {showAllQuestions ? 'Show Recent Questions' : `View All Questions (${allQuestions.length})`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// DynamicQuestionForm Component (remains mostly the same)
function DynamicQuestionForm({ db, userId, subjectId, onQuestionAdded, APP_ID }) { // Added APP_ID prop
  const [questionText, setQuestionText] = useState('');
  const [variables, setVariables] = useState([]); // [{id: 'uuid', name: 'var_1', values: ['10', '20']}]
  const [formula, setFormula] = useState('');
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const nextVarIndex = useRef(1); // To keep track of the next 'var_X' to generate

  // Refs for managing cursor position in textareas/inputs
  const questionTextRef = useRef(null);
  const formulaRef = useRef(null);

  // Define mathematical operators and functions
  const mathOperators = ['+', '-', '*', '/', '^', '(', ')', '!'];
  const mathFunctions = ['sin()', 'cos()', 'tan()', 'cosec()', 'sec()', 'cot()'];

  // Function to insert text at cursor position
  const insertTextAtCursor = (inputRef, textToInsert, setTextState, cursorOffset = 0) => {
    const input = inputRef.current;
    if (!input) return;

    const start = input.selectionStart;
    const end = input.selectionEnd;
    const value = input.value;

    const newValue = value.substring(0, start) + textToInsert + value.substring(end);
    setTextState(newValue); // Update React state

    // Use a setTimeout to ensure the DOM has updated before setting selection
    setTimeout(() => {
      input.selectionStart = input.selectionEnd = start + textToInsert.length - cursorOffset;
      input.focus(); // Keep focus on the input after insertion
    }, 0);
  };

  // Effect to parse variables from questionText
  useEffect(() => {
    const regex = /\{\{(var_\d+)\}\}/g; // Matches {{var_1}}, {{var_2}}, etc.
    let match;
    const extractedVarNames = new Set();
    while ((match = regex.exec(questionText)) !== null) {
      extractedVarNames.add(match[1]); // Add 'var_1', 'var_2'
    }

    setVariables(prevVars => {
      const newVariables = [];
      const usedVarNames = new Set();

      // Preserve existing variables and their values if they are still in the questionText
      prevVars.forEach(prevVar => {
        if (extractedVarNames.has(prevVar.name)) {
          newVariables.push(prevVar);
          usedVarNames.add(prevVar.name);
        }
      });

      // Add new variables found in questionText that weren't previously in state
      Array.from(extractedVarNames).sort((a, b) => {
        const numA = parseInt(a.split('_')[1]);
        const numB = parseInt(b.split('_')[1]);
        return numA - numB;
      }).forEach(varName => {
        if (!usedVarNames.has(varName)) {
          newVariables.push({ id: crypto.randomUUID(), name: varName, values: [''] });
        }
      });

      // Update nextVarIndex based on current variables
      let maxVarIndex = 0;
      newVariables.forEach(v => {
        const num = parseInt(v.name.split('_')[1]);
        if (!isNaN(num) && num > maxVarIndex) {
          maxVarIndex = num;
        }
      });
      nextVarIndex.current = maxVarIndex + 1;

      return newVariables;
    });
  }, [questionText]); // Re-run when questionText changes

  // Handle adding a new variable placeholder
  const handleAddVariablePlaceholder = () => {
    const newVarName = `var_${nextVarIndex.current}`;
    // No need to check for duplicates here, as the useEffect will reconcile
    // and nextVarIndex.current ensures a new sequential name.

    // Insert the new variable at the current cursor position in the question text
    insertTextAtCursor(questionTextRef, `{{${newVarName}}}`, setQuestionText);
  };

  // Handle changing a variable's value (dynamic inputs)
  const handleVariableValueChange = (varId, valueIndex, value) => {
    setVariables(prevVars => prevVars.map(v => {
      if (v.id === varId) {
        const newValues = [...v.values];
        newValues[valueIndex] = value;

        // If the last input is filled, add a new empty one
        // Also, if a value is cleared and it's not the last one, remove it
        if (valueIndex === newValues.length - 1 && value.trim() !== '') {
          newValues.push('');
        } else if (value.trim() === '' && newValues.length > 1 && valueIndex < newValues.length - 1) {
          // Remove if cleared and not the last one (to prevent empty middle inputs)
          newValues.splice(valueIndex, 1);
        }
        return { ...v, values: newValues };
      }
      return v;
    }));
  };

  // Handle removing a variable value input field
  const handleRemoveVariableValue = (varId, valueIndex) => {
    setVariables(prevVars => prevVars.map(v => {
      if (v.id === varId) {
        const newValues = v.values.filter((_, idx) => idx !== valueIndex);
        // Ensure there's always at least one empty input if all are removed
        if (newValues.length === 0) {
          newValues.push('');
        }
        return { ...v, values: newValues };
      }
      return v;
    }));
  };

  // Handle removing a variable entirely
  const handleRemoveVariable = (varId) => {
    setVariables(prevVars => prevVars.filter(v => v.id !== varId));
    // The useEffect dependent on questionText will handle re-indexing var_X names if they are removed
    // from the question text itself. If a variable is removed here but still exists in the question text,
    // it will be re-added by the useEffect. This is a trade-off for simplicity and consistency.
    // For a more complex scenario, we might need to actively remove the {{var_X}} from questionText here.
  };

  // Handle adding a new dynamic question
  const handleAddQuestion = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!questionText.trim()) {
      setErrorMessage("Question text cannot be empty.");
      return;
    }
    if (!formula.trim()) {
      setErrorMessage("Formula cannot be empty.");
      return;
    }

    if (variables.length === 0) {
      setErrorMessage("Please add at least one variable to the question.");
      return;
    }

    // Validate variables have at least one non-empty value
    const hasInvalidVariable = variables.some(v => v.values.filter(val => val.trim() !== '').length === 0);
    if (hasInvalidVariable) {
      setErrorMessage("All defined variables must have at least one value.");
      return;
    }

    setIsAddingQuestion(true);
    try {
      const questionsCollectionRef = collection(db, `artifacts/${APP_ID}/users/${userId}/questions`); // Use APP_ID

      // Prepare variables for saving: filter out empty value inputs
      const variablesToSave = variables.map(v => ({
        name: v.name,
        values: v.values.filter(val => val.trim() !== '') // Only save non-empty values
      }));

      await addDoc(questionsCollectionRef, {
        subjectId: subjectId,
        questionText: questionText.trim(),
        variables: variablesToSave,
        formula: formula.trim(),
        createdAt: new Date(),
      });
      setQuestionText('');
      setVariables([]);
      setFormula('');
      nextVarIndex.current = 1; // Reset variable index for next question
      onQuestionAdded(); // Notify parent to hide form
    } catch (e) {
      console.error("Error adding question:", e);
      setErrorMessage("Failed to add question. Please try again.");
    } finally {
      setIsAddingQuestion(false);
    }
  };

  return (
    <div className="mb-8 p-6 bg-blue-50 rounded-lg shadow-inner">
      <h3 className="text-xl font-semibold text-blue-700 mb-4">Create New Dynamic Question</h3>
      {errorMessage && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <strong className="font-bold">Error!</strong>
          <span className="block sm:inline"> {errorMessage}</span>
        </div>
      )}
      <form onSubmit={handleAddQuestion}>
        {/* Question Text Area with "Add Variable" button */}
        <div className="mb-4">
          <label htmlFor="questionText" className="block text-sm font-medium text-gray-700 mb-1">
            Question Text
          </label>
          <div className="flex items-center gap-2 mb-2">
            <button
              type="button"
              onClick={handleAddVariablePlaceholder}
              className="px-4 py-2 bg-indigo-500 text-white rounded-md shadow-sm hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200 flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Variable
            </button>
            <span className="text-sm text-gray-600">Click to insert <span className="font-mono bg-gray-200 px-1 rounded-sm">{`{{var_X}}`}</span> at cursor.</span>
          </div>
          <textarea
            id="questionText"
            ref={questionTextRef}
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            placeholder="e.g., A car is running at {{var_1}} km/hr for {{var_2}} hours. Then how much distance it will cover?"
            rows="3"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            required
          ></textarea>
        </div>

        {/* Dynamic Value Inputs for Variables */}
        {variables.length > 0 && (
          <div className="mb-6 p-4 bg-gray-100 rounded-md border border-gray-200">
            <h4 className="text-lg font-semibold text-gray-800 mb-3">Provide Values for Each Variable:</h4>
            {variables.map(v => (
              <div key={v.id} className="mb-4 p-3 bg-gray-50 rounded-md border border-gray-200">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Variable: <span className="font-mono bg-gray-200 px-2 py-0.5 rounded-md">{v.name}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => handleRemoveVariable(v.id)}
                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                    title="Remove this variable"
                  >
                    Remove Variable
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {v.values.map((val, valIdx) => (
                    <div key={valIdx} className="flex items-center gap-1">
                      <input
                        type="text"
                        value={val}
                        onChange={(e) => handleVariableValueChange(v.id, valIdx, e.target.value)}
                        placeholder={`Value ${valIdx + 1}`}
                        className="flex-grow px-2 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                      />
                      {/* Show remove button only if there's more than one value input, or if it's not the last empty one */}
                      {v.values.length > 1 && (val.trim() !== '' || valIdx < v.values.length - 1) && (
                        <button
                          type="button"
                          onClick={() => handleRemoveVariableValue(v.id, valIdx)}
                          className="text-red-400 hover:text-red-600"
                          title="Remove value"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1zm2 3a1 1 0 011-1h2a1 1 0 110 2h-2a1 1 0 01-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Enter values one by one. A new input appears automatically. Empty inputs in the middle will be removed.
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Formula Input */}
        <div className="mb-6">
          <label htmlFor="formula" className="block text-sm font-medium text-gray-700 mb-1">
            Formula to calculate answer
          </label>
          <p className="text-sm font-medium text-gray-700 mb-2">Click to insert variables:</p>
          {/* Variable Chips (above formula input) */}
          <div className="flex flex-wrap gap-2 mb-4">
            {variables.map(v => (
              <span
                key={`formula-var-${v.id}`}
                onClick={() => insertTextAtCursor(formulaRef, v.name, setFormula)}
                className="cursor-pointer bg-purple-100 text-purple-800 text-sm font-medium px-3 py-1 rounded-full hover:bg-purple-200 transition-colors duration-150 shadow-sm"
                title={`Click to insert ${v.name} into formula`}
              >
                {v.name}
              </span>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            {/* Formula Input Field */}
            <div className="flex-grow">
              <input
                type="text"
                id="formula"
                ref={formulaRef}
                value={formula}
                onChange={(e) => setFormula(e.target.value)}
                placeholder="e.g., (var_1 * var_2) / sin(var_3)"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                required
              />
              <p className="text-sm text-gray-600 mt-2">
                Use variables and operators/functions to build your formula.
              </p>
            </div>

            {/* Operator and Function Chips (to the right of formula input) */}
            <div className="flex flex-wrap gap-2 p-3 bg-gray-100 rounded-md border border-gray-200 sm:w-1/3 max-w-xs">
              <p className="w-full text-sm font-medium text-gray-700 mb-1">Operators & Functions:</p>
              {/* Operator Chips */}
              {mathOperators.map((op, index) => (
                <span
                  key={`op-${index}`}
                  onClick={() => insertTextAtCursor(formulaRef, op, setFormula)}
                  className="cursor-pointer bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded-full hover:bg-blue-200 transition-colors duration-150 shadow-sm"
                  title={`Click to insert ${op} into formula`}
                >
                  {op}
                </span>
              ))}
              {/* Function Chips */}
              {mathFunctions.map((func, index) => (
                <span
                  key={`func-${index}`}
                  onClick={() => insertTextAtCursor(formulaRef, func, setFormula, 1)} // 1 for cursor inside ()
                  className="cursor-pointer bg-teal-100 text-teal-800 text-sm font-medium px-3 py-1 rounded-full hover:bg-teal-200 transition-colors duration-150 shadow-sm"
                  title={`Click to insert ${func} into formula`}
                >
                  {func}
                </span>
              ))}
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="w-full px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
          disabled={isAddingQuestion}
        >
          {isAddingQuestion ? 'Adding Question...' : 'Add Question to Bank'}
        </button>
      </form>
    </div>
  );
}

export default App;
