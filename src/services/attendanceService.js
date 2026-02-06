// Attendance Service - RBAC enforced
// Uses global 'db' and functions from global scope

/**
 * Take attendance for a class
 * Admins can take attendance for any class
 * Teachers can only take attendance for their assigned classes
 */
const takeAttendance = async (user, classId, attendanceData) => {
  // Check if user has access to this class
  if (user.role !== 'admin' && !isAssignedToClass(user, classId)) {
    throw new Error('Access denied: Not assigned to this class');
  }

  try {
    const attendanceId = `${classId}_${new Date().toISOString().split('T')[0]}`;
    const attendanceDoc = {
      classId,
      teacherId: user.uid,
      teacherName: user.name,
      teacherRole: user.role,
      date: new Date().toISOString().split('T')[0],
      timestamp: window.firebase.firestore.Timestamp.now(),
      students: attendanceData.students, // Array of {studentId, studentName, status: 'present'|'absent'|'late'}
      subject: attendanceData.subject || '',
      period: attendanceData.period || '',
      notes: attendanceData.notes || '',
      status: 'submitted',
      updatedAt: window.firebase.firestore.Timestamp.now(),
    };

    await window.db.collection('attendance').doc(attendanceId).set(attendanceDoc);

    return {
      success: true,
      attendanceId,
      message: 'Attendance recorded successfully',
    };
  } catch (error) {
    throw new Error(`Failed to take attendance: ${error.message}`);
  }
};

/**
 * Update attendance (same-day edit)
 */
const updateAttendance = async (user, attendanceId, attendanceData) => {
  try {
    const attendanceDocRef = window.db.collection('attendance').doc(attendanceId);
    const attendanceDocSnapshot = await attendanceDocRef.get();

    if (!attendanceDocSnapshot.exists) {
      throw new Error('Attendance record not found');
    }

    const attendance = attendanceDocSnapshot.data();

    // Verify teacher is the one who took attendance
    if (attendance.teacherId !== user.uid) {
      throw new Error('Access denied: Cannot edit other teachers attendance records');
    }

    // Check if same day (optional: allow only same-day edits)
    const today = new Date().toISOString().split('T')[0];
    const attendanceDate = attendance.date;

    if (attendanceDate !== today) {
      throw new Error('Attendance can only be edited on the same day');
    }

    const updateData = {
      students: attendanceData.students,
      notes: attendanceData.notes || attendance.notes,
      updatedAt: window.firebase.firestore.Timestamp.now(),
    };

    await attendanceDocRef.update(updateData);

    return {
      success: true,
      message: 'Attendance updated successfully',
    };
  } catch (error) {
    throw new Error(`Failed to update attendance: ${error.message}`);
  }
};

/**
 * Get attendance history for a class
 */
const getAttendanceHistory = async (user, classId, filters = {}) => {
  if (!isAssignedToClass(user, classId)) {
    throw new Error('Access denied: Not assigned to this class');
  }

  try {
    const attendanceSnapshot = await window.db.collection('attendance')
      .where('classId', '==', classId)
      .where('teacherId', '==', user.uid)
      .orderBy('date', 'desc')
      .get();

    let records = attendanceSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Apply filters if provided
    if (filters.startDate) {
      records = records.filter(
        (r) => new Date(r.date) >= new Date(filters.startDate)
      );
    }

    if (filters.endDate) {
      records = records.filter(
        (r) => new Date(r.date) <= new Date(filters.endDate)
      );
    }

    if (filters.subject) {
      records = records.filter((r) => r.subject === filters.subject);
    }

    return records;
  } catch (error) {
    throw new Error(`Failed to fetch attendance history: ${error.message}`);
  }
};

/**
 * Get attendance report for a student
 */
const getStudentAttendanceReport = async (user, classId, studentId) => {
  if (!isAssignedToClass(user, classId)) {
    throw new Error('Access denied: Not assigned to this class');
  }

  try {
    const attendanceSnapshot = await window.db.collection('attendance')
      .where('classId', '==', classId)
      .where('teacherId', '==', user.uid)
      .orderBy('date', 'desc')
      .get();

    const studentAttendance = [];

    attendanceSnapshot.docs.forEach((doc) => {
      const attendance = doc.data();
      const studentRecord = attendance.students.find((s) => s.studentId === studentId);

      if (studentRecord) {
        studentAttendance.push({
          date: attendance.date,
          status: studentRecord.status,
          subject: attendance.subject,
          period: attendance.period,
        });
      }
    });

    // Calculate statistics
    const total = studentAttendance.length;
    const present = studentAttendance.filter((a) => a.status === 'present').length;
    const absent = studentAttendance.filter((a) => a.status === 'absent').length;
    const late = studentAttendance.filter((a) => a.status === 'late').length;
    const attendance_percentage = total > 0 ? ((present / total) * 100).toFixed(2) : 0;

    return {
      studentId,
      classId,
      records: studentAttendance,
      statistics: {
        total,
        present,
        absent,
        late,
        attendance_percentage: `${attendance_percentage}%`,
      },
    };
  } catch (error) {
    throw new Error(`Failed to fetch student attendance: ${error.message}`);
  }
};

/**
 * Get class attendance summary
 */
const getClassAttendanceSummary = async (user, classId, date) => {
  if (!isAssignedToClass(user, classId)) {
    throw new Error('Access denied: Not assigned to this class');
  }

  try {
    const attendanceSnapshot = await window.db.collection('attendance')
      .where('classId', '==', classId)
      .where('date', '==', date)
      .get();

    const summary = {
      date,
      classId,
      records: attendanceSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })),
      statistics: {
        totalRecords: attendanceSnapshot.size,
      },
    };

    return summary;
  } catch (error) {
    throw new Error(`Failed to fetch class attendance summary: ${error.message}`);
  }
};

/**
 * Get today's attendance for a class (for display/editing)
 */
const getTodayAttendance = async (user, classId) => {
  // Admins can view any class, teachers only their assigned classes
  if (user.role !== 'admin' && !isAssignedToClass(user, classId)) {
    throw new Error('Access denied: Not assigned to this class');
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    const attendanceId = `${classId}_${today}`;
    
    const attendanceDoc = await window.db.collection('attendance').doc(attendanceId).get();
    
    if (!attendanceDoc.exists) {
      return null; // No attendance record for today yet
    }
    
    return {
      id: attendanceDoc.id,
      ...attendanceDoc.data(),
    };
  } catch (error) {
    throw new Error(`Failed to fetch today's attendance: ${error.message}`);
  }
};

/**
 * Get attendance statistics for a class on a specific date
 */
const getAttendanceStats = async (user, classId, date = null) => {
  // Admins can view any class, teachers only their assigned classes
  if (user.role !== 'admin' && !isAssignedToClass(user, classId)) {
    throw new Error('Access denied: Not assigned to this class');
  }

  try {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const attendanceId = `${classId}_${targetDate}`;
    
    const attendanceDoc = await window.db.collection('attendance').doc(attendanceId).get();
    
    if (!attendanceDoc.exists) {
      return {
        present: 0,
        absent: 0,
        total: 0,
      };
    }
    
    const attendance = attendanceDoc.data();
    const students = attendance.students || [];
    
    const presentCount = students.filter(s => s.status === 'present').length;
    const absentCount = students.filter(s => s.status === 'absent').length;
    
    return {
      present: presentCount,
      absent: absentCount,
      total: students.length,
      students: students,
    };
  } catch (error) {
    throw new Error(`Failed to fetch attendance stats: ${error.message}`);
  }
};

// Expose functions globally
window.takeAttendance = takeAttendance;
window.updateAttendance = updateAttendance;
window.getAttendanceHistory = getAttendanceHistory;
window.getStudentAttendanceReport = getStudentAttendanceReport;
window.getClassAttendanceSummary = getClassAttendanceSummary;
window.getTodayAttendance = getTodayAttendance;
window.getAttendanceStats = getAttendanceStats;