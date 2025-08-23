// src/Student/JoinClass.js

import React, { useState } from 'react';
import {
  collectionGroup,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  arrayUnion
} from 'firebase/firestore';

function JoinClass({ db, userId, APP_ID, userProfile }) {
  const [classCode, setClassCode] = useState('');
  const [joinMessage, setJoinMessage] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const handleJoinClass = async (e) => {
    e.preventDefault();
    setJoinMessage('');
    if (!classCode.trim()) {
      setJoinMessage("Please enter a class code.");
      return;
    }
    setIsJoining(true);

    try {
      // 🔍 Search for the class using collectionGroup query
      const classesCollectionGroupRef = collectionGroup(db, 'classes');
      const q = query(
        classesCollectionGroupRef,
        where("uniqueCode", "==", classCode.trim().toUpperCase()),
        where("isJoinable", "==", true)
      );
      const classSnapshot = await getDocs(q);

      if (classSnapshot.empty) {
        setJoinMessage("Class not found. Please check the code.");
        setIsJoining(false);
        return;
      }

      const foundClassDoc = classSnapshot.docs[0];
      const foundClass = { id: foundClassDoc.id, ...foundClassDoc.data() };
      const teacherIdOfClass = foundClass.teacherId;

      if (!foundClass.isJoinable) {
        setJoinMessage("This class is currently not open for new students to join.");
        setIsJoining(false);
        return;
      }

      const alreadyJoined =
        userProfile.joinedClasses &&
        userProfile.joinedClasses.some(
          (joinedClass) =>
            joinedClass.classId === foundClass.id &&
            joinedClass.teacherId === teacherIdOfClass
        );

      if (alreadyJoined) {
        setJoinMessage("You have already joined this class.");
        setIsJoining(false);
        return;
      }

      // ✅ Update only the 'students' field — aligns with Firestore rule using changedKeys()
      const classDocRef = doc(
        db,
        `artifacts/${APP_ID}/users/${teacherIdOfClass}/classes`,
        foundClass.id
      );
      await updateDoc(classDocRef, {
        students: arrayUnion(userId)
      });

      // ✅ Update student's own profile — allowed by rule
      const studentProfileRef = doc(db, 'users', userId);
      await updateDoc(studentProfileRef, {
        joinedClasses: arrayUnion({
          classId: foundClass.id,
          teacherId: teacherIdOfClass
        })
      });

      setJoinMessage(`✅ Successfully joined class: ${foundClass.name}`);
      setClassCode('');
    } catch (e) {
      console.error("Error joining class:", e);
      if (e.code === 'permission-denied') {
        setJoinMessage("❌ Failed to join class: Permissions denied. Please check Firebase Security Rules.");
      } else if (e.code === 'failed-precondition') {
        setJoinMessage("⚠️ Failed to join class: A database index is required. Check browser console for a link to create it.");
      } else {
        setJoinMessage("🚨 An unexpected error occurred while trying to join the class.");
      }
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="mb-8 p-6 bg-purple-50 rounded-lg shadow-inner">
      <h3 className="text-xl font-semibold text-purple-700 mb-4">Join a Class</h3>
      <form onSubmit={handleJoinClass} className="flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          value={classCode}
          onChange={(e) => setClassCode(e.target.value)}
          placeholder="Enter Class Code (e.g., ABC123)"
          className="flex-grow px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
          required
        />
        <button
          type="submit"
          className="px-6 py-2 bg-purple-600 text-white rounded-md shadow-sm hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors duration-200"
          disabled={isJoining}
        >
          {isJoining ? 'Joining...' : 'Join Class'}
        </button>
      </form>
      {joinMessage && (
        <p className="mt-4 text-sm text-center font-medium text-gray-700">
          {joinMessage}
        </p>
      )}
    </div>
  );
}

export default JoinClass;
