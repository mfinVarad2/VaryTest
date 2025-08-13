// src/Teacher/SubjectList.js

import React, { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';

function SubjectList({ db, userId, onSelectSubject, APP_ID, subjects }) { // Receive subjects as a prop
  const [newSubjectName, setNewSubjectName] = useState('');
  const [isAddingSubject, setIsAddingSubject] = useState(false);
  const [showAllSubjects, setShowAllSubjects] = useState(false);

  // We no longer need to fetch subjects here, as they are passed down from TeacherDashboard
  const allSubjects = subjects;
  const subjectsToDisplay = showAllSubjects ? allSubjects : allSubjects.slice(0, 5);

  const handleAddSubject = async (e) => {
    e.preventDefault();
    if (!newSubjectName.trim()) return;

    setIsAddingSubject(true);
    try {
      const subjectsCollectionRef = collection(db, `artifacts/${APP_ID}/users/${userId}/subjects`);
      await addDoc(subjectsCollectionRef, {
        name: newSubjectName.trim(),
        createdAt: new Date(),
        linkedClassroom: null // Initialize with no link
      });
      setNewSubjectName('');
    } catch (e) {
      console.error("Error adding subject:", e);
    } finally {
      setIsAddingSubject(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleAddSubject} className="mb-8 p-6 bg-indigo-50 rounded-lg shadow-inner">
        <h3 className="text-xl font-semibold text-indigo-700 mb-4">Create New Subject</h3>
        <div className="mb-4">
          <label htmlFor="subjectName" className="block text-sm font-medium text-gray-700 mb-1">Subject Name</label>
          <input
            type="text"
            id="subjectName"
            value={newSubjectName}
            onChange={(e) => setNewSubjectName(e.target.value)}
            placeholder="e.g., Mathematics"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            required
          />
        </div>
        <button
          type="submit"
          className="w-full md:w-auto px-6 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
          disabled={isAddingSubject}
        >
          {isAddingSubject ? 'Adding...' : 'Add Subject'}
        </button>
      </form>

      {allSubjects.length === 0 ? (
        <p className="text-center text-gray-500 py-8">No subjects created yet.</p>
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
                className="bg-white border border-gray-200 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 cursor-pointer p-6"
              >
                <div className="flex justify-between items-start">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">{subject.name}</h3>
                    {/* ** NEW: Show link indicator ** */}
                    {subject.linkedClassroom && (
                        <span title={`Linked to ${subject.linkedClassroom.name}`} className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                            Linked
                        </span>
                    )}
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
                className="px-6 py-3 bg-gray-700 text-white rounded-md shadow-md hover:bg-gray-800"
              >
                {showAllSubjects ? 'Show Recent' : `View All (${allSubjects.length})`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default SubjectList;
