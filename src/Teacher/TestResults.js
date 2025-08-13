// src/Teacher/TestResults.js

import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export default function TestResults({ db, userId }) {
    const [assignments, setAssignments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedAssignment, setSelectedAssignment] = useState(null); // For the details modal

    useEffect(() => {
        if (!db || !userId) return;

        setIsLoading(true);
        const assignmentsRef = collection(db, 'testAssignments');
        // Query for all test assignments created by the current teacher
        const q = query(assignmentsRef, where("teacherId", "==", userId));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedAssignments = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            // Sort by date, newest first
            fetchedAssignments.sort((a, b) => (b.assignedAt?.toDate() || 0) - (a.assignedAt?.toDate() || 0));
            setAssignments(fetchedAssignments);
            setIsLoading(false);
        }, (err) => {
            console.error("Error fetching test assignments:", err);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [db, userId]);

    const getStatusChip = (status) => {
        switch (status) {
            case 'Graded':
                return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Graded</span>;
            case 'Assigned':
                return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">Assigned</span>;
            default:
                return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">{status}</span>;
        }
    };

    return (
        <div className="bg-white p-8 rounded-lg shadow-md">
            {/* Details Modal */}
            {selectedAssignment && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white p-6 rounded-lg shadow-xl max-w-2xl w-full">
                        <h3 className="text-xl font-bold mb-4">Test Details</h3>
                        <div className="mb-4">
                            <p><strong>Student:</strong> {selectedAssignment.studentEmail}</p>
                            <p><strong>Course:</strong> {selectedAssignment.courseName}</p>
                            <p><strong>Final Score:</strong> {selectedAssignment.score} / {selectedAssignment.questions.length}</p>
                        </div>
                        <div className="border-t pt-4">
                            <h4 className="font-semibold mb-2">Question Breakdown:</h4>
                            <ul className="space-y-4 max-h-80 overflow-y-auto">
                                {selectedAssignment.questions.map((q, index) => {
                                    const studentAnswer = selectedAssignment.submittedAnswers[index] || "No answer submitted";
                                    const isCorrect = studentAnswer.trim().toLowerCase() === q.answer.trim().toLowerCase();
                                    return (
                                        <li key={index} className="p-3 bg-gray-50 rounded-md">
                                            <p className="font-medium text-gray-800">Q{index + 1}: {q.text}</p>
                                            <p className="text-sm mt-2"><strong>Correct Answer:</strong> <span className="font-mono text-green-700">{q.answer}</span></p>
                                            <p className={`text-sm ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                                                <strong>Student's Answer:</strong> <span className="font-mono">{studentAnswer}</span>
                                            </p>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                        <button onClick={() => setSelectedAssignment(null)} className="mt-6 w-full px-4 py-2 bg-gray-300 rounded-md hover:bg-gray-400">
                            Close
                        </button>
                    </div>
                </div>
            )}

            <h2 className="text-2xl font-bold text-gray-800 mb-6">Test Results & Analytics</h2>
            
            {isLoading ? (
                <p>Loading test results...</p>
            ) : assignments.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No tests have been assigned yet.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Assigned</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {assignments.map(assignment => (
                                <tr key={assignment.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{assignment.studentEmail}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{assignment.courseName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getStatusChip(assignment.status)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {assignment.status === 'Graded' ? `${assignment.score} / ${assignment.questions.length}` : 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{assignment.assignedAt.toDate().toLocaleString()}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        {assignment.status === 'Graded' && (
                                            <button onClick={() => setSelectedAssignment(assignment)} className="text-indigo-600 hover:text-indigo-900">
                                                View Details
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
