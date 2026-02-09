// Teacher Service - Handles teacher-specific operations with RBAC
// Uses global db from firebase.js and functions from rbac.js

const getTeacherDashboardOverview = async (user) => {
  if (!user) throw new Error('User not authenticated');

  try {
    const assignedClasses = user.assignedClasses || [];
    const assignedSubjects = user.assignedSubjects || [];
    
    let totalStudents = 0;
    let pendingActions = [];

    // If admin, count all students
    if (user.role === 'admin') {
      const studentsSnapshot = await window.db.collection('students').get();
      totalStudents = studentsSnapshot.size;
    } else if (user.role === 'teacher' && assignedClasses.length > 0) {
      // If teacher, count students in their assigned classes
      try {
        const studentsSnapshot = await window.db.collection('students')
          .where('class', 'in', assignedClasses)
          .get();
        totalStudents = studentsSnapshot.size;
      } catch (error) {
        console.error('Error counting students for teacher:', error);
        totalStudents = 0;
      }

      // Check for pending attendance - for each assigned class
      const today = new Date().toISOString().split('T')[0];
      
      for (const classId of assignedClasses) {
        try {
          const attendanceId = `${classId}_${today}`;
          const attendanceDoc = await window.db.collection('attendance').doc(attendanceId).get();
          
          // If attendance is NOT marked (by ANY teacher), add to pending actions
          if (!attendanceDoc.exists) {
            pendingActions.push({
              title: `Register for ${classId}`,
              description: `Attendance has not been marked for ${classId} today`,
              type: 'attendance',
              classId: classId,
              actionRequired: true
            });
          }
          // If attendance IS marked (by any teacher), it's cleared - no action needed
        } catch (error) {
          console.error(`Error checking attendance for ${classId}:`, error);
        }
      }
    }

    return {
      totalClasses: assignedClasses.length,
      totalStudents: totalStudents,
      totalSubjects: assignedSubjects.length,
      announcements: [],
      timetable: [],
      pendingActions: pendingActions
    };
  } catch (error) {
    throw new Error(`Failed to fetch dashboard overview: ${error.message}`);
  }
};

const getTeacherClasses = async (user) => {
  if (!user || !user.assignedClasses) return [];

  try {
    const assignedClasses = user.assignedClasses || [];
    if (assignedClasses.length === 0) return [];

    // Convert class names to class objects
    return assignedClasses.map((className) => ({
      id: className,
      name: className,
    }));
  } catch (error) {
    throw new Error(`Failed to fetch teacher classes: ${error.message}`);
  }
};

const getClassStudents = async (user, classId) => {
  // Allow admins to view any class's students
  if (user.role !== 'admin' && (!user.assignedClasses || !user.assignedClasses.includes(classId))) {
    throw new Error('Access denied: Not assigned to this class');
  }

  try {
    const studentsSnapshot = await window.db.collection('students')
      .where('class', '==', classId)
      .get();

    return studentsSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || '',
        email: data.email || '',
        regNum: data.regNum || ''
      };
    });
  } catch (error) {
    throw new Error(`Failed to fetch class students: ${error.message}`);
  }
};

/**
 * Get subjects assigned to teacher for a specific class
 */
const getTeacherSubjects = async (user, classId) => {
  if (!user) return [];

  try {
    // Get all assigned subjects for the teacher
    const assignedSubjects = user.assignedSubjects || [];
    
    if (assignedSubjects.length === 0) return [];

    // Try to fetch full subject info from Firestore
    const subjectsSnapshot = await window.db.collection('subjects').get();
    const subjectsMap = {};
    subjectsSnapshot.docs.forEach(doc => {
      subjectsMap[doc.id] = doc.data().name || doc.id;
    });

    // Return subjects as objects with proper names
    return assignedSubjects.map((subjectId) => ({
      id: subjectId,
      name: subjectsMap[subjectId] || subjectId, // Use full name or ID as fallback
    }));
  } catch (error) {
    throw new Error(`Failed to fetch teacher subjects: ${error.message}`);
  }
};

/**
 * Get all classes (admin only)
 */
const getAllClasses = async (user) => {
  if (!user || user.role !== 'admin') {
    throw new Error('Access denied: Only admins can view all classes');
  }

  try {
    const classesSet = new Set();
    
    // Get all teachers and collect their assigned classes
    const teachersSnapshot = await window.db.collection('teachers').get();
    teachersSnapshot.docs.forEach((doc) => {
      const teacher = doc.data();
      if (teacher.assignedClasses && Array.isArray(teacher.assignedClasses)) {
        teacher.assignedClasses.forEach((className) => classesSet.add(className));
      }
    });
    
    // Also get all classes from students collection
    const studentsSnapshot = await window.db.collection('students').get();
    studentsSnapshot.docs.forEach((doc) => {
      const student = doc.data();
      if (student.class) {
        classesSet.add(student.class);
      }
    });
    
    // Convert to array of class objects, sorted
    return Array.from(classesSet)
      .sort()
      .map((className) => ({
        id: className,
        name: className,
      }));
  } catch (error) {
    throw new Error(`Failed to fetch all classes: ${error.message}`);
  }
};

/**
 * Get all students in a class (admin only)
 */
const getAllStudentsInClass = async (user, classId) => {
  // Allow admins and teachers assigned to the class
  if (!user) {
    throw new Error('Access denied: User not authenticated');
  }
  
  if (user.role !== 'admin' && (!user.assignedClasses || !user.assignedClasses.includes(classId))) {
    throw new Error('Access denied: Not assigned to this class');
  }

  try {
    const studentsSnapshot = await window.db.collection('students')
      .where('class', '==', classId)
      .get();

    return studentsSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || '',
        email: data.email || '',
        registrationNumber: data.registrationNumber || ''
      };
    });
  } catch (error) {
    throw new Error(`Failed to fetch students in class: ${error.message}`);
  }
};

const getTeacherProfile = async (user) => {
  try {
    const teacherDoc = await window.db.collection('teachers').doc(user.uid).get();
    if (!teacherDoc.exists) {
      throw new Error('Teacher profile not found');
    }
    return teacherDoc.data();
  } catch (error) {
    throw new Error(`Failed to fetch teacher profile: ${error.message}`);
  }
};

const updateTeacherProfile = async (user, updateData) => {
  try {
    const allowedFields = ['phone', 'department', 'bio'];
    const filteredData = {};

    allowedFields.forEach((field) => {
      if (updateData[field] !== undefined) {
        filteredData[field] = updateData[field];
      }
    });

    filteredData.updatedAt = window.firebase.firestore.Timestamp.now();

    await window.db.collection('teachers').doc(user.uid).update(filteredData);

    return { success: true, message: 'Profile updated successfully' };
  } catch (error) {
    throw new Error(`Failed to update profile: ${error.message}`);
  }
};

const getPendingTeachers = async () => {
  try {
    const pendingSnapshot = await window.db.collection('teachers')
      .where('approved', '==', false)
      .get();

    return pendingSnapshot.docs.map((doc) => ({
      uid: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    throw new Error(`Failed to fetch pending teachers: ${error.message}`);
  }
};

const getApprovedTeachers = async () => {
  try {
    const approvedSnapshot = await window.db.collection('teachers')
      .where('approved', '==', true)
      .get();

    return approvedSnapshot.docs.map((doc) => ({
      uid: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    throw new Error(`Failed to fetch approved teachers: ${error.message}`);
  }
};

const approveTeacher = async (teacherUid) => {
  try {
    await window.db.collection('teachers').doc(teacherUid).update({
      approved: true,
      updatedAt: window.firebase.firestore.Timestamp.now(),
    });
    return { success: true, message: 'Teacher approved successfully' };
  } catch (error) {
    throw new Error(`Failed to approve teacher: ${error.message}`);
  }
};

const updateTeacherAssignment = async (teacherUid, assignmentData) => {
  try {
    const updateObj = {
      role: assignmentData.role || 'teacher',
      departments: assignmentData.departments || [],
      assignedClasses: assignmentData.assignedClasses || [],
      assignedSubjects: assignmentData.assignedSubjects || [],
      updatedAt: window.firebase.firestore.Timestamp.now(),
    };
    
    // Keep phone if provided
    if (assignmentData.phone !== undefined) {
      updateObj.phone = assignmentData.phone;
    }
    
    await window.db.collection('teachers').doc(teacherUid).update(updateObj);
    return { success: true, message: 'Teacher assignment updated successfully' };
  } catch (error) {
    throw new Error(`Failed to update teacher assignment: ${error.message}`);
  }
};

// Expose functions globally
window.getTeacherDashboardOverview = getTeacherDashboardOverview;
window.getTeacherClasses = getTeacherClasses;
window.getClassStudents = getClassStudents;
window.getTeacherSubjects = getTeacherSubjects;
window.getAllClasses = getAllClasses;
window.getAllStudentsInClass = getAllStudentsInClass;
window.getTeacherProfile = getTeacherProfile;
window.updateTeacherProfile = updateTeacherProfile;
window.getPendingTeachers = getPendingTeachers;
window.getApprovedTeachers = getApprovedTeachers;
window.approveTeacher = approveTeacher;
window.updateTeacherAssignment = updateTeacherAssignment;
