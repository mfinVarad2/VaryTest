// src/Student/StudentDashboard.js

import React from 'react';
import JoinClass from './JoinClass'; // Assuming JoinClass.js is also in src/Student/
import StudentClassList from './StudentClassList'; // Assuming StudentClassList.js is also in src/Student/

function StudentDashboard({ db, userId, APP_ID, userProfile }) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-indigo-600 mb-6">Student Dashboard</h2>
      <JoinClass db={db} userId={userId} APP_ID={APP_ID} userProfile={userProfile} />
      <StudentClassList db={db} userId={userId} APP_ID={APP_ID} userProfile={userProfile} />
    </div>
  );
}

export default StudentDashboard;
