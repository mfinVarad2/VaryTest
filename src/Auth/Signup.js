// src/Auth/Signup.js

import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

function Signup({ db, auth, onSignupSuccess }) {
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Teacher'); // Default role is Teacher
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    if (!agreeTerms) {
      setError("You must agree to the terms and conditions.");
      return;
    }

    setLoading(true);
    try {
      // 1. Create user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Save additional user profile data to Firestore
      await setDoc(doc(db, 'users', user.uid), {
        name: name.trim(),
        surname: surname.trim(),
        email: email.trim(),
        role: role, // Save the selected role
        createdAt: new Date(),
        // Initialize joinedClasses as an empty array for students
        // It will store objects like { classId: '...', teacherId: '...' }
        ...(role === 'Student' && { joinedClasses: [] })
      });

      onSignupSuccess(); // Navigate to login tab
    } catch (e) {
      console.error("Signup error:", e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSignup} className="space-y-4">
      <h2 className="text-2xl font-bold text-center text-indigo-700 mb-6">Sign Up for VaryTest</h2>
      {error && <p className="text-red-500 text-sm text-center">{error}</p>}
      <div>
        <label htmlFor="signupName" className="sr-only">Name</label>
        <input
          type="text"
          id="signupName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="First Name"
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          required
        />
      </div>
      <div>
        <label htmlFor="signupSurname" className="sr-only">Surname</label>
        <input
          type="text"
          id="signupSurname"
          value={surname}
          onChange={(e) => setSurname(e.target.value)}
          placeholder="Last Name"
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          required
        />
      </div>
      <div>
        <label htmlFor="signupEmail" className="sr-only">Email</label>
        <input
          type="email"
          id="signupEmail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email Address"
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          required
        />
      </div>
      <div>
        <label htmlFor="signupPassword" className="sr-only">Password</label>
        <input
          type="password"
          id="signupPassword"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Set Password (min 6 characters)"
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          required
        />
      </div>
      <div>
        <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">Role</label>
        <select
          id="role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="Teacher">Teacher</option>
          <option value="Student">Student</option> {/* Added Student role */}
          <option value="Admin">Admin</option>
        </select>
      </div>
      <div className="flex items-center">
        <input
          type="checkbox"
          id="agreeTerms"
          checked={agreeTerms}
          onChange={(e) => setAgreeTerms(e.target.checked)}
          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
          required
        />
        <label htmlFor="agreeTerms" className="ml-2 block text-sm text-gray-900">
          I agree to the <a href="/terms" className="text-indigo-600 hover:underline">terms & conditions</a>
        </label>
      </div>
      <button
        type="submit"
        className="w-full bg-green-600 text-white py-2 rounded-md font-semibold hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-200"
        disabled={loading}
      >
        {loading ? 'Signing Up...' : 'Sign Up'}
      </button>
    </form>
  );
}

export default Signup;
