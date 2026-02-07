// Role-Based Access Control (RBAC) Utilities
// USER_ROLES defined in authService.js

/**
 * Check if user has specific role
 */
const hasRole = (user, requiredRole) => {
  if (!user || !user.role) return false;
  return user.role === requiredRole;
};

/**
 * Check if user is admin
 */
const isAdmin = (user) => hasRole(user, 'admin');

/**
 * Check if user is teacher
 */
const isTeacher = (user) => hasRole(user, 'teacher');

/**
 * Check if teacher is assigned to class
 */
const isAssignedToClass = (user, classId) => {
  if (!isTeacher(user)) return false;
  return user.assignedClasses && user.assignedClasses.includes(classId);
};

/**
 * Check if teacher teaches subject
 */
const teacheSubject = (user, subjectId) => {
  if (!isTeacher(user)) return false;
  return user.assignedSubjects && user.assignedSubjects.includes(subjectId);
};

/**
 * Check if teacher can access class
 */
const canAccessClass = (user, classId) => {
  return isAdmin(user) || isAssignedToClass(user, classId);
};

/**
 * Check if teacher can take attendance for class
 */
const canTakeAttendance = (user, classId) => {
  return canAccessClass(user, classId);
};

/**
 * Check if teacher can enter results for subject
 */
const canEnterResults = (user, subjectId) => {
  return isAdmin(user) || teacheSubject(user, subjectId);
};

/**
 * Check if user can register subjects for a class
 * Teachers can only register for their assigned classes
 * Admins can register for any class
 */
const canRegisterSubjects = (user, classId) => {
  return isAdmin(user) || isAssignedToClass(user, classId);
};

/**
 * Check if user can edit subject registrations for a class
 */
const canEditSubjectRegistrations = (user, classId) => {
  return isAdmin(user) || isAssignedToClass(user, classId);
};

/**
 * Check if user can view subject registrations for a class
 */
const canViewSubjectRegistrations = (user, classId) => {
  return isAdmin(user) || isAssignedToClass(user, classId);
};

/**
 * Check if user can remove student from a subject
 */
const canRemoveStudentFromSubject = (user, classId) => {
  return isAdmin(user) || isAssignedToClass(user, classId);
};

/**
 * Filter classes based on user role
 */
const filterUserClasses = (user, classes) => {
  if (isAdmin(user)) return classes;
  if (isTeacher(user)) {
    return classes.filter((cls) => isAssignedToClass(user, cls.id));
  }
  return [];
};

/**
 * Filter subjects based on user role
 */
const filterUserSubjects = (user, subjects) => {
  if (isAdmin(user)) return subjects;
  if (isTeacher(user)) {
    return subjects.filter((subj) => teacheSubject(user, subj.id));
  }
  return [];
};

/**
 * Check if user can manage fees (admin/bursar only)
 */
const canManageFees = (user) => {
  return isAdmin(user);
};

/**
 * Check if user can view fee structure (admin/bursar only)
 */
const canViewFeeStructure = (user) => {
  return isAdmin(user);
};

/**
 * Check if user can create/edit fee structure (admin/bursar only)
 */
const canEditFeeStructure = (user) => {
  return isAdmin(user);
};

/**
 * Check if user can record payments (admin/bursar only)
 */
const canRecordPayments = (user) => {
  return isAdmin(user);
};

/**
 * Check if user can view student fees (admin/bursar only)
 */
const canViewStudentFees = (user) => {
  return isAdmin(user);
};

/**
 * Check if user can generate receipts (admin/bursar only)
 */
const canGenerateReceipts = (user) => {
  return isAdmin(user);
};

/**
 * Verify user has required permission
 */
const verifyPermission = (user, requiredPermission) => {
  const permissions = {
    view_all_classes: (u) => isAdmin(u),
    view_assigned_classes: (u) => isTeacher(u),
    view_all_students: (u) => isAdmin(u),
    view_class_students: (u) => isTeacher(u),
    take_attendance: (u) => isTeacher(u),
    enter_results: (u) => isTeacher(u),
    register_subjects: (u) => isTeacher(u) || isAdmin(u),
    edit_subject_registrations: (u) => isTeacher(u) || isAdmin(u),
    view_subject_registrations: (u) => isTeacher(u) || isAdmin(u),
    remove_student_from_subject: (u) => isTeacher(u) || isAdmin(u),
    view_announcements: (u) => true, // Both admin and teacher
    post_announcements: (u) => isAdmin(u),
    view_profile: (u) => true,
    edit_own_profile: (u) => true,
    edit_other_profiles: (u) => isAdmin(u),
    // Fee management permissions (admin only)
    manage_fees: (u) => canManageFees(u),
    view_fee_structure: (u) => canViewFeeStructure(u),
    edit_fee_structure: (u) => canEditFeeStructure(u),
    record_payments: (u) => canRecordPayments(u),
    view_student_fees: (u) => canViewStudentFees(u),
    generate_receipts: (u) => canGenerateReceipts(u),
    view_class_fee_summary: (u) => isAdmin(u),
    view_school_fee_statistics: (u) => isAdmin(u),
    // End fee permissions
    view_salaries: (u) => isAdmin(u),
    access_settings: (u) => isAdmin(u),
  };

  const permissionCheck = permissions[requiredPermission];
  if (!permissionCheck) {
    console.warn(`Unknown permission: ${requiredPermission}`);
    return false;
  }

  return permissionCheck(user);
};

/**
 * Assert user has permission (throws error if not)
 */
const assertPermission = (user, requiredPermission) => {
  if (!verifyPermission(user, requiredPermission)) {
    throw new Error(`Access denied: ${requiredPermission}`);
  }
};
