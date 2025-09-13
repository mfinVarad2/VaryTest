// src/Teacher/DynamicQuestionForm.js

import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore'; // add update for edit mode
import { insertTextAtCursor } from '../utils/helpers'; // Import insertTextAtCursor

// Function to safely evaluate mathematical expressions
function evaluateFormula(formula, variables) {
  try {
    // Replace variable placeholders with their values
    let processedFormula = formula;
    variables.forEach(v => {
      const varRegex = new RegExp(`\\b${v.name}\\b`, 'g');
      // If variable has multiple values, we'd need to handle this differently
      // For now, use the first non-empty value
      const value = v.values.find(val => val.trim() !== '') || '0';
      processedFormula = processedFormula.replace(varRegex, value);
    });

    // Handle trigonometric functions with degree inputs (convert to radians)
    // sin(x) -> Math.sin(x * Math.PI / 180)
    // Also handle square notation: sin²(x) -> Math.pow(Math.sin(x * Math.PI / 180), 2)
    processedFormula = processedFormula.replace(/sin²\(([^)]+)\)/g, 'Math.pow(Math.sin($1 * Math.PI / 180), 2)');
    processedFormula = processedFormula.replace(/cos²\(([^)]+)\)/g, 'Math.pow(Math.cos($1 * Math.PI / 180), 2)');
    processedFormula = processedFormula.replace(/tan²\(([^)]+)\)/g, 'Math.pow(Math.tan($1 * Math.PI / 180), 2)');

    processedFormula = processedFormula.replace(/sin\(([^)]+)\)/g, 'Math.sin($1 * Math.PI / 180)');
    processedFormula = processedFormula.replace(/cos\(([^)]+)\)/g, 'Math.cos($1 * Math.PI / 180)');
    processedFormula = processedFormula.replace(/tan\(([^)]+)\)/g, 'Math.tan($1 * Math.PI / 180)');

    // Handle other trigonometric functions
    processedFormula = processedFormula.replace(/cosec\(([^)]+)\)/g, '1/Math.sin($1 * Math.PI / 180)');
    processedFormula = processedFormula.replace(/sec\(([^)]+)\)/g, '1/Math.cos($1 * Math.PI / 180)');
    processedFormula = processedFormula.replace(/cot\(([^)]+)\)/g, '1/Math.tan($1 * Math.PI / 180)');

    // Replace other mathematical operators
    processedFormula = processedFormula.replace(/√/g, 'Math.sqrt');
    processedFormula = processedFormula.replace(/π/g, 'Math.PI');
    processedFormula = processedFormula.replace(/×/g, '*');
    processedFormula = processedFormula.replace(/÷/g, '/');

    // Evaluate the formula safely
    // Note: In a production environment, you might want to use a more secure evaluation library
    // than the built-in Function constructor
    const result = new Function('return ' + processedFormula)();

    return isNaN(result) ? 'undefined' : result;
  } catch (error) {
    console.error('Formula evaluation error:', error);
    return 'undefined';
  }
}

function DynamicQuestionForm({ db, userId, subjectId, onQuestionAdded, onQuestionUpdated, onCancel, APP_ID, editQuestion = null }) {
  const [questionText, setQuestionText] = useState('');
  const [variables, setVariables] = useState([]); // [{id: 'uuid', name: 'var_1', values: ['10', '20']}]
  const [formula, setFormula] = useState('');
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [computedResult, setComputedResult] = useState('');

  // Compute the result whenever formula or variables change
  useEffect(() => {
    if (formula.trim() === '') {
      setComputedResult('');
      return;
    }

    const result = evaluateFormula(formula, variables);
    setComputedResult(result);
  }, [formula, variables]);
  const nextVarIndex = useRef(1); // To keep track of the next 'var_X' to generate

  // Refs for managing cursor position in textareas/inputs
  const questionTextRef = useRef(null);
  const formulaRef = useRef(null);

  // Define mathematical operators and functions
  const mathOperators = ['+', '-', '*', '/', '^', '(', ')', '!'];
  const mathFunctions = ['sin()', 'cos()', 'tan()', 'cosec()', 'sec()', 'cot()'];

  // Symbols and unicode super/subscripts for questionText (display only)
  const symbolButtons = ['√', 'π', 'θ', '°', '≈', '≤', '≥', '≠', '×', '÷'];
  const superscriptDigits = ['⁰','¹','²','³','⁴','⁵','⁶','⁷','⁸','⁹'];
  const subscriptDigits = ['₀','₁','₂','₃','₄','₅','₆','₇','₈','₉'];

  // Seed state in edit mode
  useEffect(() => {
    if (editQuestion) {
      setQuestionText(editQuestion.questionText || '');
      // Attach temporary ids for controlled list rendering
      const seededVars = Array.isArray(editQuestion.variables) ? editQuestion.variables.map((v) => ({
        id: crypto.randomUUID(),
        name: v.name,
        values: Array.isArray(v.values) ? v.values.slice() : [''],
      })) : [];
      setVariables(seededVars);
      setFormula(editQuestion.formula || '');
      // compute next var index based on names present
      let maxVarIndex = 0;
      seededVars.forEach(v => {
        const num = parseInt(String(v.name).split('_')[1]);
        if (!isNaN(num) && num > maxVarIndex) maxVarIndex = num;
      });
      nextVarIndex.current = maxVarIndex + 1;
    }
  }, [editQuestion]);

  // Effect to parse variables from questionText
  useEffect(() => {
    const regex = /\{\{(var_\d+)\}\}/g; // Matches {{var_1}}, {{var_2}}, etc.
    let match;
    const extractedVarNames = new Set();
    while ((match = regex.exec(questionText)) !== null) {
      extractedVarNames.add(match[1]); // Add 'var_1', 'var_2'
    }

    setVariables(prevVars => {
      // Start with existing variables to preserve their values
      const newVariables = [...prevVars];
      const existingNames = new Set(prevVars.map(v => v.name));

      // Add any new placeholders that don't already exist
      Array.from(extractedVarNames).sort((a, b) => {
        const numA = parseInt(a.split('_')[1]);
        const numB = parseInt(b.split('_')[1]);
        return numA - numB;
      }).forEach(varName => {
        if (!existingNames.has(varName)) {
          newVariables.push({ id: crypto.randomUUID(), name: varName, values: [''] });
        }
      });

      // Update nextVarIndex based on all variables
      let maxVarIndex = 0;
      newVariables.forEach(v => {
        const num = parseInt(String(v.name).split('_')[1]);
        if (!isNaN(num) && num > maxVarIndex) {
          maxVarIndex = num;
        }
      });
      nextVarIndex.current = maxVarIndex + 1;

      return newVariables;
    });
  }, [questionText]); // Re-run when questionText changes

  // Handle adding a new variable placeholder
  const handleAddVariablePlaceholder = () => {
    const newVarName = `var_${nextVarIndex.current}`;
    // No need to check for duplicates here, as the useEffect will reconcile
    // and nextVarIndex.current ensures a new sequential name.

    // Insert the new variable at the current cursor position in the question text
    insertTextAtCursor(questionTextRef, `{{${newVarName}}}`, setQuestionText);
  };

  // Handle changing a variable's value (dynamic inputs)
  const handleVariableValueChange = (varId, valueIndex, value) => {
    setVariables(prevVars => prevVars.map(v => {
      if (v.id === varId) {
        const newValues = [...v.values];
        newValues[valueIndex] = value;

        // If the last input is filled, add a new empty one
        // Also, if a value is cleared and it's not the last one, remove it
        if (valueIndex === newValues.length - 1 && value.trim() !== '') {
          newValues.push('');
        } else if (value.trim() === '' && newValues.length > 1 && valueIndex < newValues.length - 1) {
          // Remove if cleared and not the last one (to prevent empty middle inputs)
          newValues.splice(valueIndex, 1);
        }
        return { ...v, values: newValues };
      }
      return v;
    }));
  };

  // Handle removing a variable value input field
  const handleRemoveVariableValue = (varId, valueIndex) => {
    setVariables(prevVars => prevVars.map(v => {
      if (v.id === varId) {
        const newValues = v.values.filter((_, idx) => idx !== valueIndex);
        // Ensure there's always at least one empty input if all are removed
        if (newValues.length === 0) {
          newValues.push('');
        }
        return { ...v, values: newValues };
      }
      return v;
    }));
  };

  // Handle removing a variable entirely
  const handleRemoveVariable = (varId) => {
    setVariables(prevVars => prevVars.filter(v => v.id !== varId));
    // The useEffect dependent on questionText will handle re-indexing var_X names if they are removed
    // from the question text itself. If a variable is removed here but still exists in the question text,
    // it will be re-added by the useEffect. This is a trade-off for simplicity and consistency.
    // For a more complex scenario, we might need to actively remove the {{var_X}} from questionText here.
  };

  // Handle add or update
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!questionText.trim()) {
      setErrorMessage("Question text cannot be empty.");
      return;
    }
    if (!formula.trim()) {
      setErrorMessage("Formula cannot be empty.");
      return;
    }

  // Variables are optional for some questions (e.g., pure symbolic trig). Allow empty.

    // Validate variables have at least one non-empty value
    const hasInvalidVariable = variables.some(v => v.values.filter(val => val.trim() !== '').length === 0);
    if (hasInvalidVariable) {
      setErrorMessage("All defined variables must have at least one value.");
      return;
    }

    setIsAddingQuestion(true);
    try {
      const variablesToSave = variables.map(v => ({
        name: v.name,
        values: v.values.filter(val => val.trim() !== ''),
      }));

      if (editQuestion && editQuestion.id) {
        const qRef = doc(db, `artifacts/${APP_ID}/users/${userId}/questions/${editQuestion.id}`);
        await updateDoc(qRef, {
          questionText: questionText.trim(),
          variables: variablesToSave,
          formula: formula.trim(),
          updatedAt: new Date(),
        });
        if (onQuestionUpdated) onQuestionUpdated();
      } else {
        const questionsCollectionRef = collection(db, `artifacts/${APP_ID}/users/${userId}/questions`);
        await addDoc(questionsCollectionRef, {
          subjectId: subjectId,
          questionText: questionText.trim(),
          variables: variablesToSave,
          formula: formula.trim(),
          createdAt: new Date(),
        });
        setQuestionText('');
        setVariables([]);
        setFormula('');
        nextVarIndex.current = 1; // Reset variable index for next question
        if (onQuestionAdded) onQuestionAdded();
      }
    } catch (e) {
      console.error("Error adding question:", e);
      setErrorMessage("Failed to add question. Please try again.");
    } finally {
      setIsAddingQuestion(false);
    }
  };

  return (
    <div className="mb-8 p-6 bg-blue-50 rounded-lg shadow-inner">
      <h3 className="text-xl font-semibold text-blue-700 mb-4">Create New Dynamic Question</h3>
      {errorMessage && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <strong className="font-bold">Error!</strong>
          <span className="block sm:inline"> {errorMessage}</span>
        </div>
      )}
  <form onSubmit={handleSubmit}>
        {/* Question Text Area with "Add Variable" button */}
        <div className="mb-4">
          <label htmlFor="questionText" className="block text-sm font-medium text-gray-700 mb-1">
            Question Text
          </label>
          <div className="flex items-center gap-2 mb-2">
            <button
              type="button"
              onClick={handleAddVariablePlaceholder}
              className="px-4 py-2 bg-indigo-500 text-white rounded-md shadow-sm hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200 flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Variable
            </button>
            <span className="text-sm text-gray-600">Click to insert <span className="font-mono bg-gray-200 px-1 rounded-sm">{`{{var_X}}`}</span> at cursor.</span>
          </div>
          <textarea
            id="questionText"
            ref={questionTextRef}
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            placeholder="e.g., sin²(30) + cos²(30) = ?   or   Find √{{var_1}}"
            rows="3"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            required
          ></textarea>
          {/* Formatting & Symbols toolbar for question text */}
          <div className="mt-3 p-3 bg-gray-50 rounded-md border border-gray-200">
            <p className="text-xs font-semibold text-gray-700 mb-2">Formatting & Symbols (display only):</p>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-xs text-gray-600 mr-1">Superscript:</span>
              {superscriptDigits.map((s, i) => (
                <button
                  key={`sup-${i}`}
                  type="button"
                  onClick={() => insertTextAtCursor(questionTextRef, s, setQuestionText)}
                  className="px-2 py-0.5 bg-white border rounded hover:bg-gray-100 text-sm"
                  title={`Insert superscript ${i}`}
                >{s}</button>
              ))}
              <span className="ml-3 text-xs text-gray-600">Subscript:</span>
              {subscriptDigits.map((s, i) => (
                <button
                  key={`sub-${i}`}
                  type="button"
                  onClick={() => insertTextAtCursor(questionTextRef, s, setQuestionText)}
                  className="px-2 py-0.5 bg-white border rounded hover:bg-gray-100 text-sm"
                  title={`Insert subscript ${i}`}
                >{s}</button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-gray-600 mr-1">Symbols:</span>
              {symbolButtons.map((sym, idx) => (
                <button
                  key={`sym-${idx}`}
                  type="button"
                  onClick={() => insertTextAtCursor(questionTextRef, sym, setQuestionText)}
                  className="px-2 py-0.5 bg-white border rounded hover:bg-gray-100 text-sm"
                  title={`Insert ${sym}`}
                >{sym}</button>
              ))}
            </div>
            <p className="text-[11px] text-gray-500 mt-2">Note: These symbols affect only the visible question text, not the formula calculation.</p>
          </div>
        </div>

        {/* Dynamic Value Inputs for Variables */}
        {variables.length > 0 && (
          <div className="mb-6 p-4 bg-gray-100 rounded-md border border-gray-200">
            <h4 className="text-lg font-semibold text-gray-800 mb-3">Provide Values for Each Variable:</h4>
            {variables.map(v => (
              <div key={v.id} className="mb-4 p-3 bg-gray-50 rounded-md border border-gray-200">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Variable: <span className="font-mono bg-gray-200 px-2 py-0.5 rounded-md">{v.name}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => handleRemoveVariable(v.id)}
                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                    title="Remove this variable"
                  >
                    Remove Variable
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {v.values.map((val, valIdx) => (
                    <div key={valIdx} className="flex items-center gap-1">
                      <input
                        type="text"
                        value={val}
                        onChange={(e) => handleVariableValueChange(v.id, valIdx, e.target.value)}
                        placeholder={`Value ${valIdx + 1}`}
                        className="flex-grow px-2 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                      />
                      {/* Show remove button only if there's more than one value input, or if it's not the last empty one */}
                      {v.values.length > 1 && (val.trim() !== '' || valIdx < v.values.length - 1) && (
                        <button
                          type="button"
                          onClick={() => handleRemoveVariableValue(v.id, valIdx)}
                          className="text-red-400 hover:text-red-600"
                          title="Remove value"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1zm2 3a1 1 0 011-1h2a1 1 0 110 2h-2a1 1 0 01-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Enter values one by one. A new input appears automatically. Empty inputs in the middle will be removed.
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Formula Input */}
        <div className="mb-6">
          <label htmlFor="formula" className="block text-sm font-medium text-gray-700 mb-1">
            Formula to calculate answer
          </label>
          <p className="text-sm font-medium text-gray-700 mb-2">Click to insert variables:</p>
          {/* Variable Chips (above formula input) */}
          <div className="flex flex-wrap gap-2 mb-4">
            {variables.map(v => (
              <span
                key={`formula-var-${v.id}`}
                onClick={() => insertTextAtCursor(formulaRef, v.name, setFormula)}
                className="cursor-pointer bg-purple-100 text-purple-800 text-sm font-medium px-3 py-1 rounded-full hover:bg-purple-200 transition-colors duration-150 shadow-sm"
                title={`Click to insert ${v.name} into formula`}
              >
                {v.name}
              </span>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            {/* Formula Input Field */}
            <div className="flex-grow">
              <input
                type="text"
                id="formula"
                ref={formulaRef}
                value={formula}
                onChange={(e) => setFormula(e.target.value)}
                placeholder="e.g., (var_1 * var_2) / sin(var_3)"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                required
              />
              <p className="text-sm text-gray-600 mt-2">
                Use variables and operators/functions to build your formula.
              </p>
            </div>

            {/* Display computed result */}
            {computedResult !== '' && (
              <div className="mt-4 p-3 bg-gray-100 rounded-md border border-gray-200">
                <p className="text-sm font-medium text-gray-700 mb-1">Computed Result:</p>
                <p className="text-lg font-bold text-indigo-700">
                  {computedResult === 'undefined' ? 'Undefined (check formula)' : computedResult}
                </p>
              </div>
            )}

            {/* Operator and Function Chips (to the right of formula input) */}
            <div className="flex flex-wrap gap-2 p-3 bg-gray-100 rounded-md border border-gray-200 sm:w-1/3 max-w-xs">
              <p className="w-full text-sm font-medium text-gray-700 mb-1">Operators & Functions:</p>
              {/* Operator Chips */}
              {mathOperators.map((op, index) => (
                <span
                  key={`op-${index}`}
                  onClick={() => insertTextAtCursor(formulaRef, op, setFormula)}
                  className="cursor-pointer bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded-full hover:bg-blue-200 transition-colors duration-150 shadow-sm"
                  title={`Click to insert ${op} into formula`}
                >
                  {op}
                </span>
              ))}
              {/* Function Chips */}
              {mathFunctions.map((func, index) => (
                <span
                  key={`func-${index}`}
                  onClick={() => insertTextAtCursor(formulaRef, func, setFormula, 1)} // 1 for cursor inside ()
                  className="cursor-pointer bg-teal-100 text-teal-800 text-sm font-medium px-3 py-1 rounded-full hover:bg-teal-200 transition-colors duration-150 shadow-sm"
                  title={`Click to insert ${func} into formula`}
                >
                  {func}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            className="flex-1 px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
            disabled={isAddingQuestion}
          >
            {isAddingQuestion ? (editQuestion ? 'Updating…' : 'Adding…') : (editQuestion ? 'Update Question' : 'Add Question to Bank')}
          </button>
          {editQuestion && (
            <button
              type="button"
              onClick={() => onCancel && onCancel()}
              className="px-6 py-3 border border-gray-300 text-base font-medium rounded-md shadow-sm bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

export default DynamicQuestionForm;
