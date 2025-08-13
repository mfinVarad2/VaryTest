// src/Student/StudentClassList.js

import React, { useState, useEffect } from 'react';
import { collection, doc, getDoc } from 'firebase/firestore'; // Removed getDocs as it's not needed here
// No need to import getCanvasAppId here, it's passed as prop APP_ID

function StudentClassList({ db, userId, APP_ID, userProfile }) {
  const [joinedClassesDetails, setJoinedClassesDetails] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(true);

  useEffect(() => {
    const fetchJoinedClassDetails = async () => {
      // Ensure userProfile and joinedClasses exist and are not empty
      if (!db || !userId || !APP_ID || !userProfile || !userProfile.joinedClasses || userProfile.joinedClasses.length === 0) {
        setJoinedClassesDetails([]);
        setLoadingClasses(false);
        return;
      }

      setLoadingClasses(true);
      const classDetailsPromises = userProfile.joinedClasses.map(async (joinedClassInfo) => {
        // joinedClassInfo is now an object: { classId: '...', teacherId: '...' }
        const { classId, teacherId } = joinedClassInfo;

        if (!classId || !teacherId) {
          console.warn("Invalid joinedClassInfo:", joinedClassInfo);
          return null;
        }

        // Directly fetch the class document using the stored teacherId
        const classDocRef = doc(db, `artifacts/${APP_ID}/users/${teacherId}/classes`, classId);
        const classDocSnap = await getDoc(classDocRef);

        if (classDocSnap.exists()) {
          const classData = classDocSnap.data();
          // Fetch subject name
          let subjectName = 'N/A';
          if (classData.linkedSubjectId) {
            const subjectDocRef = doc(db, `artifacts/${APP_ID}/users/${teacherId}/subjects`, classData.linkedSubjectId);
            const subjectDocSnap = await getDoc(subjectDocRef);
            if (subjectDocSnap.exists()) {
              subjectName = subjectDocSnap.data().name;
            }
          }
          return { id: classDocSnap.id, ...classData, subjectName };
        }
        return null; // Class document not found or inaccessible
      });

      const resolvedClassDetails = await Promise.all(classDetailsPromises);
      setJoinedClassesDetails(resolvedClassDetails.filter(Boolean)); // Filter out nulls
      setLoadingClasses(false);
    };

    // Re-run this effect whenever db, userId, APP_ID, or userProfile (specifically joinedClasses) changes
    fetchJoinedClassDetails();
  }, [db, userId, APP_ID, userProfile?.joinedClasses]); // Depend on userProfile.joinedClasses to trigger re-fetch

  if (loadingClasses) {
    return <p className="text-center text-gray-500">Loading your classes...</p>;
  }

  return (
    <div className="mt-8">
      <h3 className="text-xl font-semibold text-indigo-700 mb-4">Your Joined Classes</h3>
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
              <button className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200">
                Current Test (Coming Soon!)
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default StudentClassList;
