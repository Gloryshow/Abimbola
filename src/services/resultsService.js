// Results/Grades Service - RBAC enforced
// Uses global 'db' and functions from global scope

/**
 * Enter results for a student in a subject
 */
const enterResult = async (user, resultData) => {
  // Verify teacher teaches this subject
  if (!teacheSubject(user, resultData.subjectId)) {
    throw new Error('Access denied: You do not teach this subject');
  }

  try {
    const resultId = `${resultData.studentId}_${resultData.subjectId}_${resultData.termId || 'final'}`;

    // Check if results are locked
    const subjectDocSnapshot = await window.db.collection('subjects').doc(resultData.subjectId).get();
    if (subjectDocSnapshot.exists && subjectDocSnapshot.data().resultsLocked) {
      throw new Error('Results are locked by admin. Cannot edit.');
    }

    const result = {
      studentId: resultData.studentId,
      subjectId: resultData.subjectId,
      classId: resultData.classId,
      teacherId: user.uid,
      termId: resultData.termId || 'final',
      scores: {
        classwork: resultData.scores?.classwork || 0,
        test: resultData.scores?.test || 0,
        examination: resultData.scores?.examination || 0,
      },
      totalScore: (
        (resultData.scores?.classwork || 0) +
        (resultData.scores?.test || 0) +
        (resultData.scores?.examination || 0)
      ),
      grade: calculateGrade(
        (resultData.scores?.classwork || 0) +
          (resultData.scores?.test || 0) +
          (resultData.scores?.examination || 0)
      ),
      comments: resultData.comments || '',
      status: 'submitted',
      submittedAt: window.firebase.firestore.Timestamp.now(),
      updatedAt: window.firebase.firestore.Timestamp.now(),
    };

    await window.db.collection('results').doc(resultId).set(result);

    return {
      success: true,
      resultId,
      message: 'Result entered successfully',
    };
  } catch (error) {
    throw new Error(`Failed to enter result: ${error.message}`);
  }
};

/**
 * Update result (before admin locks)
 */
const updateResult = async (user, resultId, updateData) => {
  try {
    const resultDocRef = window.db.collection('results').doc(resultId);
    const resultDocSnapshot = await resultDocRef.get();

    if (!resultDocSnapshot.exists) {
      throw new Error('Result not found');
    }

    const result = resultDocSnapshot.data();

    // Verify teacher is the one who entered the result
    if (result.teacherId !== user.uid) {
      throw new Error('Access denied: Cannot edit other teachers results');
    }

    // Verify teacher teaches the subject
    if (!teacheSubject(user, result.subjectId)) {
      throw new Error('Access denied: You do not teach this subject');
    }

    // Check if results are locked
    const subjectDocSnapshot = await window.db.collection('subjects').doc(result.subjectId).get();
    if (subjectDocSnapshot.exists && subjectDocSnapshot.data().resultsLocked) {
      throw new Error('Results are locked by admin. Cannot edit.');
    }

    const scores = updateData.scores || result.scores;
    const totalScore = scores.classwork + scores.test + scores.examination;

    const update = {
      scores,
      totalScore,
      grade: calculateGrade(totalScore),
      comments: updateData.comments || result.comments,
      updatedAt: window.firebase.firestore.Timestamp.now(),
    };

    await resultDocRef.update(update);

    return {
      success: true,
      message: 'Result updated successfully',
    };
  } catch (error) {
    throw new Error(`Failed to update result: ${error.message}`);
  }
};

/**
 * Get results for a class and subject
 */
const getResultsBySubject = async (user, classId, subjectId) => {
  // Verify teacher teaches this subject
  if (!teacheSubject(user, subjectId)) {
    throw new Error('Access denied: You do not teach this subject');
  }

  try {
    const resultsSnapshot = await window.db.collection('results')
      .where('classId', '==', classId)
      .where('subjectId', '==', subjectId)
      .where('teacherId', '==', user.uid)
      .get();

    return resultsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    throw new Error(`Failed to fetch results: ${error.message}`);
  }
};

/**
 * Get student's results across all subjects
 */
const getStudentResults = async (user, classId, studentId) => {
  try {
    const resultsSnapshot = await window.db.collection('results')
      .where('studentId', '==', studentId)
      .where('classId', '==', classId)
      .get();

    return resultsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    throw new Error(`Failed to fetch student results: ${error.message}`);
  }
};

/**
 * Get pending results for teacher
 */
const getPendingResults = async (user) => {
  try {
    const resultsSnapshot = await window.db.collection('results')
      .where('teacherId', '==', user.uid)
      .where('status', '==', 'submitted')
      .get();

    return resultsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    throw new Error(`Failed to fetch pending results: ${error.message}`);
  }
};

/**
 * Bulk enter results for a class (batch operation)
 */
const bulkEnterResults = async (user, classId, resultsData) => {
  try {
    const batch = window.db.batch();
    const resultIds = [];

    for (const resultData of resultsData) {
      // Verify each subject is taught by this teacher
      if (!teacheSubject(user, resultData.subjectId)) {
        throw new Error(`Access denied: You do not teach subject ${resultData.subjectId}`);
      }

      const resultId = `${resultData.studentId}_${resultData.subjectId}_${resultData.termId || 'final'}`;
      resultIds.push(resultId);

      const totalScore = resultData.scores.classwork + resultData.scores.test + resultData.scores.examination;

      const result = {
        studentId: resultData.studentId,
        subjectId: resultData.subjectId,
        classId,
        teacherId: user.uid,
        termId: resultData.termId || 'final',
        scores: resultData.scores,
        totalScore,
        grade: calculateGrade(totalScore),
        comments: resultData.comments || '',
        status: 'submitted',
        submittedAt: window.firebase.firestore.Timestamp.now(),
        updatedAt: window.firebase.firestore.Timestamp.now(),
      };

      batch.set(window.db.collection('results').doc(resultId), result);
    }

    await batch.commit();

    return {
      success: true,
      resultIds,
      message: `${resultIds.length} results entered successfully`,
    };
  } catch (error) {
    throw new Error(`Failed to bulk enter results: ${error.message}`);
  }
};

/**
 * Calculate grade based on total score
 */
const calculateGrade = (totalScore) => {
  if (totalScore >= 90) return 'A';
  if (totalScore >= 80) return 'B';
  if (totalScore >= 70) return 'C';
  if (totalScore >= 60) return 'D';
  if (totalScore >= 50) return 'E';
  return 'F';
};

/**
 * Get grade distribution for a subject/class
 */
const getGradeDistribution = async (user, classId, subjectId) => {
  if (!teacheSubject(user, subjectId)) {
    throw new Error('Access denied: You do not teach this subject');
  }

  try {
    const resultsSnapshot = await window.db.collection('results')
      .where('classId', '==', classId)
      .where('subjectId', '==', subjectId)
      .where('teacherId', '==', user.uid)
      .get();

    const gradeDistribution = {
      A: 0,
      B: 0,
      C: 0,
      D: 0,
      E: 0,
      F: 0,
    };

    resultsSnapshot.docs.forEach((doc) => {
      const grade = doc.data().grade;
      gradeDistribution[grade]++;
    });

    const average = resultsSnapshot.docs.reduce((sum, doc) => sum + doc.data().totalScore, 0) / resultsSnapshot.size;

    return {
      classId,
      subjectId,
      totalStudents: resultsSnapshot.size,
      gradeDistribution,
      averageScore: average.toFixed(2),
    };
  } catch (error) {
    throw new Error(`Failed to get grade distribution: ${error.message}`);
  }
};
// Expose functions globally
window.enterResult = enterResult;
window.updateResult = updateResult;
window.getResultsBySubject = getResultsBySubject;
window.getStudentResults = getStudentResults;
window.getPendingResults = getPendingResults;
window.bulkEnterResults = bulkEnterResults;
window.getGradeDistribution = getGradeDistribution;