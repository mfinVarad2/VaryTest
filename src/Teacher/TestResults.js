// src/Teacher/TestResults.js

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export default function TestResults({ db, userId }) {
    const [assignments, setAssignments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [detailsGroup, setDetailsGroup] = useState(null); // { key, className, subjectId, rows }

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

    // Group by (classId, subjectId) for summary
    const groups = useMemo(() => {
        const map = new Map();
        assignments.forEach(a => {
            const key = `${a.classId || 'no-class'}|${a.subjectId || 'no-subject'}`;
            if (!map.has(key)) map.set(key, { key, classId: a.classId, subjectId: a.subjectId, className: a.courseName || 'Class', rows: [], total: 0, attempted: 0 });
            const g = map.get(key);
            g.rows.push(a);
            g.total += 1;
            if (a.status === 'Submitted' || a.status === 'Graded') g.attempted += 1;
        });
        return Array.from(map.values());
    }, [assignments]);

    return (
        <div className="bg-white p-8 rounded-lg shadow-md">
                        {/* Details Modal: per-group student list */}
                        {detailsGroup && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white p-6 rounded-lg shadow-xl max-w-2xl w-full">
                                                <h3 className="text-xl font-bold mb-4">Test Results - {detailsGroup.className}</h3>
                                                <div className="overflow-x-auto">
                                                    <table className="min-w-full divide-y divide-gray-200">
                                                        <thead className="bg-gray-50">
                                                            <tr>
                                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="bg-white divide-y divide-gray-200">
                                                            {detailsGroup.rows.map(r => (
                                                                <tr key={r.id}>
                                                                    <td className="px-4 py-2 text-sm">{r.studentEmail || r.studentUid}</td>
                                                                    <td className="px-4 py-2 text-sm">{getStatusChip(r.status)}</td>
                                                                    <td className="px-4 py-2 text-sm">{r.status === 'Graded' ? `${r.score} / ${r.questions.length}` : '-'}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                                <button onClick={() => setDetailsGroup(null)} className="mt-6 w-full px-4 py-2 bg-gray-300 rounded-md hover:bg-gray-400">
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
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attempted / Total</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {groups.map(g => (
                                                <tr key={g.key}>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{g.className}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{g.subjectId}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{g.attempted} / {g.total}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                        <button onClick={() => setDetailsGroup(g)} className="text-indigo-600 hover:text-indigo-900">View Details</button>
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
