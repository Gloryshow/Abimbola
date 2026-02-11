// Student Service - Handles student registration and management (Admin only)
// Uses global db from firebase.js

// Generate registration number automatically based on current year
const generateRegistrationNumber = async () => {
  try {
    const currentYear = new Date().getFullYear();
    const existingStudents = await window.db.collection('students')
      .where('registrationNumber', '>=', `${currentYear}-`)
      .where('registrationNumber', '<', `${currentYear + 1}-`)
      .get();
    
    // Extract the numeric part and find the highest
    let maxNumber = 0;
    existingStudents.docs.forEach(doc => {
      const regNum = doc.data().registrationNumber;
      const match = regNum.match(new RegExp(`${currentYear}-(\\d+)`));
      if (match) {
        const num = parseInt(match[1]);
        maxNumber = Math.max(maxNumber, num);
      }
    });
    
    const nextNumber = maxNumber + 1;
    return `${currentYear}-${String(nextNumber).padStart(3, '0')}`;
  } catch (error) {
    throw new Error(`Failed to generate registration number: ${error.message}`);
  }
};

const registerStudent = async (studentData) => {
  try {
    if (!studentData.name || !studentData.email || !studentData.class || !studentData.session) {
      throw new Error('Name, email, class, and session are required');
    }

    // Auto-generate registration number if not provided
    const registrationNumber = studentData.registrationNumber || await generateRegistrationNumber();

    // Create student document with auto-generated ID
    const studentDoc = {
      name: studentData.name,
      email: studentData.email,
      class: studentData.class,
      session: studentData.session,
      dateOfBirth: studentData.dateOfBirth || '',
      phone: studentData.phone || '',
      address: studentData.address || '',
      registrationNumber: registrationNumber,
      parentName: studentData.parentName || '',
      parentPhone: studentData.parentPhone || '',
      enrollmentDate: window.firebase.firestore.Timestamp.now(),
      createdAt: window.firebase.firestore.Timestamp.now(),
      updatedAt: window.firebase.firestore.Timestamp.now(),
      // Optional fees configuration
      optionalFees: studentData.optionalFees || {
        schoolBus: {
          enabled: false
        }
      }
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
window.generateRegistrationNumber = generateRegistrationNumber;
