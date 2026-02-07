// Subject Registration Service - RBAC enforced
// Handles subject registration for students
// Teachers can register/edit subjects for their assigned classes only
// Admins can register/edit subjects for all classes

/**
 * Register a subject for a student
 * Teachers can only register subjects for their assigned classes
 * Admins can register for any class
 */
const registerStudentSubject = async (user, registrationData) => {
  try {
    // Validate required fields
    if (!registrationData.studentId || !registrationData.subjectId || !registrationData.classId) {
      throw new Error('Student ID, Subject ID, and Class ID are required');
    }

    // Check permissions
    if (!isAdmin(user)) {
      // Non-admin must be a teacher assigned to this class
      if (!isAssignedToClass(user, registrationData.classId)) {
        throw new Error('Access denied: You are not assigned to this class');
      }
    }

    // Verify student exists and belongs to the specified class
    const studentDoc = await window.db.collection('students').doc(registrationData.studentId).get();
    if (!studentDoc.exists) {
      throw new Error('Student not found');
    }

    const student = studentDoc.data();
    if (student.class !== registrationData.classId) {
      throw new Error('Student does not belong to the specified class');
    }

    // Try to get subject details, but allow registration even if subject doesn't exist in collection
    let subjectName = registrationData.subjectId; // Default to ID if not found
    const subjectDoc = await window.db.collection('subjects').doc(registrationData.subjectId).get();
    if (subjectDoc.exists) {
      subjectName = subjectDoc.data().name || registrationData.subjectId;
    }

    // Check if subject is already registered for this student
    const existingRegistration = await window.db.collection('studentSubjects')
      .where('studentId', '==', registrationData.studentId)
      .where('subjectId', '==', registrationData.subjectId)
      .where('classId', '==', registrationData.classId)
      .get();

    if (!existingRegistration.empty) {
      throw new Error('Student is already registered for this subject in this class');
    }

    // Create subject registration
    const registrationDoc = {
      studentId: registrationData.studentId,
      studentName: student.name,
      subjectId: registrationData.subjectId,
      subjectName: subjectName,  // Use the variable we created above instead of subjectDoc.data().name
      classId: registrationData.classId,
      registeredBy: user.uid,
      registeredByName: user.name,
      registeredByRole: user.role,
      notes: registrationData.notes || '',
      status: 'active', // active, dropped, suspended
      registeredAt: window.firebase.firestore.Timestamp.now(),
      createdAt: window.firebase.firestore.Timestamp.now(),
      updatedAt: window.firebase.firestore.Timestamp.now(),
    };

    const docRef = await window.db.collection('studentSubjects').add(registrationDoc);

    return {
      id: docRef.id,
      ...registrationDoc,
      success: true,
      message: 'Subject registered successfully',
    };
  } catch (error) {
    throw new Error(`Failed to register student subject: ${error.message}`);
  }
};

/**
 * Get all subjects registered for a student
 */
const getStudentSubjects = async (studentId) => {
  try {
    const subjectsSnapshot = await window.db.collection('studentSubjects')
      .where('studentId', '==', studentId)
      .where('status', '==', 'active')
      .get();

    return subjectsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    throw new Error(`Failed to fetch student subjects: ${error.message}`);
  }
};

/**
 * Get all students registered for a subject in a class
 * Teachers can only view students from their assigned classes
 * Admins can view all students
 */
const getStudentsForSubject = async (user, subjectId, classId) => {
  try {
    // Check permissions
    if (!isAdmin(user)) {
      if (!isAssignedToClass(user, classId)) {
        throw new Error('Access denied: You are not assigned to this class');
      }
    }

    let query = window.db.collection('studentSubjects')
      .where('classId', '==', classId)
      .where('status', '==', 'active');
    
    // Only filter by subject if subjectId is provided
    if (subjectId) {
      query = query.where('subjectId', '==', subjectId);
    }

    const registrationsSnapshot = await query.get();

    return registrationsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    throw new Error(`Failed to fetch students for subject: ${error.message}`);
  }
};

/**
 * Get all subjects registered in a class
 * Teachers can only view their assigned classes
 * Admins can view all classes
 */
const getClassSubjects = async (user, classId) => {
  try {
    // Check permissions
    if (!isAdmin(user)) {
      if (!isAssignedToClass(user, classId)) {
        throw new Error('Access denied: You are not assigned to this class');
      }
    }

    const registrationsSnapshot = await window.db.collection('studentSubjects')
      .where('classId', '==', classId)
      .where('status', '==', 'active')
      .get();

    // Group by subject
    const subjectsMap = new Map();
    registrationsSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (!subjectsMap.has(data.subjectId)) {
        subjectsMap.set(data.subjectId, {
          subjectId: data.subjectId,
          subjectName: data.subjectName,
          classId: data.classId,
          studentCount: 0,
          students: [],
        });
      }
      const subject = subjectsMap.get(data.subjectId);
      subject.studentCount++;
      subject.students.push({
        registrationId: doc.id,
        studentId: data.studentId,
        studentName: data.studentName,
        registeredAt: data.registeredAt,
      });
    });

    return Array.from(subjectsMap.values());
  } catch (error) {
    throw new Error(`Failed to fetch class subjects: ${error.message}`);
  }
};

/**
 * Update subject registration (e.g., change status, add notes)
 * Teachers can only update registrations for their assigned classes
 * Admins can update all registrations
 */
const updateSubjectRegistration = async (user, registrationId, updateData) => {
  try {
    const registrationDocRef = window.db.collection('studentSubjects').doc(registrationId);
    const registrationSnapshot = await registrationDocRef.get();

    if (!registrationSnapshot.exists) {
      throw new Error('Subject registration not found');
    }

    const registration = registrationSnapshot.data();

    // Check permissions
    if (!isAdmin(user)) {
      if (!isAssignedToClass(user, registration.classId)) {
        throw new Error('Access denied: You are not assigned to this class');
      }
    }

    const update = {
      ...updateData,
      updatedAt: window.firebase.firestore.Timestamp.now(),
    };

    // If updating status, validate it
    if (updateData.status) {
      const validStatuses = ['active', 'dropped', 'suspended'];
      if (!validStatuses.includes(updateData.status)) {
        throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }
    }

    await registrationDocRef.update(update);

    return {
      success: true,
      message: 'Subject registration updated successfully',
    };
  } catch (error) {
    throw new Error(`Failed to update subject registration: ${error.message}`);
  }
};

/**
 * Delete/Remove a subject registration
 * Teachers can only remove registrations from their assigned classes
 * Admins can remove any registration
 */
const removeSubjectRegistration = async (user, registrationId) => {
  try {
    const registrationDocRef = window.db.collection('studentSubjects').doc(registrationId);
    const registrationSnapshot = await registrationDocRef.get();

    if (!registrationSnapshot.exists) {
      throw new Error('Subject registration not found');
    }

    const registration = registrationSnapshot.data();

    // Check permissions
    if (!isAdmin(user)) {
      if (!isAssignedToClass(user, registration.classId)) {
        throw new Error('Access denied: You are not assigned to this class');
      }
    }

    await registrationDocRef.delete();

    return {
      success: true,
      message: 'Subject registration removed successfully',
    };
  } catch (error) {
    throw new Error(`Failed to remove subject registration: ${error.message}`);
  }
};

/**
 * Get subject registration summary for a class
 * Shows how many students per subject
 */
const getClassSubjectSummary = async (user, classId) => {
  try {
    // Check permissions
    if (!isAdmin(user)) {
      if (!isAssignedToClass(user, classId)) {
        throw new Error('Access denied: You are not assigned to this class');
      }
    }

    const registrationsSnapshot = await window.db.collection('studentSubjects')
      .where('classId', '==', classId)
      .where('status', '==', 'active')
      .get();

    const summary = {
      classId,
      totalRegistrations: registrationsSnapshot.size,
      subjectStats: {},
    };

    registrationsSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (!summary.subjectStats[data.subjectId]) {
        summary.subjectStats[data.subjectId] = {
          subjectId: data.subjectId,
          subjectName: data.subjectName,
          studentCount: 0,
        };
      }
      summary.subjectStats[data.subjectId].studentCount++;
    });

    return summary;
  } catch (error) {
    throw new Error(`Failed to fetch class subject summary: ${error.message}`);
  }
};

/**
 * Bulk register subjects for multiple students in a class
 * Teachers can only register for their assigned classes
 * Admins can register for any class
 */
const bulkRegisterSubjects = async (user, bulkData) => {
  try {
    // Validate required fields
    if (!bulkData.classId || !bulkData.subjectId || !bulkData.studentIds || bulkData.studentIds.length === 0) {
      throw new Error('Class ID, Subject ID, and Student IDs array are required');
    }

    // Check permissions
    if (!isAdmin(user)) {
      if (!isAssignedToClass(user, bulkData.classId)) {
        throw new Error('Access denied: You are not assigned to this class');
      }
    }

    // Try to get subject details, but allow registration even if subject doesn't exist in collection
    let subjectName = bulkData.subjectId; // Default to ID if not found
    const subjectDoc = await window.db.collection('subjects').doc(bulkData.subjectId).get();
    if (subjectDoc.exists) {
      subjectName = subjectDoc.data().name || bulkData.subjectId;
    }

    const results = {
      successful: [],
      failed: [],
    };

    // Register each student
    for (const studentId of bulkData.studentIds) {
      try {
        const result = await registerStudentSubject(user, {
          studentId,
          subjectId: bulkData.subjectId,
          classId: bulkData.classId,
          notes: bulkData.notes || '',
        });
        results.successful.push({
          studentId,
          registrationId: result.id,
          message: 'Registered successfully',
        });
      } catch (error) {
        results.failed.push({
          studentId,
          error: error.message,
        });
      }
    }

    return {
      success: results.failed.length === 0,
      results,
      summary: {
        totalAttempted: bulkData.studentIds.length,
        successCount: results.successful.length,
        failedCount: results.failed.length,
      },
    };
  } catch (error) {
    throw new Error(`Failed to bulk register subjects: ${error.message}`);
  }
};

// Expose functions globally for HTML onclick handlers
window.registerStudentSubject = registerStudentSubject;
window.getStudentSubjects = getStudentSubjects;
window.getStudentsForSubject = getStudentsForSubject;
window.getClassSubjects = getClassSubjects;
window.updateSubjectRegistration = updateSubjectRegistration;
window.removeSubjectRegistration = removeSubjectRegistration;
window.getClassSubjectSummary = getClassSubjectSummary;
window.bulkRegisterSubjects = bulkRegisterSubjects;
