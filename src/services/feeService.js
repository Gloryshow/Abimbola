/**
 * Fee Management Service
 * Handles fee structures, student payments, and fee tracking
 * Admin only - No teacher access
 */

// Helper function to sanitize session string for use in Firestore document IDs
const sanitizeSession = (session) => {
  return session.replace(/\//g, '-'); // Replace forward slashes with hyphens
};

// ==================== FEE STRUCTURE MANAGEMENT ====================

/**
 * Create or update fee structure for a class and term
 * @param {string} classId - Class ID
 * @param {string} term - Term (firstTerm, secondTerm, thirdTerm)
 * @param {string} session - Academic session (e.g., "2024/2025")
 * @param {object} feeStructure - { tuition, development, exam, ... }
 * @param {object} admin - Admin user object with uid and name
 */
const createFeeStructure = async (classId, term, session, feeStructure, admin) => {
  try {
    if (!window.db) throw new Error('Firebase not initialized');
    
    // Calculate total fee
    const totalFee = Object.values(feeStructure).reduce((sum, fee) => sum + (fee || 0), 0);
    
    const feeData = {
      ...feeStructure,
      totalFee,
      session,
      classId,
      term,
      createdBy: admin?.uid || 'unknown',
      createdByName: admin?.name || 'Unknown Admin',
      createdAt: window.firebase.firestore.Timestamp.now(),
      updatedAt: window.firebase.firestore.Timestamp.now(),
    };

    await window.db.collection('fees').doc(classId).collection('sessions').doc(sanitizeSession(session)).collection('terms').doc(term).set(feeData);
    return { classId, term, ...feeData };
  } catch (error) {
    throw new Error(`Failed to create fee structure: ${error.message}`);
  }
};

/**
 * Get fee structure for a class and term
 */
const getFeeStructure = async (classId, term, session) => {
  try {
    if (!window.db) throw new Error('Firebase not initialized');
    
    const doc = await window.db.collection('fees').doc(classId).collection('sessions').doc(sanitizeSession(session)).collection('terms').doc(term).get();
    return doc.exists ? doc.data() : null;
  } catch (error) {
    throw new Error(`Failed to fetch fee structure: ${error.message}`);
  }
};

/**
 * Get all fee structures for a class and session
 */
const getClassFeeStructures = async (classId, session) => {
  try {
    if (!window.db) throw new Error('Firebase not initialized');
    
    const snapshot = await window.db.collection('fees').doc(classId).collection('sessions').doc(sanitizeSession(session)).collection('terms').get();
    const structures = {};
    snapshot.forEach(doc => {
      structures[doc.id] = doc.data();
    });
    return structures;
  } catch (error) {
    throw new Error(`Failed to fetch fee structures: ${error.message}`);
  }
};

// ==================== STUDENT FEE WALLET MANAGEMENT ====================

/**
 * Initialize student fee record for a term (called when creating fee structure)
 * @param {string} studentId
 * @param {string} classId
 * @param {string} term
 * @param {number} totalFee
 */
const initializeStudentFeeRecord = async (studentId, classId, term, totalFee, session) => {
  try {
    if (!window.db) throw new Error('Firebase not initialized');
    
    const feeRecord = {
      classId,
      term,
      session,
      totalFee,
      totalPaid: 0,
      balance: totalFee,
      status: 'Unpaid',
      createdAt: window.firebase.firestore.Timestamp.now(),
      updatedAt: window.firebase.firestore.Timestamp.now(),
    };

    await window.db
      .collection('students')
      .doc(studentId)
      .collection('fees')
      .doc(term)
      .set(feeRecord);
    
    return feeRecord;
  } catch (error) {
    throw new Error(`Failed to initialize fee record: ${error.message}`);
  }
};

/**
 * Get student fee record for a term
 */
const getStudentFeeRecord = async (studentId, term, session) => {
  try {
    if (!window.db) throw new Error('Firebase not initialized');
    
    const doc = await window.db
      .collection('students')
      .doc(studentId)
      .collection('fees')
      .doc(term)
      .get();
    
    if (doc.exists) {
      const data = doc.data();
      // Filter by session if provided - check both session field and absence of a session field (for backward compatibility)
      if (session && data.session && data.session !== session) {
        return null;
      }
      return data;
    }
    return null;
  } catch (error) {
    throw new Error(`Failed to fetch student fee record: ${error.message}`);
  }
};

/**
 * Get all fee records for a student
 */
const getStudentAllFeeRecords = async (studentId) => {
  try {
    if (!window.db) throw new Error('Firebase not initialized');
    
    const snapshot = await window.db
      .collection('students')
      .doc(studentId)
      .collection('fees')
      .get();
    
    const records = {};
    snapshot.forEach(doc => {
      records[doc.id] = doc.data();
    });
    return records;
  } catch (error) {
    throw new Error(`Failed to fetch fee records: ${error.message}`);
  }
};

// ==================== PAYMENT MANAGEMENT ====================

/**
 * Record a payment for a student
 * Automatically updates fee balance and status
 * @param {string} studentId
 * @param {string} term
 * @param {object} payment - { amount, date, method, receivedBy, reference }
 */
const recordPayment = async (studentId, term, payment, admin, session) => {
  try {
    if (!window.db) throw new Error('Firebase not initialized');
    
    // Generate payment ID
    const paymentId = window.db.collection('temp').doc().id;
    
    const paymentData = {
      paymentId,
      amount: payment.amount,
      date: payment.date || new Date().toISOString().split('T')[0],
      method: payment.method || 'Cash', // Cash | Transfer | POS
      receivedBy: payment.receivedBy || '',
      reference: payment.reference || '',
      // Bursar/Admin tracking for audit trail
      recordedBy: admin?.uid || 'unknown',
      recordedByName: admin?.name || 'Unknown Admin',
      recordedAt: window.firebase.firestore.Timestamp.now(),
      createdAt: window.firebase.firestore.Timestamp.now(),
    };

    // Save payment record
    await window.db
      .collection('students')
      .doc(studentId)
      .collection('fees')
      .doc(term)
      .collection('payments')
      .doc(paymentId)
      .set(paymentData);
    
    // Update fee record
    await updateFeeBalance(studentId, term, session);
    
    return { ...paymentData };
  } catch (error) {
    throw new Error(`Failed to record payment: ${error.message}`);
  }
};

/**
 * Calculate and update fee balance and status
 * Called automatically after each payment
 */
const updateFeeBalance = async (studentId, term, session) => {
  try {
    if (!window.db) throw new Error('Firebase not initialized');
    
    // Get fee record
    const feeRef = window.db
      .collection('students')
      .doc(studentId)
      .collection('fees')
      .doc(term);
    
    let feeDoc = await feeRef.get();
    if (!feeDoc.exists) {
      // Fee record doesn't exist, create a minimal one if session is provided
      if (session) {
        // Try to get the student info and fee structure to initialize
        const studentDoc = await window.db.collection('students').doc(studentId).get();
        const studentData = studentDoc.data();
        
        if (studentData && studentData.class) {
          // Get the fee structure for this class/term/session
          const feeStructure = await getFeeStructure(studentData.class, term, session);
          if (feeStructure) {
            const totalFee = feeStructure.totalFee || 0;
            // Initialize the fee record
            await feeRef.set({
              classId: studentData.class,
              term,
              session,
              totalFee,
              totalPaid: 0,
              balance: totalFee,
              status: 'Unpaid',
              createdAt: window.firebase.firestore.Timestamp.now(),
              updatedAt: window.firebase.firestore.Timestamp.now(),
            });
          }
        }
      }
      
      // Re-fetch the fee document
      feeDoc = await feeRef.get();
      if (!feeDoc.exists) {
        throw new Error('Fee record not found and could not be created');
      }
    }
    
    const feeData = feeDoc.data();
    
    // Get all payments
    const paymentsSnapshot = await feeRef.collection('payments').get();
    let totalPaid = 0;
    
    paymentsSnapshot.forEach(doc => {
      totalPaid += doc.data().amount;
    });
    
    // Calculate balance
    const totalFee = feeData.totalFee;
    const balance = totalFee - totalPaid;
    
    // Determine status
    let status = 'Unpaid';
    if (balance === 0) {
      status = 'Paid';
    } else if (totalPaid > 0) {
      status = 'Part Payment';
    }
    
    // Update fee record
    await feeRef.update({
      totalPaid,
      balance,
      status,
      updatedAt: window.firebase.firestore.Timestamp.now(),
    });
    
    return { totalPaid, balance, status };
  } catch (error) {
    throw new Error(`Failed to update fee balance: ${error.message}`);
  }
};

/**
 * Get all payments for a student's term
 */
const getStudentPayments = async (studentId, term) => {
  try {
    if (!window.db) throw new Error('Firebase not initialized');
    
    const snapshot = await window.db
      .collection('students')
      .doc(studentId)
      .collection('fees')
      .doc(term)
      .collection('payments')
      .orderBy('createdAt', 'desc')
      .get();
    
    const payments = [];
    snapshot.forEach(doc => {
      payments.push(doc.data());
    });
    return payments;
  } catch (error) {
    throw new Error(`Failed to fetch payments: ${error.message}`);
  }
};

/**
 * Delete payment (admin only) - triggers balance recalculation
 */
const deletePayment = async (studentId, term, paymentId) => {
  try {
    if (!window.db) throw new Error('Firebase not initialized');
    
    await window.db
      .collection('students')
      .doc(studentId)
      .collection('fees')
      .doc(term)
      .collection('payments')
      .doc(paymentId)
      .delete();
    
    // Recalculate balance
    await updateFeeBalance(studentId, term);
  } catch (error) {
    throw new Error(`Failed to delete payment: ${error.message}`);
  }
};

// ==================== CLASS SUMMARY DASHBOARD ====================

/**
 * Get fee summary for an entire class in a term
 * Returns: expected, collected, outstanding, number of students
 */
const getClassFeeSummary = async (classId, term, session) => {
  try {
    if (!window.db) throw new Error('Firebase not initialized');
    
    // Get all students in class
    const studentsSnapshot = await window.db
      .collection('students')
      .where('class', '==', classId)
      .get();
    
    let totalExpected = 0;
    let totalCollected = 0;
    let feeRecords = [];
    
    // Get each student's fee record
    for (const studentDoc of studentsSnapshot.docs) {
      const studentId = studentDoc.id;
      const feeRecord = await getStudentFeeRecord(studentId, term, session);
      
      if (feeRecord) {
        totalExpected += feeRecord.totalFee;
        totalCollected += feeRecord.totalPaid;
        feeRecords.push({
          studentId,
          studentName: studentDoc.data().name,
          ...feeRecord,
        });
      }
    }
    
    const totalOutstanding = totalExpected - totalCollected;
    const collectionRate = totalExpected > 0 ? ((totalCollected / totalExpected) * 100).toFixed(2) : 0;
    
    return {
      classId,
      term,
      totalStudents: studentsSnapshot.size,
      totalExpected,
      totalCollected,
      totalOutstanding,
      collectionRate: parseFloat(collectionRate),
      feeRecords,
    };
  } catch (error) {
    throw new Error(`Failed to get class fee summary: ${error.message}`);
  }
};

/**
 * Get students with pending fees (balance > 0)
 */
const getStudentsWithPendingFees = async (classId, term, session) => {
  try {
    if (!window.db) throw new Error('Firebase not initialized');
    
    const studentsSnapshot = await window.db
      .collection('students')
      .where('class', '==', classId)
      .get();
    
    const pendingStudents = [];
    
    for (const studentDoc of studentsSnapshot.docs) {
      const feeRecord = await getStudentFeeRecord(studentDoc.id, term, session);
      
      if (feeRecord && feeRecord.balance > 0) {
        pendingStudents.push({
          studentId: studentDoc.id,
          name: studentDoc.data().name,
          parentPhoneNumber: studentDoc.data().parentPhoneNumber || '',
          ...feeRecord,
        });
      }
    }
    
    return pendingStudents;
  } catch (error) {
    throw new Error(`Failed to get pending fees: ${error.message}`);
  }
};

/**
 * Bulk initialize fees for all students in a class (when setting fee structure)
 * IMPORTANT: Preserves existing payment history when updating fee structures
 */
const bulkInitializeStudentFees = async (classId, term, totalFee, session) => {
  try {
    if (!window.db) throw new Error('Firebase not initialized');
    
    const studentsSnapshot = await window.db
      .collection('students')
      .where('class', '==', classId)
      .get();
    
    const batch = window.db.batch();
    
    for (const studentDoc of studentsSnapshot.docs) {
      const feeRef = window.db
        .collection('students')
        .doc(studentDoc.id)
        .collection('fees')
        .doc(term);
      
      // Check if fee record already exists
      const existingFeeDoc = await feeRef.get();
      
      if (existingFeeDoc.exists) {
        // Fee structure already exists - this is an UPDATE
        // Preserve payment history and recalculate balance
        const existingData = existingFeeDoc.data();
        const totalPaid = existingData.totalPaid || 0;
        const newBalance = totalFee - totalPaid;
        
        // Determine status based on new balance
        let newStatus = 'Unpaid';
        if (newBalance === 0) {
          newStatus = 'Paid';
        } else if (totalPaid > 0) {
          newStatus = 'Part Payment';
        }
        
        // Use merge to preserve payment history subcollection
        batch.update(feeRef, {
          totalFee,           // Update the fee amount
          balance: newBalance, // Recalculate balance
          status: newStatus,   // Update status based on new fee amount
          updatedAt: window.firebase.firestore.Timestamp.now(),
          // Keep session, totalPaid, and payment history intact
        });
      } else {
        // New fee record - first time initialization
        batch.set(feeRef, {
          classId,
          term,
          session,
          totalFee,
          totalPaid: 0,
          balance: totalFee,
          status: 'Unpaid',
          createdAt: window.firebase.firestore.Timestamp.now(),
          updatedAt: window.firebase.firestore.Timestamp.now(),
        });
      }
    }
    
    await batch.commit();
    return { studentsInitialized: studentsSnapshot.size };
  } catch (error) {
    throw new Error(`Failed to bulk initialize fees: ${error.message}`);
  }
};

// ==================== RECEIPT GENERATION ====================

/**
 * Generate receipt data for a payment
 */
const generateReceiptData = async (studentId, term, paymentId) => {
  try {
    if (!window.db) throw new Error('Firebase not initialized');
    
    // Get payment details
    const paymentDoc = await window.db
      .collection('students')
      .doc(studentId)
      .collection('fees')
      .doc(term)
      .collection('payments')
      .doc(paymentId)
      .get();
    
    if (!paymentDoc.exists) throw new Error('Payment not found');
    
    // Get student details
    const studentDoc = await window.db.collection('students').doc(studentId).get();
    if (!studentDoc.exists) throw new Error('Student not found');
    
    // Get fee record
    const feeRecord = await getStudentFeeRecord(studentId, term);
    
    return {
      receiptNumber: paymentId,
      paymentDate: paymentDoc.data().date,
      paymentMethod: paymentDoc.data().method,
      paymentAmount: paymentDoc.data().amount,
      paymentReference: paymentDoc.data().reference,
      receivedBy: paymentDoc.data().receivedBy,
      
      studentName: studentDoc.data().name,
      studentId: studentId,
      className: studentDoc.data().classId,
      term,
      
      feeRecord,
      schoolName: 'Abimbola School',
      schoolContactInfo: 'admin@abimbolaschool.com',
    };
  } catch (error) {
    throw new Error(`Failed to generate receipt: ${error.message}`);
  }
};

// ==================== REPORTING ====================

/**
 * Get fee reminder list for students with balance
 * Used for SMS bulk export
 */
const getFeeReminderList = async (classId, term) => {
  try {
    const pendingStudents = await getStudentsWithPendingFees(classId, term);
    
    return pendingStudents
      .filter(student => student.parentPhoneNumber)
      .map(student => ({
        studentName: student.name,
        parentPhone: student.parentPhoneNumber,
        balance: student.balance,
        dueAmount: student.balance,
        term,
      }));
  } catch (error) {
    throw new Error(`Failed to get fee reminder list: ${error.message}`);
  }
};

/**
 * Get all school fee statistics across classes and terms
 */
const getSchoolFeeStatistics = async () => {
  try {
    if (!window.db) throw new Error('Firebase not initialized');
    
    // Get all classes
    const classesSnapshot = await window.db.collection('classes').get();
    
    let schoolTotalExpected = 0;
    let schoolTotalCollected = 0;
    let classSummaries = [];
    
    for (const classDoc of classesSnapshot.docs) {
      const classId = classDoc.id;
      
      // Get summaries for all terms
      for (const term of ['firstTerm', 'secondTerm', 'thirdTerm']) {
        try {
          const summary = await getClassFeeSummary(classId, term);
          schoolTotalExpected += summary.totalExpected;
          schoolTotalCollected += summary.totalCollected;
          
          if (summary.totalExpected > 0) {
            classSummaries.push({
              className: classDoc.data().name,
              term,
              ...summary,
            });
          }
        } catch (e) {
          // Term may not exist yet
        }
      }
    }
    
    const schoolTotalOutstanding = schoolTotalExpected - schoolTotalCollected;
    
    return {
      schoolTotalExpected,
      schoolTotalCollected,
      schoolTotalOutstanding,
      classSummaries,
    };
  } catch (error) {
    throw new Error(`Failed to get school statistics: ${error.message}`);
  }
};

// Export functions to global scope for app.js to use
window.createFeeStructure = createFeeStructure;
window.getFeeStructure = getFeeStructure;
window.getClassFeeStructures = getClassFeeStructures;
window.initializeStudentFeeRecord = initializeStudentFeeRecord;
window.getStudentFeeRecord = getStudentFeeRecord;
window.recordPayment = recordPayment;
window.updateFeeBalance = updateFeeBalance;
window.deletePayment = deletePayment;
window.getClassFeeSummary = getClassFeeSummary;
window.getStudentsWithPendingFees = getStudentsWithPendingFees;
window.bulkInitializeStudentFees = bulkInitializeStudentFees;
window.generateReceiptData = generateReceiptData;
window.getFeeReminderList = getFeeReminderList;
window.getSchoolFeeStatistics = getSchoolFeeStatistics;
window.getStudentPayments = getStudentPayments;
