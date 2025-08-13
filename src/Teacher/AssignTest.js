// src/Teacher/AssignTest.js

import React, { useState, useEffect, useCallback } from 'react';
import firebaseConfig from '../utils/firebaseConfig';

// --- Google API Configuration ---
const GOOGLE_CLIENT_ID = "89085157807-rrtcs6g8pt3u77bsv2c29gf1pcd12p72.apps.googleusercontent.com"; // <-- REPLACE THIS WITH YOUR CLIENT ID
const GOOGLE_API_KEY = firebaseConfig.apiKey;
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/classroom/v1/rest", "https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest"];
const SCOPES = "https://www.googleapis.com/auth/classroom.courses.readonly https://www.googleapis.com/auth/classroom.rosters.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/classroom.profile.emails";

export default function AssignTest() {
    // State for Google API and Data
    const [gapiReady, setGapiReady] = useState(false);
    const [gisReady, setGisReady] = useState(false);
    const [tokenClient, setTokenClient] = useState(null);
    const [isSignedIn, setIsSignedIn] = useState(false);
    const [courses, setCourses] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSending, setIsSending] = useState(null);
    const [error, setError] = useState(null);
    const [notification, setNotification] = useState('');

    const [debugInfo, setDebugInfo] = useState(null);

    // --- Google API Initialization ---
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
                        setIsSignedIn(true);
                        fetchCourses();
                    }
                },
            });
            setTokenClient(client);
        } catch (err) {
            setError("Failed to initialize Google services.");
        }
    }, [gapiReady, gisReady, tokenClient]);

    useEffect(() => {
        initializeClients();
    }, [initializeClients]);

    // --- Data Fetching and Actions ---
    const handleSignIn = () => {
        if (tokenClient) {
            tokenClient.requestAccessToken({ prompt: 'consent' });
        }
    };

    const handleSignOut = () => {
        const token = window.gapi.client.getToken();
        if (token) {
            window.google.accounts.oauth2.revoke(token.access_token, () => {
                window.gapi.client.setToken(null);
                setIsSignedIn(false);
                setCourses([]);
                setNotification('You have been signed out. Please sign in again to grant all permissions.');
            });
        }
    };

    const fetchCourses = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await window.gapi.client.classroom.courses.list({ teacherId: 'me', courseStates: 'ACTIVE' });
            setCourses(response.result.courses || []);
        } catch (err) {
            setError("Failed to fetch courses.");
        }
        setIsLoading(false);
    };

    const handleAssignTest = async (courseId, courseName) => {
        setIsSending(courseId);
        setNotification('');
        try {
            const studentResponse = await window.gapi.client.classroom.courses.students.list({ courseId });
            const students = studentResponse.result.students || [];

            if (students.length === 0) {
                setNotification(`The class "${courseName}" has no students.`);
                setIsSending(null);
                return;
            }

            const profileResponse = await window.gapi.client.gmail.users.getProfile({ userId: 'me' });
            const teacherEmail = profileResponse.result.emailAddress;

            setDebugInfo({
                teacherEmail,
                students: students,
                courseName
            });

        } catch (err) {
            // ** THE FIX IS HERE: Automatically ask for consent if permissions are missing **
            if (err.status === 403) {
                setNotification("Additional permissions are required. Please approve the request in the pop-up window.");
                if (tokenClient) {
                    tokenClient.requestAccessToken({ prompt: 'consent' });
                }
            } else {
                setNotification("Failed to fetch data. Please check the console for details.");
                console.error("Error fetching data for debug popup:", err);
            }
            setIsSending(null);
        }
    };

    const proceedWithSend = async () => {
        if (!debugInfo) return;
        const { teacherEmail, students, courseName } = debugInfo;
        const studentEmails = students.map(s => s.profile?.emailAddress).filter(Boolean);

        if (studentEmails.length === 0) {
            setNotification(`Could not find any student emails in the class "${courseName}".`);
            setDebugInfo(null);
            setIsSending(null);
            return;
        }

        try {
            const subject = `New Test Assigned in VaryTest for ${courseName}`;
            const body = "Hello,\n\nA new test has been assigned to you. Please log in to the VaryTest portal to begin.\n\nThank you,\nYour Teacher";
            
            const email = [
                `From: ${teacherEmail}`,
                `Bcc: ${studentEmails.join(',')}`,
                'Content-Type: text/plain; charset="UTF-8"',
                'MIME-Version: 1.0',
                `Subject: ${subject}`,
                '',
                body
            ].join('\n');

            const base64EncodedEmail = btoa(email).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

            await window.gapi.client.gmail.users.messages.send({
                'userId': 'me',
                'resource': { 'raw': base64EncodedEmail }
            });

            setNotification(`Test notification sent successfully to students of "${courseName}"!`);
        } catch (err) {
            setNotification("Failed to send email notification.");
            console.error("Error sending email:", err);
        } finally {
            setDebugInfo(null);
            setIsSending(null);
        }
    };

    const cancelSend = () => {
        setDebugInfo(null);
        setIsSending(null);
        setNotification("Email sending cancelled.");
    };

    // --- Render Logic ---
    return (
        <div className="bg-white p-8 rounded-lg shadow-md">
            {debugInfo && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-xl max-w-lg w-full">
                        <h3 className="text-lg font-bold mb-4">Confirm Email Details</h3>
                        <div className="mb-4">
                            <p className="font-semibold">From (Teacher):</p>
                            <p className="text-sm bg-gray-100 p-2 rounded">{debugInfo.teacherEmail}</p>
                        </div>
                        <div className="mb-4">
                            <p className="font-semibold">Fetched Students in {debugInfo.courseName}:</p>
                            <ul className="text-sm bg-gray-100 p-2 rounded max-h-40 overflow-y-auto">
                                {debugInfo.students.map((student, i) => (
                                    <li key={i}>
                                        <strong>Name:</strong> {student.profile?.name?.fullName || 'N/A'}<br/>
                                        <span className="pl-4"><strong>ID:</strong> {student.userId || 'N/A'}</span><br/>
                                        <span className="pl-4"><strong>Email:</strong> {student.profile?.emailAddress || 'Not Available'}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="flex justify-end space-x-4">
                            <button onClick={cancelSend} className="px-4 py-2 bg-gray-300 rounded-md hover:bg-gray-400">Cancel</button>
                            <button onClick={proceedWithSend} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">Proceed to Send</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex justify-between items-start mb-6 pb-6 border-b border-gray-200">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Assign Test via Google Classroom</h2>
                    <p className="text-sm text-gray-500">Directly email students in a Google Classroom about a new test.</p>
                </div>
                {isSignedIn ? (
                     <button onClick={handleSignOut} className="bg-red-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-600 transition-colors">
                        Sign Out of Google
                    </button>
                ) : (
                    <button onClick={handleSignIn} disabled={!gapiReady || !gisReady} className="bg-blue-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-400">
                        Sign in with Google
                    </button>
                )}
            </div>

            {error && <p className="text-red-500 mb-4">{error}</p>}
            {notification && <p className="text-green-600 mb-4 font-semibold">{notification}</p>}

            {isLoading ? <p>Loading courses...</p> : (
                <ul className="divide-y divide-gray-200">
                    {courses.map(course => (
                        <li key={course.id} className="py-4 flex items-center justify-between">
                            <div>
                                <p className="text-lg font-medium text-indigo-600">{course.name}</p>
                                <p className="text-sm text-gray-500">{course.descriptionHeading || 'No description'}</p>
                            </div>
                            <button
                                onClick={() => handleAssignTest(course.id, course.name)}
                                disabled={isSending === course.id || !isSignedIn}
                                className="bg-green-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 w-36 text-center"
                            >
                                {isSending === course.id ? 'Checking...' : 'Assign Test'}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
