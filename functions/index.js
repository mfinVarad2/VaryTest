const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

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
