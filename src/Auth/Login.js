// src/Auth/Login.js

import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';

function Login({ auth }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Auth state change listener in App.js will handle redirect
    } catch (e) {
      console.error("Login error:", e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      <h2 className="text-2xl font-bold text-center text-indigo-700 mb-6">Login to VaryTest</h2>
      {error && <p className="text-red-500 text-sm text-center">{error}</p>}
      <div>
        <label htmlFor="loginEmail" className="sr-only">Email</label>
        <input
          type="email"
          id="loginEmail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email Address"
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          required
        />
      </div>
      <div>
        <label htmlFor="loginPassword" className="sr-only">Password</label>
        <input
          type="password"
          id="loginPassword"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          required
        />
      </div>
      <button
        type="submit"
        className="w-full bg-indigo-600 text-white py-2 rounded-md font-semibold hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
        disabled={loading}
      >
        {loading ? 'Logging In...' : 'Login'}
      </button>
    </form>
  );
}

export default Login;
