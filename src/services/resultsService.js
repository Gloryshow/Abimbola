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

/**
 * Calculate CA average from three tests
 * CA1, CA2, CA3 are each /30
 * Average = (CA1 + CA2 + CA3) / 3 (max 30)
 */
const calculateCAAverage = (ca1, ca2, ca3) => {
  const total = (ca1 || 0) + (ca2 || 0) + (ca3 || 0);
  return Math.round((total / 3) * 100) / 100; // Average of 3 tests
};

/**
 * Calculate final score
 * Final = CA Average + Exam Score
 * Max: 30 (CA) + 70 (Exam) = 100
 */
const calculateFinalScore = (ca1, ca2, ca3, examScore) => {
  const caAverage = calculateCAAverage(ca1, ca2, ca3);
  const finalScore = caAverage + (examScore || 0);
  return Math.round(finalScore * 100) / 100;
};

/**
 * Calculate grade based on score
 * A: 70-100, B: 60-69, C: 50-59, D: 45-49, E: 40-44, F: 0-39
 */
const calculateGradeFromScore = (score) => {
  const numScore = parseFloat(score) || 0;
  if (numScore >= 70) return 'A';
  if (numScore >= 60) return 'B';
  if (numScore >= 50) return 'C';
  if (numScore >= 45) return 'D';
  if (numScore >= 40) return 'E';
  return 'F';
};

/**
 * Submit or update result with CA tests and exam
 * Accessible only by assigned teachers or admins
 */
const submitResult = async (user, resultData) => {
  // Teachers can only submit for their assigned subjects
  if (user.role === 'teacher' && !user.assignedSubjects?.includes(resultData.subjectId)) {
    throw new Error('Access denied: You are not assigned to this subject');
  }

  try {
    const sessionIdFormatted = resultData.sessionId ? resultData.sessionId.replace('/', '_') : '';
    const resultId = `${resultData.studentId}_${resultData.subjectId}_${resultData.classId}_${resultData.termId || 'final'}_${sessionIdFormatted}`;
    
    // Calculate CA average and final score
    const caAverage = calculateCAAverage(resultData.ca1, resultData.ca2, resultData.ca3);
    const finalScore = calculateFinalScore(resultData.ca1, resultData.ca2, resultData.ca3, resultData.exam);
    const grade = calculateGradeFromScore(finalScore);

    const result = {
      studentId: resultData.studentId,
      studentName: resultData.studentName,
      subjectId: resultData.subjectId,
      subjectName: resultData.subjectName,
      classId: resultData.classId,
      termId: resultData.termId || 'final',
      sessionId: resultData.sessionId || '',
      teacherId: user.uid,
      teacherName: user.name,
      
      // Individual test scores (/30 each)
      ca1: resultData.ca1 || 0,
      ca2: resultData.ca2 || 0,
      ca3: resultData.ca3 || 0,
      
      // Exam score (/70)
      exam: resultData.exam || 0,
      
      // Calculated values
      caAverage: caAverage,
      finalScore: finalScore,
      grade: grade,
      
      // Metadata
      comments: resultData.comments || '',
      status: 'submitted',
      submittedAt: window.firebase.firestore.Timestamp.now(),
      updatedAt: window.firebase.firestore.Timestamp.now(),
    };

    await window.db.collection('results').doc(resultId).set(result, { merge: true });

    return {
      success: true,
      resultId,
      finalScore: finalScore,
      grade: grade,
      message: 'Result submitted successfully',
    };
  } catch (error) {
    throw new Error(`Failed to submit result: ${error.message}`);
  }
};

/**
 * Get results for a student in a term
 */
const getStudentTermResults = async (user, studentId, termId) => {
  try {
    const resultsSnapshot = await window.db.collection('results')
      .where('studentId', '==', studentId)
      .where('termId', '==', termId || 'final')
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
 * Get results submitted by a teacher for a class/subject
 */
const getTeacherResults = async (user, classId, subjectId, termId, sessionId) => {
  if (user.role === 'teacher' && !user.assignedSubjects?.includes(subjectId)) {
    throw new Error('Access denied: You are not assigned to this subject');
  }

  try {
    let query = window.db.collection('results')
      .where('classId', '==', classId)
      .where('subjectId', '==', subjectId)
      .where('termId', '==', termId || 'final');
    
    if (sessionId) {
      query = query.where('sessionId', '==', sessionId);
    }

    const resultsSnapshot = await query.get();

    return resultsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    throw new Error(`Failed to fetch results: ${error.message}`);
  }
};

/**
 * Get all results for admin - with optional filtering
 */
const getAdminResults = async (user, classId, subjectId, termId, sessionId) => {
  // Only admins can view all results
  if (user.role !== 'admin') {
    throw new Error('Access denied: Only admins can view all results');
  }

  try {
    let query = window.db.collection('results');

    if (classId) {
      query = query.where('classId', '==', classId);
    }
    if (subjectId) {
      query = query.where('subjectId', '==', subjectId);
    }
    if (termId) {
      query = query.where('termId', '==', termId);
    }
    if (sessionId) {
      query = query.where('sessionId', '==', sessionId);
    }

    const resultsSnapshot = await query.get();

    return resultsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    throw new Error(`Failed to fetch results: ${error.message}`);
  }
};

/**
 * Get combined results for all subjects for admin - combines all subjects for a class/term
 */
const getCombinedAdminResults = async (user, classId, termId, sessionId) => {
  // Only admins can view all results
  if (user.role !== 'admin') {
    throw new Error('Access denied: Only admins can view combined results');
  }

  try {
    let query = window.db.collection('results');

    if (classId) {
      query = query.where('classId', '==', classId);
    }
    if (termId) {
      query = query.where('termId', '==', termId);
    }
    if (sessionId) {
      query = query.where('sessionId', '==', sessionId);
    }

    const resultsSnapshot = await query.get();

    return resultsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    throw new Error(`Failed to fetch combined results: ${error.message}`);
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
window.calculateCAAverage = calculateCAAverage;
window.calculateFinalScore = calculateFinalScore;
window.calculateGradeFromScore = calculateGradeFromScore;
window.submitResult = submitResult;
window.getStudentTermResults = getStudentTermResults;
window.getTeacherResults = getTeacherResults;
window.getAdminResults = getAdminResults;
window.getCombinedAdminResults = getCombinedAdminResults;