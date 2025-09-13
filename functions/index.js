const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

/**
 * Pick up to n unique random elements from an array.
 * @param {Array<*>} arr Array to sample from
 * @param {number} n Number to pick
 * @return {Array<*>}
 */
function pickRandom(arr, n) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy.slice(0, Math.min(n, copy.length));
}

/**
 * Integer factorial of a non-negative value.
 * @param {number} x
 * @return {number}
 */
function fact(x) {
  const n = Math.floor(Number(x));
  if (!isFinite(n) || n < 0) return NaN;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

/**
 * Convert degrees to radians.
 * @param {number} x degrees
 * @return {number} radians
 */
function deg2rad(x) {
  return Number(x) * Math.PI / 180;
}
/** Degree-based trig functions */
/**
 * @param {number} x degrees
 * @return {number}
 */
function sinDeg(x) {
  return Math.sin(deg2rad(x));
}
/**
 * @param {number} x degrees
 * @return {number}
 */
function cosDeg(x) {
  return Math.cos(deg2rad(x));
}
/**
 * @param {number} x degrees
 * @return {number}
 */
function tanDeg(x) {
  return Math.tan(deg2rad(x));
}
/**
 * @param {number} x degrees
 * @return {number}
 */
function cosec(x) {
  return 1 / sinDeg(x);
}
/**
 * @param {number} x degrees
 * @return {number}
 */
function sec(x) {
  return 1 / cosDeg(x);
}
/**
 * @param {number} x degrees
 * @return {number}
 */
function cot(x) {
  return 1 / tanDeg(x);
}

/**
 * Floating point near-equality.
 * @param {number} a
 * @param {number} b
 * @param {number} [eps]
 * @return {boolean}
 */
function nearEq(a, b, eps) {
  const e = eps != null ? eps : 1e-9;
  return Math.abs(a - b) <= e;
}

/**
 * Convert a numeric value into a nice symbolic string when close to
 * special trig values. Falls back to rounded decimal string.
 * Examples: 0.5 -> "1/2", 0.7071 -> "1/√2", 0.8660 -> "√3/2",
 * 1.732 -> "√3", 0.57735 -> "1/√3". Preserves sign.
 * @param {number} val
 * @return {string}
 */
function toExactSymbol(val) {
  if (!isFinite(val)) return "Not defined";
  const sign = val < 0 ? -1 : 1;
  const x = Math.abs(val);
  const ROOT2 = Math.SQRT2; // √2
  const ROOT3 = Math.sqrt(3); // √3
  // Known targets (positive)
  const candidates = [
    {v: 0, s: "0"},
    {v: 0.5, s: "1/2"},
    {v: ROOT2 / 2, s: "1/√2"},
    {v: ROOT3 / 2, s: "√3/2"},
    {v: 1, s: "1"},
    {v: ROOT2, s: "√2"},
    {v: ROOT3, s: "√3"},
    {v: 1 / ROOT3, s: "1/√3"},
    {v: 2 / ROOT3, s: "2/√3"},
  ];
  for (const c of candidates) {
    if (nearEq(x, c.v, 1e-6)) {
      const sym = c.s;
      return sign < 0 && sym !== "0" ? ("-" + sym) : sym;
    }
  }
  // Very large magnitude -> treat as undefined (tan 90 etc.)
  if (x > 1e12) return "Not defined";
  // Fallback: round to at most 3 decimal places, trim trailing zeros
  const rounded = Math.round(val * 1000) / 1000;
  return String(rounded);
}

/**
 * Get a pool of common symbolic distractors for trig-like answers.
 * Includes signs.
 * @return {string[]}
 */
function trigSymbolPool() {
  const base = [
    "0",
    "1/2", "-1/2",
    "1/√2", "-1/√2",
    "√3/2", "-√3/2",
    "1", "-1",
    "√2", "-√2",
    "√3", "-√3",
    "1/√3", "-1/√3",
    "2/√3", "-2/√3",
    "Not defined",
  ];
  return base;
}

/**
 * Build 4-option multiple choice for a numeric answer, favoring trig symbols.
 * @param {number} ansVal
 * @return {{options: string[], correctOption: string}}
 */
function buildChoiceOptions(ansVal) {
  const correct = toExactSymbol(ansVal);
  const pool = trigSymbolPool();
  // Unique distractors not equal to correct
  const distractors = pool.filter((s) => s !== correct);
  // Shuffle and pick 3
  for (let i = distractors.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = distractors[i];
    distractors[i] = distractors[j];
    distractors[j] = t;
  }
  const picked = distractors.slice(0, 3);
  const options = [correct, ...picked];
  // Shuffle options for display
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = options[i];
    options[i] = options[j];
    options[j] = t;
  }
  return {options, correctOption: correct};
}

/**
 * Evaluate a simple math expression with variables.
 * Supports + - * / ^, sin cos tan cosec sec cot, factorial (!).
 * @param {string} formula
 * @param {Object<string, (string|number)>} vars
 * @return {number|null}
 */
function evaluateFormula(formula, vars) {
  try {
    let expr = String(formula);
    // Replace variables with numeric literals
    Object.keys(vars).forEach((k) => {
      const val = String(vars[k]);
      const re = new RegExp("\\b" + k + "\\b", "g");
      expr = expr.replace(re, "(" + val + ")");
    });

    // Translate symbols/functions
    expr = expr.replace(/\^/g, "**");
    expr = expr.replace(/cosec\s*\(/g, "cosec(");
    expr = expr.replace(/sec\s*\(/g, "sec(");
    expr = expr.replace(/cot\s*\(/g, "cot(");

    // Replace factorial: 5! -> fact(5)
    expr = expr.replace(/(\d+(?:\.\d+)?)!/g, "fact($1)");

  // Safety: only allow a safe charset
  if (!/^[0-9+\-*/().,\sA-Za-z_*]+$/.test(expr)) return null;

  // Evaluate with limited scope
  // eslint-disable-next-line no-new-func
  const f = new Function(
    "sin", "cos", "tan", "cosec", "sec", "cot", "fact", "Math",
    "return (" + expr + ")",
  );
  const result = f(
    sinDeg, cosDeg, tanDeg, cosec, sec, cot, fact, Math,
  );
    return result;
  } catch (e) {
    console.error("evaluateFormula error", e);
    return null;
  }
}

/**
 * Triggered when a student creates a document in the 'joinRequests' collection.
 * This function runs with admin privileges, bypassing security rules.
 */
exports.processJoinRequest = functions.firestore
    .document("joinRequests/{requestId}")
    .onCreate(async (snap, context) => {
      const requestData = snap.data();
      // The unused 'requestId' variable has been removed to fix the lint error.
      const {userId, classCode, appId} = requestData;

      if (!userId || !classCode || !appId) {
        console.log("Invalid request data, deleting request.");
        return snap.ref.delete();
      }

      // Use a collection group query to find the class across all teachers
      const classesQuery = db.collectionGroup("classes")
          .where("uniqueCode", "==", classCode.toUpperCase());

      const classSnapshot = await classesQuery.get();

      if (classSnapshot.empty) {
        console.log(`Class with code ${classCode} not found.`);
        // Write a status back to the user's profile
        const status = `Class code ${classCode} not found.`;
        await db.doc(`users/${userId}`).update({
          lastJoinAttemptStatus: status,
        });
        return snap.ref.delete();
      }

      const classDoc = classSnapshot.docs[0];
      const classData = classDoc.data();
      const teacherId = classData.teacherId;

      // Check if class is joinable
      if (!classData.isJoinable) {
        const status = `Class "${classData.name}" is not accepting students.`;
        console.log(status);
        await db.doc(`users/${userId}`).update({lastJoinAttemptStatus: status});
        return snap.ref.delete();
      }

      // Check if student is already in the class
      if (classData.students && classData.students.includes(userId)) {
        const status = `You are already in the class "${classData.name}".`;
        console.log(status);
        await db.doc(`users/${userId}`).update({lastJoinAttemptStatus: status});
        return snap.ref.delete();
      }

      // All checks passed, proceed to join the student to the class
      try {
        const studentProfileRef = db.doc(`users/${userId}`);
        const classRef = classDoc.ref;

        // Use a transaction to ensure both writes succeed or fail together
        await db.runTransaction(async (transaction) => {
          // 1. Add student to the class's student list
          transaction.update(classRef, {
            students: admin.firestore.FieldValue.arrayUnion(userId),
          });

          // 2. Add class info to the student's profile
          transaction.update(studentProfileRef, {
            joinedClasses: admin.firestore.FieldValue.arrayUnion({
              classId: classDoc.id,
              teacherId: teacherId,
            }),
            lastJoinAttemptStatus: `Successfully joined "${classData.name}"!`,
          });
        });

        const successMsg = `Successfully processed join request for user ` +
                         `${userId} to class ${classDoc.id}`;
        console.log(successMsg);
      } catch (error) {
        console.error("Error processing join request:", error);
        await db.doc(`users/${userId}`).update({
          lastJoinAttemptStatus: "An error occurred while joining the class.",
        });
      }

      // Finally, delete the processed request document
      return snap.ref.delete();
    });

/**
     * Expand assignmentRequests into per-student testAssignments with
     * two randomized questions and randomized variable values.
     */
exports.processAssignmentRequest = functions.firestore
    .document("assignmentRequests/{requestId}")
    .onCreate(async (snap, context) => {
      const data = snap.data();
      const requestId = context.params.requestId;
      const teacherId = data.teacherId;
      const appId = data.appId;
      const subjectId = data.subjectId;
      const studentEmails = Array.isArray(data.studentEmails) ?
        data.studentEmails : [];
      const studentUids = Array.isArray(data.studentUids) ?
        data.studentUids : [];
      const classId = data.classId || "";
      const courseName = data.courseName || data.className || "";

      if (!teacherId || !appId || !subjectId) {
        console.error("Invalid assignment request payload", data);
        return snap.ref.delete();
      }

      try {
        // Resolve student list from inputs (emails, uids, or classId)
        /** @type {Array<{uid: (string|null), email: (string|null)}>} */
        let studentList = [];

        // If a classId is provided, load its student UIDs
        const classUidSet = new Set();
        if (classId) {
          const classRef = db.doc(
              "artifacts/" + appId +
              "/users/" + teacherId +
              "/classes/" + classId,
          );
          const classSnap = await classRef.get();
          if (classSnap.exists) {
            const cls = classSnap.data();
            if (Array.isArray(cls.students)) {
              cls.students.forEach((u) => classUidSet.add(String(u)));
            }
          }
        }

        // Include any provided studentUids
        if (studentUids && studentUids.length > 0) {
          studentUids.forEach((u) => classUidSet.add(String(u)));
        }

        if (classUidSet.size > 0) {
          // Fetch emails for UIDs from users/{uid}
          const uidArr = Array.from(classUidSet);
          // Firestore limits to 10 in 'in' queries; fetch individually
          const pairs = [];
          // eslint-disable-next-line no-restricted-syntax
          for (const uid of uidArr) {
            // eslint-disable-next-line no-await-in-loop
            const userSnap = await db.doc("users/" + uid).get();
            const email = userSnap.exists ?
              (userSnap.get("email") || null) : null;
            pairs.push({uid: uid, email: email});
          }
          studentList = pairs;
        } else if (studentEmails.length > 0) {
          studentList = studentEmails.map((e) => ({
            uid: null,
            email: String(e),
          }));
        }

        if (studentList.length === 0) {
          console.warn("No students resolved for assignment request", data);
          return snap.ref.delete();
        }

        // 1) Load all questions for the subject
        const questionsSnap = await db
            .collection(
                "artifacts/" + appId + "/users/" + teacherId + "/questions",
            )
            .where("subjectId", "==", subjectId)
            .get();

        const questions = questionsSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        if (questions.length === 0) {
          console.warn("No questions found for subject", subjectId);
          return snap.ref.delete();
        }

        // 2) For each student, generate 2 randomized questions
        const batch = db.batch();
        const now = admin.firestore.FieldValue.serverTimestamp();

        for (const s of studentList) {
          const chosen = pickRandom(questions, 2);
          const rendered = chosen.map((q) => {
            const varMap = {};
            if (Array.isArray(q.variables)) {
              q.variables.forEach((v) => {
                const pool = Array.isArray(v.values) ? v.values : [];
                const idx = pool.length > 0 ?
                  Math.floor(Math.random() * pool.length) : 0;
                varMap[v.name] = pool[idx] != null ? pool[idx] : "";
              });
            }

            // Render question text
            let text = String(q.questionText || "");
            Object.keys(varMap).forEach((name) => {
              const re = new RegExp("\\{\\{" + name + "\\}\\}", "g");
              text = text.replace(re, String(varMap[name]));
            });

            // Compute answer
            const ansVal = evaluateFormula(q.formula || "", varMap);
            const answer = ansVal == null ? "" : String(ansVal);

            // If trig appears in formula, provide symbolic multiple-choice options
            const isTrig = /sin|cos|tan|cosec|sec|cot/i.test(String(q.formula || ""));
            let options = undefined;
            let correctOption = undefined;
            if (isTrig && ansVal != null && isFinite(ansVal)) {
              const built = buildChoiceOptions(Number(ansVal));
              options = built.options;
              correctOption = built.correctOption;
            } else if (isTrig && (ansVal == null || !isFinite(ansVal))) {
              // Handle undefined cases as "Not defined"
              const built = buildChoiceOptions(Number.POSITIVE_INFINITY);
              options = built.options;
              correctOption = built.correctOption;
            }

            return {
              questionId: q.id,
              text: text,
              variables: varMap,
              answer: answer,
              options: options,
              correctOption: correctOption,
            };
          });

          const docRef = db.collection("testAssignments").doc();
          batch.set(docRef, {
            teacherId: teacherId,
            appId: appId,
            subjectId: subjectId,
            studentUid: s.uid || null,
            studentEmail: s.email || null,
            courseName: courseName,
            classId: classId || null,
            requestId: requestId,
            status: "Assigned",
            score: 0,
            questions: rendered,
            submittedAnswers: [],
            assignedAt: now,
          });
        }

        await batch.commit();
      } catch (err) {
        console.error("processAssignmentRequest error:", err);
      }

      return snap.ref.delete();
    });

/**
 * Grade when a student submits their answers.
 * Triggers on Assigned -> Submitted with submittedAnswers length
 * matching questions length. Then sets score and marks as Graded.
 */
exports.gradeOnSubmission = functions.firestore
    .document("testAssignments/{assignmentId}")
    .onUpdate(async (change, context) => {
      const before = change.before.data();
      const after = change.after.data();
      if (!before || !after) return null;
      // Only act when status moves to Submitted from Assigned
      const movedToSubmitted =
        (before.status === "Assigned") && (after.status === "Submitted");
      if (movedToSubmitted) {
        try {
          const qs = Array.isArray(after.questions) ? after.questions : [];
          const sub = Array.isArray(after.submittedAnswers) ?
            after.submittedAnswers : [];
          let correct = 0;
          for (let i = 0; i < qs.length; i++) {
            const q = qs[i] || {};
            const expected = String(q.answer ?? "").trim();
            const expectedOption = String(q.correctOption ?? "").trim();
            const gotRaw = sub[i];
            const got = String(gotRaw ?? "").trim();
            // If options exist, compare against correctOption first
            if (Array.isArray(q.options) && q.options.length > 0) {
              if (got && expectedOption && got === expectedOption) correct++;
            } else {
              const bothNonEmpty = (expected !== "") && (got !== "");
              if (bothNonEmpty && (expected === got)) correct++;
            }
          }
          const score = correct;
          await change.after.ref.update({
            status: "Graded",
            score: score,
            gradedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } catch (e) {
          console.error("gradeOnSubmission error:", e);
        }
      }
      return null;
    });

/**
 * Keep subjectName denormalized on class documents.
 * When a class is written, copy the subject name to subjectName.
 */
exports.syncSubjectNameOnClassWrite = functions.firestore
    .document("artifacts/{appId}/users/{teacherId}/classes/{classId}")
    .onWrite(async (change, context) => {
      const after = change.after.exists ? change.after.data() : null;
      if (!after) return null; // deleted

      const appId = context.params.appId;
      const teacherId = context.params.teacherId;
      const linkedSubjectId = after.linkedSubjectId;
      const currentSubjectName = after.subjectName;

      if (!linkedSubjectId) return null;

      try {
        const subjectRef = db.doc(
            "artifacts/" + appId +
            "/users/" + teacherId +
            "/subjects/" + linkedSubjectId,
        );
        const subjectSnap = await subjectRef.get();
        if (!subjectSnap.exists) return null;

        const name = subjectSnap.get("name");
        if (!name) return null;

        if (currentSubjectName !== name) {
          await change.after.ref.update({subjectName: name});
        }
      } catch (err) {
        console.error("syncSubjectNameOnClassWrite error:", err);
      }
      return null;
    });

/**
 * When a subject is renamed, cascade the name to linked classes.
 */
exports.cascadeSubjectRenameToClasses = functions.firestore
    .document("artifacts/{appId}/users/{teacherId}/subjects/{subjectId}")
    .onUpdate(async (change, context) => {
      const before = change.before.data();
      const after = change.after.data();
      if (before.name === after.name) return null; // no rename

      const appId = context.params.appId;
      const teacherId = context.params.teacherId;
      const subjectId = context.params.subjectId;

      try {
        const classesRef = db
            .collection(
                "artifacts/" + appId + "/users/" + teacherId + "/classes",
            )
            .where("linkedSubjectId", "==", subjectId);
        const snap = await classesRef.get();
        if (snap.empty) return null;

        const batch = db.batch();
        snap.docs.forEach((docSnap) => {
          batch.update(docSnap.ref, {subjectName: after.name});
        });
        await batch.commit();
      } catch (err) {
        console.error("cascadeSubjectRenameToClasses error:", err);
      }
      return null;
    });
