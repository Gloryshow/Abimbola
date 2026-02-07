# School Management System - Teacher Dashboard

## Overview

A comprehensive Teacher Dashboard system built with React and Firebase, featuring strict role-based access control (RBAC) to ensure teachers only access their assigned data.

## Features

### ✅ Dashboard Overview
- Total assigned classes
- Total assigned subjects  
- Today's timetable/periods
- Pending attendance and results
- Quick status indicators

### ✅ My Classes
- View ONLY assigned classes
- See student list (read-only personal info)
- View subjects taught in each class
- Quick actions for attendance and results

### ✅ Attendance Module
- Take attendance ONLY for assigned classes
- Mark students as: Present, Absent, Late
- Same-day attendance editing (optional)
- View attendance history with statistics
- Generate attendance reports per student

### ✅ Results/Grades Module
- Enter scores ONLY for subjects taught
- Component breakdown: Classwork, Test, Examination
- Auto-calculation of total and grade
- View existing results
- Bulk result submission
- Grade distribution analytics
- Read-only after admin locks

### ✅ Announcements Module
- View admin announcements
- View announcements for assigned classes
- Post announcements ONLY to assigned classes
- Edit own announcements
- Delete own announcements
- Track unread announcements

### ✅ Profile Section
- View assigned classes and subjects
- Update personal info (phone, department, bio)
- Change password securely
- View account information

## Access Controls

### Strict RBAC Rules

Teachers **CANNOT**:
- ❌ View all classes or all students
- ❌ View classes not assigned to them
- ❌ View student personal records in detail
- ❌ Access fees, salaries, or admin settings
- ❌ View other teachers' attendance/results
- ❌ Edit other teachers' data
- ❌ Lock/unlock results
- ❌ Access admin panel
- ❌ View/edit fees information
- ❌ View/edit salary information

Teachers **CAN**:
- ✅ View only assigned classes
- ✅ View students in assigned classes
- ✅ Take attendance for assigned classes
- ✅ Enter results for taught subjects
- ✅ View own data and profile
- ✅ Edit own profile information
- ✅ Post to assigned classes
- ✅ Delete own announcements

## Database Schema

### Teachers Collection
```javascript
{
  uid: "string",
  email: "string",
  name: "string",
  role: "teacher",
  department: "string",
  phone: "string",
  assignedClasses: ["classId1", "classId2"],
  assignedSubjects: ["subjectId1", "subjectId2"],
  bio: "string",
  createdAt: "timestamp",
  updatedAt: "timestamp"
}
```

### Classes Collection
```javascript
{
  id: "string",
  name: "string",
  level: "string",
  classTeacher: "string",
  totalStudents: "number"
}
```

### Students Collection
```javascript
{
  id: "string",
  name: "string",
  admissionNumber: "string",
  classId: "string",
  email: "string",
  phone: "string",
  photo: "string"
}
```

### Attendance Collection
```javascript
{
  classId: "string",
  teacherId: "string",
  date: "string (YYYY-MM-DD)",
  timestamp: "timestamp",
  students: [
    {
      studentId: "string",
      status: "present|absent|late"
    }
  ],
  subject: "string",
  period: "string",
  notes: "string",
  status: "submitted",
  updatedAt: "timestamp"
}
```

### Results Collection
```javascript
{
  studentId: "string",
  subjectId: "string",
  classId: "string",
  teacherId: "string",
  termId: "string",
  scores: {
    classwork: "number (0-20)",
    test: "number (0-30)",
    examination: "number (0-50)"
  },
  totalScore: "number (0-100)",
  grade: "string (A-F)",
  comments: "string",
  status: "submitted",
  submittedAt: "timestamp",
  updatedAt: "timestamp"
}
```

### Announcements Collection
```javascript
{
  id: "string",
  type: "admin|teacher|class",
  title: "string",
  content: "string",
  classIds: ["string"],
  authorId: "string",
  authorName: "string",
  authorRole: "admin|teacher",
  visibility: "all|class",
  createdAt: "timestamp",
  updatedAt: "timestamp",
  isPinned: "boolean"
}
```

### Subjects Collection
```javascript
{
  id: "string",
  name: "string",
  code: "string",
  resultsLocked: "boolean"
}
```

### ClassSubjects Collection
```javascript
{
  classId: "string",
  subjectId: "string",
  subjectName: "string",
  subjectCode: "string",
  teacherId: "string",
  creditHours: "number"
}
```

## Firebase Security Rules

The system uses comprehensive Firestore security rules to enforce RBAC:

- Teachers can ONLY read their own profile
- Teachers can ONLY read classes they're assigned to
- Teachers can ONLY read students from assigned classes
- Teachers can ONLY create attendance for assigned classes
- Teachers can ONLY create results for taught subjects
- Teachers can ONLY edit their own announcements
- Admins have full read/write access to all data
- All other access is denied

See `firestore.rules` for complete rules.

## Installation

### 1. Setup React Project
```bash
npx create-react-app school-management-system
cd school-management-system
```

### 2. Install Dependencies
```bash
npm install firebase react-router-dom
```

### 3. Set Environment Variables
Create `.env` file with your Firebase credentials:
```
REACT_APP_FIREBASE_API_KEY=your_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_domain
REACT_APP_FIREBASE_PROJECT_ID=your_project
REACT_APP_FIREBASE_STORAGE_BUCKET=your_bucket
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_id
REACT_APP_FIREBASE_APP_ID=your_app_id
```

### 4. Deploy Firestore Rules
```bash
firebase deploy --only firestore:rules
```

### 5. Create Database Structure

In Firebase Console, create these collections:
- `teachers`
- `admins`
- `classes`
- `students`
- `subjects`
- `classSubjects`
- `attendance`
- `results`
- `announcements`
- `announcementReads`
- `timetables`

### 6. Run Application
```bash
npm start
```

## Project Structure

```
src/
├── components/
│   ├── TeacherDashboard.jsx          # Main dashboard component
│   ├── TeacherDashboard.css          # Dashboard styles
│   ├── Login.jsx                      # Login component
│   └── TeacherDashboard/
│       ├── DashboardOverview.jsx      # Overview module
│       ├── DashboardOverview.css
│       ├── MyClasses.jsx              # Classes module
│       ├── MyClasses.css
│       ├── AttendanceModule.jsx       # Attendance module
│       ├── AttendanceModule.css
│       ├── ResultsModule.jsx          # Results module
│       ├── ResultsModule.css
│       ├── AnnouncementsModule.jsx    # Announcements module
│       ├── AnnouncementsModule.css
│       ├── ProfileModule.jsx          # Profile module
│       └── ProfileModule.css
├── services/
│   ├── firebase.js                    # Firebase config
│   ├── authService.js                 # Auth logic with RBAC
│   ├── teacherService.js              # Teacher operations
│   ├── attendanceService.js           # Attendance operations
│   ├── resultsService.js              # Results operations
│   └── announcementService.js         # Announcements operations
├── utils/
│   └── rbac.js                        # RBAC utility functions
└── hooks/
    ├── useAuth.js                     # Auth hook
    └── useTeacherData.js              # Teacher data hook
```

## Key Security Features

### 1. Authentication
- Firebase Authentication with email/password
- Secure session persistence
- Automatic logout on browser close

### 2. Authorization
- Role-based access control at service level
- Firestore security rules enforcement
- Per-operation permission checks
- Data filtering based on user role

### 3. Data Privacy
- Teachers only see their assigned data
- Students see only necessary information
- No sensitive data exposure
- All operations logged

### 4. Input Validation
- Client-side form validation
- Server-side permission verification
- Data type checking
- Range validation for scores

## Usage Examples

### Login as Teacher
```javascript
import { loginUser } from './services/authService';

const user = await loginUser('teacher@school.com', 'password');
// Returns: { uid, email, name, role, assignedClasses, assignedSubjects }
```

### Take Attendance
```javascript
import { takeAttendance } from './services/attendanceService';

const result = await takeAttendance(user, classId, {
  students: [
    { studentId: 'S1', status: 'present' },
    { studentId: 'S2', status: 'absent' }
  ],
  subject: 'Mathematics',
  period: '09:00 - 10:00'
});
```

### Enter Results
```javascript
import { enterResult } from './services/resultsService';

const result = await enterResult(user, {
  studentId: 'S1',
  subjectId: 'MATH101',
  classId: 'CLASS1',
  scores: {
    classwork: 15,
    test: 25,
    examination: 40
  },
  comments: 'Good performance'
});
```

### Post Announcement
```javascript
import { postTeacherAnnouncement } from './services/announcementService';

await postTeacherAnnouncement(user, {
  title: 'Important Notice',
  content: 'Class will be rescheduled...',
  classIds: ['CLASS1', 'CLASS2']
});
```

## Common Issues & Solutions

### Issue: Teachers seeing all classes
**Solution**: Check `assignedClasses` is properly populated in teacher document. Verify RBAC service checks this array.

### Issue: Attendance not saving
**Solution**: Ensure teacher is assigned to the class. Check Firestore rules for `attendance` collection.

### Issue: Results showing empty
**Solution**: Verify teacher ID matches the `teacherId` field in results. Check subject assignment.

### Issue: Announcements not visible
**Solution**: Ensure announcement is for teacher's assigned classes. Check `classIds` contains assigned class IDs.

## Performance Optimization

- Results are memoized using React hooks
- Data fetching happens on component mount
- Batch operations for bulk result submission
- Firestore queries filtered at collection level
- Pagination for large datasets (optional enhancement)

## Future Enhancements

- [ ] Export attendance/results as PDF
- [ ] Attendance QR code scanning
- [ ] Real-time attendance sync
- [ ] Parent communication module
- [ ] Assignment submission tracking
- [ ] Performance analytics
- [ ] Multi-language support
- [ ] Mobile app version

## Support & Troubleshooting

For issues or questions:
1. Check Firestore security rules
2. Verify teacher assignments in database
3. Check browser console for errors
4. Review Firebase auth logs
5. Test with different teacher accounts

## License

This project is licensed under the MIT License.

## Credits

Built with React, Firebase, and modern web technologies.
