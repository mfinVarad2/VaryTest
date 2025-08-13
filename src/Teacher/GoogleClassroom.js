// src/Teacher/GoogleClassroom.js

import React from 'react';

// This is now a "presentational" component. It receives all state and functions as props.
export default function GoogleClassroom({
    isReady,
    isSignedIn,
    courses,
    students,
    selectedCourse,
    isLoading,
    error,
    onSignIn,
    onSignOut,
    onFetchStudents
}) {

    if (error) {
        return (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert">
                <p className="font-bold">Error</p>
                <p>{error}</p>
            </div>
        );
    }

    return (
        <div className="bg-white p-8 rounded-lg shadow-md">
            <div className="flex justify-between items-start mb-6 pb-6 border-b border-gray-200">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Google Classroom Roster</h2>
                    <p className="text-sm text-gray-500">Sign in to fetch student lists from your active courses.</p>
                </div>
                {!isReady ? (
                     <div className="text-gray-500">Loading Google API...</div>
                ) : isSignedIn ? (
                    <button onClick={onSignOut} className="bg-red-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-600 transition-colors">
                        Sign Out of Google
                    </button>
                ) : (
                    <button onClick={onSignIn} className="bg-blue-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors">
                        Sign in with Google
                    </button>
                )}
            </div>

            {isSignedIn && (
                <div>
                    <div className="mb-6">
                        <label htmlFor="course-select" className="block text-sm font-medium text-gray-700 mb-2">
                            Select a Course:
                        </label>
                        <select
                            id="course-select"
                            onChange={(e) => onFetchStudents(e.target.value)}
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                            disabled={isLoading || !courses || courses.length === 0}
                            value={selectedCourse ? selectedCourse.id : ''}
                        >
                            <option value="">{isLoading ? 'Loading courses...' : (courses.length > 0 ? 'Select a course' : 'No active courses found')}</option>
                            {courses && courses.map(course => (
                                <option key={course.id} value={course.id}>{course.name}</option>
                            ))}
                        </select>
                    </div>

                    {selectedCourse && (
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">
                                Students in "{selectedCourse.name}" ({students?.length || 0})
                            </h3>
                            {isLoading ? <p>Loading students...</p> : (
                                <ul className="divide-y divide-gray-200 border border-gray-200 rounded-md">
                                    {students && students.length > 0 ? students.map(student => (
                                        <li key={student.userId} className="px-6 py-4 flex items-center justify-between">
                                            <div className="flex items-center">
                                                 <img className="h-10 w-10 rounded-full mr-4" src={student.profile.photoUrl} alt="" />
                                                 <div>
                                                    <p className="text-sm font-medium text-gray-900">{student.profile.name.fullName}</p>
                                                    <p className="text-sm text-gray-500">{student.profile.emailAddress}</p>
                                                 </div>
                                            </div>
                                        </li>
                                    )) : <p className="p-4 text-gray-500">No students found in this course.</p>}
                                </ul>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
