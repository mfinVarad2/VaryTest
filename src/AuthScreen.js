// src/AuthScreen.js

import React, { useState } from 'react';
import Login from './Auth/Login';
import Signup from './Auth/Signup';

function AuthScreen({ db, auth }) {
  const [showLogin, setShowLogin] = useState(true);

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-xl">
      <div className="flex justify-center mb-6">
        <button
          onClick={() => setShowLogin(true)}
          className={`px-6 py-2 rounded-l-lg font-semibold ${showLogin ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
        >
          Login
        </button>
        <button
          onClick={() => setShowLogin(false)}
          className={`px-6 py-2 rounded-r-lg font-semibold ${!showLogin ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
        >
          Sign Up
        </button>
      </div>

      {showLogin ? (
        <Login auth={auth} />
      ) : (
        <Signup db={db} auth={auth} onSignupSuccess={() => setShowLogin(true)} />
      )}
    </div>
  );
}

export default AuthScreen;
