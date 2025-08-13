// src/Teacher/StudentRosterViewer.js

import React, { useState, useEffect } from 'react';

// This is now a "presentational" component. It receives all state and functions as props.
export default function StudentRosterViewer({
    isReady,
    isSignedIn,
    courses,
    students,
    selectedCourseName,
    isLoading,
    error,
    onSignIn,
    onSignOut,
    onViewStudents
}) {
    const [selectedStudents, setSelectedStudents] = useState(new Set());
    const [isSending, setIsSending] = useState(false);
    const [notification, setNotification] = useState('');

    // When the students prop changes (i.e., a new class roster is loaded), clear selections.
    useEffect(() => {
        setSelectedStudents(new Set());
    }, [students]);

    const handleStudentSelect = (email) => {
        if (!email) return; // Do not process if email is not available
        const newSelection = new Set(selectedStudents);
        if (newSelection.has(email)) {
            newSelection.delete(email);
        } else {
            newSelection.add(email);
        }
        setSelectedStudents(newSelection);
    };

    const handleSelectAll = () => {
        // Only select students who have an email address
        const selectableStudents = students.filter(s => s.profile?.emailAddress);
        if (selectedStudents.size === selectableStudents.length) {
            setSelectedStudents(new Set()); // Deselect all
        } else {
            const allEmails = new Set(selectableStudents.map(s => s.profile.emailAddress));
            setSelectedStudents(allEmails);
        }
    };

    const handleSendEmail = async () => {
        if (selectedStudents.size === 0) {
            setNotification("Please select at least one student.");
            return;
        }
        setIsSending(true);
        setNotification('');
        try {
            const bccEmails = Array.from(selectedStudents).join(',');
            const subject = `Test Email from VaryTest`;
            const body = "Hi, This is a test email!";
            
            const email = [
                `Bcc: ${bccEmails}`,
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

            setNotification(`Email sent successfully to ${selectedStudents.size} student(s)!`);
        } catch (err) {
            setNotification("Failed to send email. Please ensure you have granted Gmail permissions.");
            console.error("Error sending email:", err);
        } finally {
            setIsSending(false);
        }
    };

    // --- Render Logic ---
    return (
        <div className="bg-white p-8 rounded-lg shadow-md">
            <div className="flex justify-between items-start mb-6 pb-6 border-b border-gray-200">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Connect with Google Classroom</h2>
                    <p className="text-sm text-gray-500">& send an email notification</p>
                </div>
                {isSignedIn ? (
                    <button onClick={onSignOut} className="bg-red-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-600">
                        Sign Out of Google
                    </button>
                ) : (
                    <button onClick={onSignIn} disabled={!isReady} className="bg-blue-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-600 disabled:bg-gray-400">
                        Sign in with Google
                    </button>
                )}
            </div>

            {error && <p className="text-red-500 mb-4">{error}</p>}
            {notification && <p className="text-green-600 mb-4 font-semibold">{notification}</p>}
            
            {isSignedIn && courses.length > 0 && (
                 <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Your Active Courses:</h3>
                     <ul className="divide-y divide-gray-200">
                        {courses.map(course => (
                            <li key={course.id} className="py-4 flex items-center justify-between">
                                <div>
                                    <p className="text-lg font-medium text-indigo-600">{course.name}</p>
                                    <p className="text-sm text-gray-500">{course.descriptionHeading || 'No description'}</p>
                                </div>
                                <button
                                    onClick={() => onViewStudents(course.id, course.name)}
                                    className="bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-700"
                                >
                                    View Students
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {isLoading && <p>Loading...</p>}

            {students.length > 0 && (
                <div className="mt-8">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">Students in "{selectedCourseName}"</h3>
                    <div className="border border-gray-200 rounded-md">
                        <div className="px-6 py-3 bg-gray-50 flex items-center justify-between">
                            <div className="flex items-center">
                                <input 
                                    type="checkbox" 
                                    onChange={handleSelectAll} 
                                    checked={students.length > 0 && selectedStudents.size === students.filter(s => s.profile?.emailAddress).length}
                                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded" 
                                />
                                <label className="ml-3 text-sm font-medium text-gray-900">Select All</label>
                            </div>
                            <button onClick={handleSendEmail} disabled={isSending || selectedStudents.size === 0} className="bg-green-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-400">
                                {isSending ? 'Sending...' : `Send Email (${selectedStudents.size})`}
                            </button>
                        </div>
                        <ul className="divide-y divide-gray-200">
                            {students.map(student => (
                                 <li key={student.userId} className="px-6 py-4 flex items-center">
                                    <input 
                                        type="checkbox" 
                                        checked={selectedStudents.has(student.profile?.emailAddress)} 
                                        onChange={() => handleStudentSelect(student.profile?.emailAddress)} 
                                        disabled={!student.profile?.emailAddress}
                                        className="h-4 w-4 text-indigo-600 border-gray-300 rounded" 
                                    />
                                    <div className="ml-4">
                                        <p className="text-sm font-medium text-gray-900">{student.profile?.name?.fullName || 'N/A'}</p>
                                        <p className="text-sm text-gray-500">{student.profile?.emailAddress || 'Email not available'}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
}
