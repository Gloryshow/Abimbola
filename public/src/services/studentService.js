// Student Service - Handles student registration and management (Admin only)
// Uses global db from firebase.js

const registerStudent = async (studentData) => {
  try {
    if (!studentData.name || !studentData.email || !studentData.class) {
      throw new Error('Name, email, and class are required');
    }

    // Create student document with auto-generated ID
    const studentDoc = {
      name: studentData.name,
      email: studentData.email,
      class: studentData.class,
      dateOfBirth: studentData.dateOfBirth || '',
      phone: studentData.phone || '',
      address: studentData.address || '',
      registrationNumber: studentData.registrationNumber || '',
      parentName: studentData.parentName || '',
      parentPhone: studentData.parentPhone || '',
      enrollmentDate: window.firebase.firestore.Timestamp.now(),
      createdAt: window.firebase.firestore.Timestamp.now(),
      updatedAt: window.firebase.firestore.Timestamp.now(),
    };

    const docRef = await window.db.collection('students').add(studentDoc);
    return { id: docRef.id, ...studentDoc };
  } catch (error) {
    throw new Error(`Failed to register student: ${error.message}`);
  }
};

const getStudents = async () => {
  try {
    const studentsSnapshot = await window.db.collection('students')
      .orderBy('enrollmentDate', 'desc')
      .get();

    return studentsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    throw new Error(`Failed to fetch students: ${error.message}`);
  }
};

const getStudentsByClass = async (className) => {
  try {
    const studentsSnapshot = await window.db.collection('students')
      .where('class', '==', className)
      .get();

    return studentsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    throw new Error(`Failed to fetch students by class: ${error.message}`);
  }
};

const updateStudent = async (studentId, updateData) => {
  try {
    const updateObj = {
      ...updateData,
      updatedAt: window.firebase.firestore.Timestamp.now(),
    };

    await window.db.collection('students').doc(studentId).update(updateObj);
    return { success: true, message: 'Student updated successfully' };
  } catch (error) {
    throw new Error(`Failed to update student: ${error.message}`);
  }
};

const deleteStudent = async (studentId) => {
  try {
    await window.db.collection('students').doc(studentId).delete();
    return { success: true, message: 'Student deleted successfully' };
  } catch (error) {
    throw new Error(`Failed to delete student: ${error.message}`);
  }
};

// Expose functions globally
window.registerStudent = registerStudent;
window.getStudents = getStudents;
window.getStudentsByClass = getStudentsByClass;
window.updateStudent = updateStudent;
window.deleteStudent = deleteStudent;
