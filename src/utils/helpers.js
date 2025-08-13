/* global __firebase_config, __app_id, __initial_auth_token */
// src/utils/helpers.js

// Helper function to insert text into an input/textarea at the current cursor position
export const insertTextAtCursor = (inputRef, textToInsert, setTextState, cursorOffset = 0) => {
  const input = inputRef.current;
  if (!input) return;

  const start = input.selectionStart;
  const end = input.selectionEnd;
  const value = input.value;

  const newValue = value.substring(0, start) + textToInsert + value.substring(end);
  setTextState(newValue); // Update React state

  // Use a setTimeout to ensure the DOM has updated before setting selection
  setTimeout(() => {
    input.selectionStart = input.selectionEnd = start + textToInsert.length - cursorOffset;
    input.focus(); // Keep focus on the input after insertion
  }, 0);
};

// Helper functions to safely access Canvas-specific global variables,
// providing fallbacks for local builds. This satisfies ESLint's no-undef rule.
export const getCanvasFirebaseConfigJson = () => typeof __firebase_config !== 'undefined' ? __firebase_config : null;
export const getCanvasAppId = () => typeof __app_id !== 'undefined' ? __app_id : null;
export const getCanvasInitialAuthToken = () => typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
