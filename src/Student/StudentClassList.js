// src/Student/StudentClassList.js

import React, { useState, useEffect } from 'react';
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
// No need to import getCanvasAppId here, it's passed as prop APP_ID

function StudentClassList({ db, userId, APP_ID, userProfile }) {
  const [joinedClassesDetails, setJoinedClassesDetails] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [activeTest, setActiveTest] = useState(null); // { assignment, answers, submitting }
  const [testError, setTestError] = useState('');
  const [showPast, setShowPast] = useState(false);
  const [pastTests, setPastTests] = useState([]); // [{id, ...data}]
  const [selectedPast, setSelectedPast] = useState(null); // {id, ...data}

  useEffect(() => {
    let isCancelled = false;

    const fetchJoinedClassDetails = async () => {
      try {
        // Ensure userProfile and joinedClasses exist and are not empty
        if (!db || !userId || !APP_ID || !userProfile || !userProfile.joinedClasses || userProfile.joinedClasses.length === 0) {
          if (!isCancelled) {
            setJoinedClassesDetails([]);
            setLoadingClasses(false);
          }
          return;
        }

        setLoadingClasses(true);
        const classDetailsPromises = userProfile.joinedClasses.map(async (joinedClassInfo) => {
          try {
            const { classId, teacherId } = joinedClassInfo || {};
            if (!classId || !teacherId) {
              console.warn('Invalid joinedClassInfo:', joinedClassInfo);
              return null;
            }

            // Fetch the class document
            const classDocRef = doc(db, `artifacts/${APP_ID}/users/${teacherId}/classes`, classId);
            const classDocSnap = await getDoc(classDocRef);
            if (!classDocSnap.exists()) return null;

            const classData = classDocSnap.data();

            // Prefer denormalized subjectName on the class doc
            let subjectName = classData.subjectName || 'N/A';
            // Fallback: Try to fetch subject name when not denormalized; ignore permission errors
            if (!classData.subjectName && classData.linkedSubjectId) {
              try {
                const subjectDocRef = doc(db, `artifacts/${APP_ID}/users/${teacherId}/subjects`, classData.linkedSubjectId);
                const subjectDocSnap = await getDoc(subjectDocRef);
                if (subjectDocSnap.exists()) {
                  subjectName = subjectDocSnap.data().name;
                }
              } catch (err) {
                // Likely permission denied per rules; degrade gracefully
                console.debug('Subject read skipped:', err?.code || err?.message);
              }
            }
            return { id: classDocSnap.id, ...classData, subjectName };
          } catch (err) {
            console.error('Error fetching class details:', err);
            return null;
          }
        });

        const resolvedClassDetails = await Promise.allSettled(classDetailsPromises);
        const classes = resolvedClassDetails
          .filter(r => r.status === 'fulfilled' && r.value)
          .map(r => r.value);

        if (!isCancelled) {
          setJoinedClassesDetails(classes);
        }
      } finally {
        if (!isCancelled) setLoadingClasses(false);
      }
    };

    // Re-run this effect whenever db, userId, APP_ID, or userProfile (specifically joinedClasses) changes
    fetchJoinedClassDetails();
    return () => { isCancelled = true; };
  }, [db, userId, APP_ID, userProfile?.joinedClasses, userProfile]);

  if (loadingClasses) {
    return <p className="text-center text-gray-500">Loading your classes...</p>;
  }

  const openCurrentTest = async (cls) => {
    if (!db || !userId || !APP_ID) return;
    try {
      setTestError('');
      // Fetch for student+app, filter locally
      const q = query(
        collection(db, 'testAssignments'),
        where('studentUid', '==', userId),
        where('appId', '==', APP_ID)
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        setTestError('No active test for this class.');
        return;
      }
      // Filter by class and only Assigned (active) status
      const allowed = new Set(['Assigned']);
      const docs = snap.docs
        .map(d => ({ id: d.id, data: d.data() }))
        .filter(d => d.data.classId === cls.id && allowed.has(d.data.status));
      if (docs.length === 0) {
        setTestError('No active test for this class.');
        return;
      }
      // Sort by assignedAt desc (handle missing timestamps safely)
      docs.sort((a, b) => {
        const ta = a.data.assignedAt?.toMillis ? a.data.assignedAt.toMillis() : 0;
        const tb = b.data.assignedAt?.toMillis ? b.data.assignedAt.toMillis() : 0;
        return tb - ta;
      });
      const { id, data } = docs[0];
      const answers = Array.isArray(data.submittedAnswers) && data.submittedAnswers.length > 0
        ? data.submittedAnswers.slice()
        : Array.isArray(data.questions) ? new Array(data.questions.length).fill('') : [];
      setActiveTest({ id, assignment: data, answers, submitting: false });
    } catch (e) {
      console.error('openCurrentTest error', e);
      setTestError('Failed to load test.');
    }
  };

  const submitAnswers = async () => {
    if (!db || !activeTest) return;
    const { id, assignment, answers } = activeTest;
    try {
      setActiveTest(prev => ({ ...prev, submitting: true }));
      // Allow submission only if currently Assigned
      if (assignment.status !== 'Assigned') {
        setTestError('This test has already been submitted.');
        setActiveTest(prev => ({ ...prev, submitting: false }));
        return;
      }
      const ref = doc(db, 'testAssignments', id);
      await updateDoc(ref, {
        submittedAnswers: answers,
        status: 'Submitted',
      });
      // Close the active test UI and show confirmation; grading will follow
      setActiveTest(null);
      // eslint-disable-next-line no-alert
      alert('Your response has been received. You can review it in Past Tests.');
      // Optionally refresh past tests if panel is open
      if (showPast) {
        await loadPastTests();
      }
    } catch (e) {
      console.error('submitAnswers error', e);
      setTestError('Failed to submit answers.');
      setActiveTest(prev => ({ ...prev, submitting: false }));
    }
  };

  const loadPastTests = async () => {
    if (!db || !userId || !APP_ID) return;
    try {
      const q = query(
        collection(db, 'testAssignments'),
        where('studentUid', '==', userId),
        where('appId', '==', APP_ID)
      );
      const snap = await getDocs(q);
      const docs = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(d => d.status !== 'Assigned')
        .sort((a, b) => {
          const ta = a.assignedAt?.toMillis ? a.assignedAt.toMillis() : 0;
          const tb = b.assignedAt?.toMillis ? b.assignedAt.toMillis() : 0;
          return tb - ta;
        });
      setPastTests(docs);
    } catch (e) {
      console.error('loadPastTests error', e);
    }
  };

  return (
    <div className="mt-8">
      <h3 className="text-xl font-semibold text-indigo-700 mb-4">Your Joined Classes</h3>
      {testError && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded">{testError}</div>
      )}
      {/* Past Tests toggle and list */}
      <div className="mb-6">
        <button
          onClick={async () => { setShowPast((v) => !v); if (!showPast) await loadPastTests(); }}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded border text-sm"
        >
          {showPast ? 'Hide Past Tests' : 'Show Past Tests'}
        </button>
      </div>
      {showPast && (
        <div className="mb-8 bg-white p-4 rounded shadow">
          {pastTests.length === 0 ? (
            <p className="text-sm text-gray-500">No past tests found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Class</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200 text-sm">
                  {pastTests.map(t => (
                    <tr key={t.id}>
                      <td className="px-4 py-2">{t.courseName || 'Class'}</td>
                      <td className="px-4 py-2">{t.status}</td>
                      <td className="px-4 py-2">{t.status === 'Graded' ? `${t.score} / ${t.questions?.length || 0}` : '-'}</td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => setSelectedPast(t)}
                          className="text-indigo-600 hover:text-indigo-800"
                        >View Details</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {selectedPast && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-2xl w-full">
            <h3 className="text-xl font-bold mb-4">Past Test - {selectedPast.courseName || 'Class'}</h3>
            <p className="text-sm text-gray-600 mb-3">Status: {selectedPast.status}</p>
            {selectedPast.status === 'Graded' && (
              <p className="text-sm text-gray-800 mb-4">Total: {selectedPast.score} / {selectedPast.questions?.length || 0}</p>
            )}
            <div className="border-t pt-4 max-h-96 overflow-y-auto">
              <ol className="list-decimal list-inside space-y-3">
                {(selectedPast.questions || []).map((q, idx) => {
                  const ans = selectedPast.submittedAnswers?.[idx] ?? '';
                  const correct = (q.correctOption ?? q.answer ?? '');
                  const isCorrect = String(ans).trim() === String(correct).trim();
                  return (
                    <li key={idx} className="bg-gray-50 p-3 rounded">
                      <p className="mb-2">{q.text}</p>
                      <p className="text-sm"><strong>Your answer:</strong> <span className="font-mono">{ans || '—'}</span></p>
                      <p className="text-sm"><strong>Correct answer:</strong> <span className="font-mono text-green-700">{correct}</span></p>
                      <p className={`text-xs ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>{isCorrect ? 'Correct' : 'Incorrect'}</p>
                    </li>
                  );
                })}
              </ol>
            </div>
            <button onClick={() => setSelectedPast(null)} className="mt-6 w-full px-4 py-2 bg-gray-300 rounded-md hover:bg-gray-400">
              Close
            </button>
          </div>
        </div>
      )}
      {activeTest && (
        <div className="mb-6 p-4 border rounded-lg bg-white shadow">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-lg font-semibold">Current Test - {activeTest.assignment?.courseName || 'Class'} ({activeTest.assignment?.questions?.length || 0} questions)</h4>
            <button
              onClick={() => setActiveTest(null)}
              className="text-sm text-gray-600 hover:text-gray-800"
            >Close</button>
          </div>
          {activeTest.assignment?.status !== 'Assigned' && (
            <p className="text-sm text-gray-600 mb-2">Status: {activeTest.assignment.status}</p>
          )}
          <ol className="list-decimal list-inside space-y-3">
            {(activeTest.assignment?.questions || []).map((q, idx) => (
              <li key={idx} className="border-t pt-3">
                <p className="mb-2">{q.text}</p>
                {Array.isArray(q.options) && q.options.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {q.options.map((opt, oi) => {
                      const selected = String(activeTest.answers[idx] || '') === String(opt);
                      return (
                        <button
                          key={oi}
                          type="button"
                          disabled={activeTest.assignment?.status !== 'Assigned'}
                          onClick={() => {
                            setActiveTest(prev => {
                              const next = prev ? { ...prev } : prev;
                              if (!next) return prev;
                              const a = next.answers.slice();
                              a[idx] = String(opt);
                              next.answers = a;
                              return next;
                            });
                          }}
                          className={`px-3 py-2 border rounded text-left ${selected ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white hover:bg-gray-50'}`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={activeTest.answers[idx]}
                    onChange={(e) => {
                      const v = e.target.value;
                      setActiveTest(prev => {
                        const next = prev ? { ...prev } : prev;
                        if (!next) return prev;
                        const a = next.answers.slice();
                        a[idx] = v;
                        next.answers = a;
                        return next;
                      });
                    }}
                    disabled={activeTest.assignment?.status !== 'Assigned'}
                    className="mt-1 w-full px-3 py-2 border rounded"
                    placeholder="Enter your answer"
                  />
                )}
              </li>
            ))}
          </ol>
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {activeTest.assignment?.status === 'Graded' && (
                <span>Score: {activeTest.assignment.score}</span>
              )}
            </div>
            <button
              onClick={submitAnswers}
              disabled={activeTest.submitting || activeTest.assignment?.status !== 'Assigned'}
              className={`px-4 py-2 rounded text-white ${activeTest.assignment?.status === 'Assigned' ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-300'}`}
            >
              {activeTest.submitting ? 'Submitting…' : 'Submit Answers'}
            </button>
          </div>
        </div>
      )}
      {joinedClassesDetails.length === 0 ? (
        <p className="text-center text-gray-500">You haven't joined any classes yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {joinedClassesDetails.map(cls => (
            <div key={cls.id} className="bg-white border border-gray-200 rounded-lg shadow-md p-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-2">{cls.name}</h4>
              <p className="text-sm text-indigo-600 font-medium bg-indigo-50 px-3 py-1 rounded-full inline-block">
                Code: {cls.uniqueCode}
              </p>
              <p className="text-sm text-gray-700 mt-2">Subject: {cls.subjectName}</p>
              <p className="text-xs text-gray-500 mt-4">
                Teacher ID: {cls.teacherId}
              </p>
              <button
                onClick={() => openCurrentTest(cls)}
                className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200"
              >
                View Current Test
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default StudentClassList;
