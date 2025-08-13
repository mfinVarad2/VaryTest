// src/Teacher/ClassList.js

import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, where, doc, getDocs, deleteDoc, updateDoc } from 'firebase/firestore';
import { getCanvasAppId } from '../utils/helpers'; // Import getCanvasAppId

function ClassList({ db, userId, APP_ID }) {
  const [classes, setClasses] = useState([]);
  const [newClassName, setNewClassName] = useState('');
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [isAddingClass, setIsAddingClass] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [editingClassId, setEditingClassId] = useState(null);
  const [editedClassName, setEditedClassName] = useState('');
  const [editedLinkedSubjectId, setEditedLinkedSubjectId] = useState('');
  const [deletingClassId, setDeletingClassId] = useState(null);

  // Fetch all subjects to populate the dropdown for linking
  useEffect(() => {
    if (!db || !userId || !APP_ID) return;
    const subjectsCollectionRef = collection(db, `artifacts/${APP_ID}/users/${userId}/subjects`);
    const q = query(subjectsCollectionRef);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedSubjects = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name
      }));
      setAvailableSubjects(fetchedSubjects);
      if (fetchedSubjects.length > 0 && !selectedSubjectId) {
        setSelectedSubjectId(fetchedSubjects[0].id); // Auto-select first subject
      }
    }, (err) => {
      console.error("Error fetching available subjects:", err);
    });
    return () => unsubscribe();
  }, [db, userId, APP_ID, selectedSubjectId]);

  // Fetch classes for the current teacher
  useEffect(() => {
    if (!db || !userId || !APP_ID) return;
    const classesCollectionRef = collection(db, `artifacts/${APP_ID}/users/${userId}/classes`);
    const q = query(classesCollectionRef);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedClasses = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setClasses(fetchedClasses);
    }, (err) => {
      console.error("Error fetching classes:", err);
    });
    return () => unsubscribe();
  }, [db, userId, APP_ID]);

  // Function to generate a simple unique alphanumeric code
  const generateUniqueCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase(); // 6-character alphanumeric
  };

  const handleAddClass = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    if (!newClassName.trim()) {
      setErrorMessage("Class Name cannot be empty.");
      return;
    }
    if (!selectedSubjectId) {
      setErrorMessage("Please link a subject to the class.");
      return;
    }

    setIsAddingClass(true);
    try {
      let uniqueCode = generateUniqueCode();
      // Basic check for code uniqueness (client-side, for display. Server-side check is more robust)
      // For a real app, you'd check Firestore for uniqueness before adding.
      let isCodeUnique = false;
      let attempts = 0;
      while (!isCodeUnique && attempts < 10) { // Try a few times
        const q = query(collection(db, `artifacts/${APP_ID}/users/${userId}/classes`), where("uniqueCode", "==", uniqueCode));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
          isCodeUnique = true;
        } else {
          uniqueCode = generateUniqueCode();
        }
        attempts++;
      }
      if (!isCodeUnique) {
        setErrorMessage("Could not generate a unique class code. Please try again.");
        setIsAddingClass(false);
        return;
      }

      await addDoc(collection(db, `artifacts/${APP_ID}/users/${userId}/classes`), {
        name: newClassName.trim(),
        uniqueCode: uniqueCode,
        linkedSubjectId: selectedSubjectId,
        teacherId: userId,
        students: [], // Initially empty array of student UIDs
        isJoinable: true, // New field: class is joinable by default
        createdAt: new Date(),
      });
      setNewClassName('');
      setSelectedSubjectId(availableSubjects.length > 0 ? availableSubjects[0].id : '');
    } catch (e) {
      console.error("Error adding class:", e);
      setErrorMessage("Failed to add class. Please try again.");
    } finally {
      setIsAddingClass(false);
    }
  };

  const handleEditClass = (cls) => {
    setEditingClassId(cls.id);
    setEditedClassName(cls.name);
    setEditedLinkedSubjectId(cls.linkedSubjectId);
  };

  const handleSaveClassEdit = async (classId) => {
    if (!editedClassName.trim()) {
      console.warn("Class name cannot be empty.");
      return;
    }
    if (!editedLinkedSubjectId) {
      console.warn("Linked subject cannot be empty.");
      return;
    }
    try {
      const classDocRef = doc(db, `artifacts/${APP_ID}/users/${userId}/classes`, classId);
      await updateDoc(classDocRef, {
        name: editedClassName.trim(),
        linkedSubjectId: editedLinkedSubjectId,
      });
      setEditingClassId(null);
      setEditedClassName('');
      setEditedLinkedSubjectId('');
    } catch (e) {
      console.error("Error updating class:", e);
    }
  };

  const handleDeleteClass = async (classId) => {
    setDeletingClassId(classId); // Set for confirmation modal
  };

  const confirmDeleteClass = async () => {
    if (!deletingClassId) return;
    try {
      const classDocRef = doc(db, `artifacts/${APP_ID}/users/${userId}/classes`, deletingClassId);
      await deleteDoc(classDocRef);
      setDeletingClassId(null);
    } catch (e) {
      console.error("Error deleting class:", e);
      setDeletingClassId(null);
    }
  };

  const handleToggleJoinable = async (cls) => {
    try {
      const classDocRef = doc(db, `artifacts/${APP_ID}/users/${userId}/classes`, cls.id);
      await updateDoc(classDocRef, {
        isJoinable: !cls.isJoinable, // Toggle the boolean value
      });
    } catch (e) {
      console.error("Error toggling joinable status:", e);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-indigo-600 mb-6">Your Classes</h2>

      {/* Add New Class Form */}
      <form onSubmit={handleAddClass} className="mb-8 p-6 bg-indigo-50 rounded-lg shadow-inner">
        <h3 className="text-xl font-semibold text-indigo-700 mb-4">Create New Class</h3>
        {errorMessage && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
            <strong className="font-bold">Error!</strong>
            <span className="block sm:inline"> {errorMessage}</span>
          </div>
        )}
        <div className="mb-4">
          <label htmlFor="className" className="block text-sm font-medium text-gray-700 mb-1">Class Name</label>
          <input
            type="text"
            id="className"
            value={newClassName}
            onChange={(e) => setNewClassName(e.target.value)}
            placeholder="e.g., 10th Grade Math"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            required
          />
        </div>
        <div className="mb-4">
          <label htmlFor="linkedSubject" className="block text-sm font-medium text-gray-700 mb-1">Link Subject</label>
          {availableSubjects.length > 0 ? (
            <select
              id="linkedSubject"
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            >
              {availableSubjects.map(subject => (
                <option key={subject.id} value={subject.id}>{subject.name}</option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-gray-500">No subjects available. Please create a subject first.</p>
          )}
        </div>
        <button
          type="submit"
          className="w-full md:w-auto px-6 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
          disabled={isAddingClass || availableSubjects.length === 0}
        >
          {isAddingClass ? 'Adding Class...' : 'Add Class'}
        </button>
      </form>

      {/* List of Classes */}
      {classes.length === 0 ? (
        <p className="text-center text-gray-500 py-8">No classes created yet. Start by adding one above!</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes.map((cls) => (
            <div
              key={cls.id}
              className="bg-white border border-gray-200 rounded-lg shadow-md p-6"
            >
              {editingClassId === cls.id ? (
                <div className="w-full">
                  <label htmlFor={`editClassName-${cls.id}`} className="block text-sm font-medium text-gray-700 mb-1">Class Name</label>
                  <input
                    type="text"
                    id={`editClassName-${cls.id}`}
                    value={editedClassName}
                    onChange={(e) => setEditedClassName(e.target.value)}
                    className="w-full px-2 py-1 border rounded-md mb-2"
                  />
                  <label htmlFor={`editLinkedSubject-${cls.id}`} className="block text-sm font-medium text-gray-700 mb-1 mt-3">Linked Subject</label>
                  {availableSubjects.length > 0 ? (
                    <select
                      id={`editLinkedSubject-${cls.id}`}
                      value={editedLinkedSubjectId}
                      onChange={(e) => setEditedLinkedSubjectId(e.target.value)}
                      className="w-full px-2 py-1 border rounded-md mb-2"
                    >
                      {availableSubjects.map(subject => (
                        <option key={subject.id} value={subject.id}>{subject.name}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-sm text-gray-500">No subjects available.</p>
                  )}
                  <button
                    onClick={() => handleSaveClassEdit(cls.id)}
                    className="bg-green-500 text-white px-3 py-1 rounded-md text-sm mr-2 mt-4"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingClassId(null)}
                    className="bg-gray-300 text-gray-800 px-3 py-1 rounded-md text-sm mt-4"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="w-full">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{cls.name}</h3>
                  <p className="text-sm text-indigo-600 font-medium bg-indigo-50 px-3 py-1 rounded-full inline-block">
                    Code: {cls.uniqueCode}
                  </p>
                  <p className="text-sm text-gray-700 mt-2">
                    Linked Subject: {availableSubjects.find(s => s.id === cls.linkedSubjectId)?.name || 'N/A'}
                  </p>
                  <p className="text-sm text-gray-700 mt-2">
                    Joined Students: <span className="font-semibold">{cls.students?.length || 0}</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-4">
                    Created: {cls.createdAt?.toDate().toLocaleDateString() || 'N/A'}
                  </p>
                  <div className="mt-4 flex flex-wrap justify-end space-x-2">
                    <button
                      onClick={() => handleEditClass(cls)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium p-1"
                      title="Edit Class"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828L14.207 8.621l-2.828-2.828z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteClass(cls.id)}
                      className="text-red-600 hover:text-red-800 text-sm font-medium p-1"
                      title="Delete Class"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1zm2 3a1 1 0 011-1h2a1 1 0 110 2h-2a1 1 0 01-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleToggleJoinable(cls)}
                      className={`px-3 py-1 rounded-md text-sm font-medium ${cls.isJoinable ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' : 'bg-green-100 text-green-800 hover:bg-green-200'}`}
                      title={cls.isJoinable ? "Stop new students from joining" : "Allow new students to join"}
                    >
                      {cls.isJoinable ? 'Stop Joining' : 'Allow Joining'}
                    </button>
                    <button className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors duration-200 mt-2 sm:mt-0">
                      Assign Test
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal for Class */}
      {deletingClassId && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center">
          <div className="bg-white p-8 rounded-lg shadow-xl max-w-sm mx-auto">
            <h3 className="text-lg font-bold text-red-700 mb-4">Confirm Deletion</h3>
            <p className="mb-6">Are you sure you want to delete this class? This action cannot be undone.</p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setDeletingClassId(null)}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteClass}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ClassList;
