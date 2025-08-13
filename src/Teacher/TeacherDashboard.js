// src/Teacher/TeacherDashboard.js

import React, { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import SubjectList from './SubjectList';
import ClassList from './ClassList';
import QuestionBank from './QuestionBank';
import GoogleClassroomLinker from './GoogleClassroomLinker';
import TestResults from './TestResults'; // <-- Import the new component
import firebaseConfig from '../utils/firebaseConfig';

// --- Google API Configuration ---
const GOOGLE_CLIENT_ID = "89085157807-rrtcs6g8pt3u77bsv2c29gf1pcd12p72.apps.googleusercontent.com"; // <-- PASTE YOUR CLIENT ID HERE
const GOOGLE_API_KEY = firebaseConfig.apiKey;
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/classroom/v1/rest", "https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest"];
const SCOPES = "https://www.googleapis.com/auth/classroom.courses.readonly https://www.googleapis.com/auth/classroom.rosters.readonly https://www.googleapis.com/auth/classroom.profile.emails https://www.googleapis.com/auth/gmail.send";

function TeacherDashboard({ db, userId, APP_ID }) {
  // Component State
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [activeTab, setActiveTab] = useState('subjects');
  const [subjects, setSubjects] = useState([]);

  // --- Google Classroom State ---
  const [gapiReady, setGapiReady] = useState(false);
  const [gisReady, setGisReady] = useState(false);
  const [tokenClient, setTokenClient] = useState(null);
  const [googleIsSignedIn, setGoogleIsSignedIn] = useState(false);
  const [googleCourses, setGoogleCourses] = useState([]);
  const [googleStudents, setGoogleStudents] = useState([]);
  const [selectedCourseName, setSelectedCourseName] = useState('');
  const [googleIsLoading, setGoogleIsLoading] = useState(false);
  const [googleError, setGoogleError] = useState(null);

  // --- Fetch VaryTest Subjects from Firestore ---
  useEffect(() => {
    if (!db || !userId || !APP_ID) return;
    const subjectsCollectionRef = collection(db, `artifacts/${APP_ID}/users/${userId}/subjects`);
    const q = query(subjectsCollectionRef);
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedSubjects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setSubjects(fetchedSubjects);
    });
    return () => unsubscribe();
  }, [db, userId, APP_ID]);

  // --- Google API Logic ---
  useEffect(() => {
    const gapiScript = document.createElement('script');
    gapiScript.src = "https://apis.google.com/js/api.js";
    gapiScript.async = true;
    gapiScript.onload = () => window.gapi.load('client', () => setGapiReady(true));
    document.body.appendChild(gapiScript);

    const gisScript = document.createElement('script');
    gisScript.src = "https://accounts.google.com/gsi/client";
    gisScript.async = true;
    gisScript.onload = () => setGisReady(true);
    document.body.appendChild(gisScript);

    return () => {
      document.body.removeChild(gapiScript);
      document.body.removeChild(gisScript);
    }
  }, []);

  const initializeClients = useCallback(async () => {
    if (!gapiReady || !gisReady || tokenClient) return;
    try {
      await window.gapi.client.init({ apiKey: GOOGLE_API_KEY, discoveryDocs: DISCOVERY_DOCS });
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: (tokenResponse) => {
          if (tokenResponse && tokenResponse.access_token) {
            window.gapi.client.setToken({ access_token: tokenResponse.access_token });
            setGoogleIsSignedIn(true);
            fetchGoogleCourses();
          }
        },
      });
      setTokenClient(client);
    } catch (err) {
      setGoogleError("Failed to initialize Google services.");
    }
  }, [gapiReady, gisReady, tokenClient]);

  useEffect(() => {
    initializeClients();
  }, [initializeClients]);

  const handleGoogleSignIn = () => {
    if (tokenClient) tokenClient.requestAccessToken({ prompt: 'consent' });
  };

  const handleGoogleSignOut = () => {
    const token = window.gapi.client.getToken();
    if (token) {
      window.google.accounts.oauth2.revoke(token.access_token, () => {
        window.gapi.client.setToken(null);
        setGoogleIsSignedIn(false);
        setGoogleCourses([]);
        setGoogleStudents([]);
      });
    }
  };

  const fetchGoogleCourses = async () => {
    setGoogleIsLoading(true);
    setGoogleError(null);
    try {
      const response = await window.gapi.client.classroom.courses.list({ teacherId: 'me', courseStates: 'ACTIVE' });
      setGoogleCourses(response.result.courses || []);
    } catch (err) {
      setGoogleError("Failed to fetch courses.");
    }
    setGoogleIsLoading(false);
  };

  const handleViewStudents = async (courseId, courseName) => {
    setGoogleIsLoading(true);
    setGoogleError(null);
    setSelectedCourseName(courseName);
    setGoogleStudents([]);
    try {
      const response = await window.gapi.client.classroom.courses.students.list({ courseId });
      setGoogleStudents(response.result.students || []);
    } catch (err) {
      setGoogleError("Failed to fetch students for this course.");
    }
    setGoogleIsLoading(false);
  };

  // --- Render Logic ---
  const handleTabClick = (tabName) => {
    setActiveTab(tabName);
    setSelectedSubject(null);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'subjects':
        return selectedSubject ? (
          <QuestionBank db={db} userId={userId} subject={selectedSubject} APP_ID={APP_ID} onBack={() => setSelectedSubject(null)} />
        ) : (
          <SubjectList db={db} userId={userId} APP_ID={APP_ID} onSelectSubject={setSelectedSubject} subjects={subjects} />
        );
      case 'classes':
        return <ClassList db={db} userId={userId} APP_ID={APP_ID} />;
      case 'google-classroom':
        return (
          <GoogleClassroomLinker
            db={db}
            userId={userId}
            APP_ID={APP_ID}
            isReady={gapiReady && gisReady && !!tokenClient}
            isSignedIn={googleIsSignedIn}
            courses={googleCourses}
            subjects={subjects}
            students={googleStudents}
            selectedCourseName={selectedCourseName}
            isLoading={googleIsLoading}
            error={googleError}
            onSignIn={handleGoogleSignIn}
            onSignOut={handleGoogleSignOut}
            onViewStudents={handleViewStudents}
          />
        );
      // ** NEW: Render the TestResults component **
      case 'results':
        return <TestResults db={db} userId={userId} />;
      default:
        return null;
    }
  };

  return (
    <>
      <div className="flex border-b border-gray-200 mb-6">
        <button onClick={() => handleTabClick('subjects')} className={`px-4 py-2 text-lg font-medium ${activeTab === 'subjects' ? 'text-indigo-700 border-b-2 border-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}>Subjects</button>
        <button onClick={() => handleTabClick('classes')} className={`px-4 py-2 text-lg font-medium ${activeTab === 'classes' ? 'text-indigo-700 border-b-2 border-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}>Classes</button>
        <button onClick={() => handleTabClick('google-classroom')} className={`px-4 py-2 text-lg font-medium ${activeTab === 'google-classroom' ? 'text-indigo-700 border-b-2 border-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}>Google Classroom</button>
        {/* ** NEW: Add the Test Results tab ** */}
        <button onClick={() => handleTabClick('results')} className={`px-4 py-2 text-lg font-medium ${activeTab === 'results' ? 'text-indigo-700 border-b-2 border-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}>Test Results</button>
      </div>
      <div>{renderContent()}</div>
    </>
  );
}

export default TeacherDashboard;
