// src/Teacher/GoogleClassroomLinker.js

import React, { useState, useEffect } from 'react';
import { doc, updateDoc, collection, addDoc } from 'firebase/firestore';

// This component now handles linking, viewing students, and assigning tests.
export default function GoogleClassroomLinker({
    db,
    userId,
    APP_ID,
    isReady,
    isSignedIn,
    courses,
    subjects,
    students,
    selectedCourseName,
    isLoading,
    error,
    onSignIn,
    onSignOut,
    onViewStudents
}) {
    const [linkingCourse, setLinkingCourse] = useState(null);
    const [notification, setNotification] = useState('');
    const [selectedStudents, setSelectedStudents] = useState(new Set());
    const [isSending, setIsSending] = useState(false);
    const [isAssigning, setIsAssigning] = useState(false);

    // When the students prop changes, clear selections
    useEffect(() => {
        setSelectedStudents(new Set());
    }, [students]);

    const availableSubjects = subjects.filter(s => !s.linkedClassroom);

    const handleLinkSubject = async (subjectId) => {
        if (!linkingCourse || !subjectId) return;
        const subjectDocRef = doc(db, `artifacts/${APP_ID}/users/${userId}/subjects`, subjectId);
        try {
            await updateDoc(subjectDocRef, {
                linkedClassroom: { id: linkingCourse.id, name: linkingCourse.name }
            });
            setNotification(`Successfully linked "${linkingCourse.name}".`);
        } catch (err) {
            setNotification("Failed to link subject.");
        } finally {
            setLinkingCourse(null);
        }
    };

    const handleUnlinkSubject = async (subjectId) => {
        if (!subjectId) return;
        const subjectDocRef = doc(db, `artifacts/${APP_ID}/users/${userId}/subjects`, subjectId);
        try {
            await updateDoc(subjectDocRef, { linkedClassroom: null });
            setNotification(`Successfully unlinked the subject.`);
        } catch (err) {
            setNotification("Failed to unlink subject.");
        }
    };

    const handleStudentSelect = (email) => {
        if (!email) return;
        const newSelection = new Set(selectedStudents);
        if (newSelection.has(email)) newSelection.delete(email);
        else newSelection.add(email);
        setSelectedStudents(newSelection);
    };

    const handleSelectAll = () => {
        const selectable = students.filter(s => s.profile?.emailAddress);
        if (selectedStudents.size === selectable.length) {
            setSelectedStudents(new Set());
        } else {
            setSelectedStudents(new Set(selectable.map(s => s.profile.emailAddress)));
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
            const email = [`Bcc: ${bccEmails}`, 'Content-Type: text/plain; charset="UTF-8"', 'MIME-Version: 1.0', `Subject: ${subject}`, '', body].join('\n');
            const base64EncodedEmail = btoa(email).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
            await window.gapi.client.gmail.users.messages.send({ 'userId': 'me', 'resource': { 'raw': base64EncodedEmail } });
            setNotification(`Email sent successfully to ${selectedStudents.size} student(s)!`);
        } catch (err) {
            setNotification("Failed to send email. Please ensure you have granted Gmail permissions.");
        } finally {
            setIsSending(false);
        }
    };

    const handleAssignTest = async () => {
        if (selectedStudents.size === 0) {
            setNotification("Please select at least one student to assign a test.");
            return;
        }

        const linkedSubject = subjects.find(s => s.linkedClassroom?.name === selectedCourseName);
        if (!linkedSubject) {
            setNotification("This Google Classroom course is not linked to a VaryTest subject. Please link it first.");
            return;
        }

        setIsAssigning(true);
        setNotification('');
        try {
            await addDoc(collection(db, 'assignmentRequests'), {
                teacherId: userId,
                appId: APP_ID,
                subjectId: linkedSubject.id,
                studentEmails: Array.from(selectedStudents),
                courseName: selectedCourseName,
                status: 'pending',
                createdAt: new Date(),
            });
            setNotification(`Test assignment request sent for ${selectedStudents.size} student(s). They will receive an email with their unique test shortly.`);
        } catch (err) {
            setNotification("Failed to create test assignment request.");
            console.error("Error creating assignment request:", err);
        } finally {
            setIsAssigning(false);
        }
    };


    return (
        <div className="bg-white p-8 rounded-lg shadow-md">
            {linkingCourse && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
                        <h3 className="text-lg font-bold mb-4">Link "{linkingCourse.name}" to a Subject</h3>
                        {availableSubjects.length > 0 ? (
                            <ul className="divide-y divide-gray-200">
                                {availableSubjects.map(sub => (
                                    <li key={sub.id} className="py-2 flex justify-between items-center">
                                        <span>{sub.name}</span>
                                        <button onClick={() => handleLinkSubject(sub.id)} className="bg-green-600 text-white px-3 py-1 rounded-md text-sm hover:bg-green-700">Link</button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-gray-600">No available subjects to link.</p>
                        )}
                        <button onClick={() => setLinkingCourse(null)} className="mt-4 w-full px-4 py-2 bg-gray-300 rounded-md hover:bg-gray-400">Cancel</button>
                    </div>
                </div>
            )}

            <div className="flex justify-between items-start mb-6 pb-6 border-b border-gray-200">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Connect with Google Classroom</h2>
                    <p className="text-sm text-gray-500">Link subjects and send email notifications.</p>
                </div>
                {isSignedIn ? (
                    <button onClick={onSignOut} className="bg-red-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-600">Sign Out of Google</button>
                ) : (
                    <button onClick={onSignIn} disabled={!isReady} className="bg-blue-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-600 disabled:bg-gray-400">Sign in with Google</button>
                )}
            </div>

            {error && <p className="text-red-500 mb-4">{error}</p>}
            {notification && <p className="text-green-600 mb-4 font-semibold">{notification}</p>}
            
            {isSignedIn && (
                 <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Your Active Courses:</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {courses.map(course => {
                            const linkedSubject = subjects.find(s => s.linkedClassroom?.id === course.id);
                            return (
                                <div key={course.id} className="border rounded-lg shadow-sm p-4 flex flex-col justify-between">
                                    <div onClick={() => onViewStudents(course.id, course.name)} className="cursor-pointer">
                                        <p className="text-lg font-bold text-indigo-700">{course.name}</p>
                                        <p className="text-sm text-gray-500 h-10">{course.descriptionHeading || 'No description'}</p>
                                    </div>
                                    <div className="mt-4 pt-4 border-t">
                                        {linkedSubject ? (
                                            <div className="text-center">
                                                <p className="text-sm text-gray-600">Linked to: <span className="font-semibold">{linkedSubject.name}</span></p>
                                                <button onClick={() => handleUnlinkSubject(linkedSubject.id)} className="mt-2 text-sm text-red-600 hover:underline">Unlink</button>
                                            </div>
                                        ) : (
                                            <button onClick={() => setLinkingCourse(course)} className="w-full bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700">Link to Subject</button>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {isLoading && <p>Loading...</p>}

            {students.length > 0 && (
                <div className="mt-8">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">Students in "{selectedCourseName}"</h3>
                    <div className="border border-gray-200 rounded-md">
                        <div className="px-6 py-3 bg-gray-50 flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center">
                                <input type="checkbox" onChange={handleSelectAll} checked={students.length > 0 && selectedStudents.size === students.filter(s => s.profile?.emailAddress).length} className="h-4 w-4 text-indigo-600 border-gray-300 rounded" />
                                <label className="ml-3 text-sm font-medium text-gray-900">Select All</label>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={handleSendEmail} disabled={isSending || selectedStudents.size === 0} className="bg-gray-600 text-white font-semibold py-2 px-3 rounded-lg hover:bg-gray-700 disabled:bg-gray-400 text-sm">
                                    {isSending ? 'Sending...' : `Send Email (${selectedStudents.size})`}
                                </button>
                                <button onClick={handleAssignTest} disabled={isAssigning || selectedStudents.size === 0} className="bg-green-600 text-white font-semibold py-2 px-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 text-sm">
                                    {isAssigning ? 'Assigning...' : `Assign Test (${selectedStudents.size})`}
                                </button>
                            </div>
                        </div>
                        <ul className="divide-y divide-gray-200">
                            {students.map(student => (
                                 <li key={student.userId} className="px-6 py-4 flex items-center">
                                    <input type="checkbox" checked={selectedStudents.has(student.profile?.emailAddress)} onChange={() => handleStudentSelect(student.profile?.emailAddress)} disabled={!student.profile?.emailAddress} className="h-4 w-4 text-indigo-600 border-gray-300 rounded" />
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
