// src/Teacher/QuestionBank.js

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import DynamicQuestionForm from './DynamicQuestionForm'; // Import DynamicQuestionForm
// No need to import getCanvasAppId here, it's passed as prop APP_ID

function QuestionBank({ db, userId, subject, onBack, APP_ID }) {
  const [allQuestions, setAllQuestions] = useState([]); // Stores all questions for the subject
  const [showAddQuestionForm, setShowAddQuestionForm] = useState(false);
  const [showAllQuestions, setShowAllQuestions] = useState(false); // State to toggle between recent and all
  const [editing, setEditing] = useState(null); // question object when editing

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
        Question Bank for <span className="text-indigo-900">{subject.name}</span>
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

      {showAddQuestionForm && !editing && (
        <DynamicQuestionForm
          db={db}
          userId={userId}
          subjectId={subject.id}
          APP_ID={APP_ID}
          onQuestionAdded={() => setShowAddQuestionForm(false)}
        />
      )}

      {editing && (
        <div className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-indigo-700">Edit Question</h3>
            <button
              className="text-sm text-gray-600 hover:text-gray-800"
              onClick={() => setEditing(null)}
            >Close</button>
          </div>
          <DynamicQuestionForm
            db={db}
            userId={userId}
            subjectId={subject.id}
            APP_ID={APP_ID}
            editQuestion={editing}
            onQuestionUpdated={() => setEditing(null)}
            onCancel={() => setEditing(null)}
          />
        </div>
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
                  <th scope="col" className="px-6 py-3"/>
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
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <button
                        onClick={() => setEditing(question)}
                        className="px-3 py-1 bg-white border rounded hover:bg-gray-50"
                      >Edit</button>
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

export default QuestionBank;
