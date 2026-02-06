// Teacher Service - Handles teacher-specific operations with RBAC
// Uses global db from firebase.js and functions from rbac.js

const getTeacherDashboardOverview = async (user) => {
  if (!user) throw new Error('User not authenticated');

  try {
    const assignedClasses = user.assignedClasses || [];
    const assignedSubjects = user.assignedSubjects || [];

    return {
      totalClasses: assignedClasses.length,
      totalStudents: 0,
      totalSubjects: assignedSubjects.length,
      announcements: [],
      timetable: [],
      pendingActions: []
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

    const classesSnapshot = await window.db.collection('classes')
      .where('id', 'in', assignedClasses)
      .get();

    return classesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    throw new Error(`Failed to fetch teacher classes: ${error.message}`);
  }
};

const getClassStudents = async (user, classId) => {
  if (!user || !user.assignedClasses || !user.assignedClasses.includes(classId)) {
    throw new Error('Access denied: Not assigned to this class');
  }

  try {
    const studentsSnapshot = await window.db.collection('students')
      .where('classId', '==', classId)
      .get();

    return studentsSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || '',
        email: data.email || ''
      };
    });
  } catch (error) {
    throw new Error(`Failed to fetch class students: ${error.message}`);
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
window.getTeacherProfile = getTeacherProfile;
window.updateTeacherProfile = updateTeacherProfile;
window.getPendingTeachers = getPendingTeachers;
window.getApprovedTeachers = getApprovedTeachers;
window.approveTeacher = approveTeacher;
window.updateTeacherAssignment = updateTeacherAssignment;
