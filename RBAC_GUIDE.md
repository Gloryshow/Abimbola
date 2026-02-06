# RBAC Implementation Guide

## Role-Based Access Control Overview

This document explains how RBAC is implemented in the Teacher Dashboard system.

## User Roles

### Admin Role
- Full system access
- Create/update/delete user accounts
- Lock/unlock results
- Create announcements visible to all
- Access all data

### Teacher Role
- Limited to assigned classes and subjects
- Can take attendance for assigned classes
- Can enter results for taught subjects
- Can post to assigned classes
- Cannot access other teachers' data

## RBAC Checks Implementation

### 1. Service-Level Checks

All service functions include RBAC verification using `assertPermission()`:

```javascript
export const takeAttendance = async (user, classId, attendanceData) => {
  // Check teacher is assigned to class
  if (!isAssignedToClass(user, classId)) {
    throw new Error('Access denied: Not assigned to this class');
  }
  // ... rest of function
};
```

### 2. Firestore Security Rules

Database-level enforcement in `firestore.rules`:

```javascript
match /attendance/{recordId} {
  allow create: if isTeacher() && 
                 isAssignedToClass(request.resource.data.classId) &&
                 request.resource.data.teacherId == request.auth.uid;
}
```

### 3. Component-Level Guards

UI components only render actions user can perform:

```javascript
{announcement.authorId === user.uid && (
  <button onClick={() => handleDeleteAnnouncement(...)}>Delete</button>
)}
```

## RBAC Utility Functions

### Core Functions

| Function | Purpose | Usage |
|----------|---------|-------|
| `hasRole(user, role)` | Check user role | `hasRole(user, 'teacher')` |
| `isTeacher(user)` | Check if teacher | `if (isTeacher(user))` |
| `isAdmin(user)` | Check if admin | `if (isAdmin(user))` |
| `isAssignedToClass(user, classId)` | Check class access | `if (!isAssignedToClass(user, classId))` |
| `teacheSubject(user, subjectId)` | Check subject teaching | `if (!teacheSubject(user, subjectId))` |
| `verifyPermission(user, permission)` | Check specific permission | `if (!verifyPermission(user, 'take_attendance'))` |
| `assertPermission(user, permission)` | Assert permission or throw | `assertPermission(user, 'take_attendance')` |

### Permission Names

```javascript
Permissions: {
  view_all_classes,
  view_assigned_classes,
  view_all_students,
  view_class_students,
  take_attendance,
  enter_results,
  view_announcements,
  post_announcements,
  view_profile,
  edit_own_profile,
  edit_other_profiles,
  view_fees,
  view_salaries,
  access_settings
}
```

## Implementation Flow

### 1. Teacher Logs In
```
User enters credentials
  ↓
loginUser() verifies with Firebase Auth
  ↓
getUserData() fetches teacher document
  ↓
Loads assignedClasses and assignedSubjects
  ↓
Stores in user state
```

### 2. Teacher Accesses Class
```
Component calls getTeacherClasses(user)
  ↓
Service calls assertPermission('view_assigned_classes')
  ↓
Queries classes where id IN assignedClasses
  ↓
Returns filtered results
```

### 3. Teacher Takes Attendance
```
Form submitted with attendance data
  ↓
takeAttendance() checks isAssignedToClass()
  ↓
Creates attendance document with teacherId
  ↓
Firestore rules verify teacherId matches auth.uid
  ↓
Document saved successfully
```

### 4. Teacher Views Results
```
Selects subject to view results
  ↓
getResultsBySubject() checks teacheSubject()
  ↓
Queries results where teacherId == user.uid
  ↓
Only returns own results
```

## Security Layers

### Layer 1: Client-Side Validation
- Component-level checks
- Permission verification before API calls
- UI elements disabled/hidden based on permissions

### Layer 2: Service-Level Authorization
- `assertPermission()` in every critical function
- Business logic validation
- Data filtering before return

### Layer 3: Database Rules
- Firestore security rules enforce access
- Authentication required for all operations
- Role-based rule conditions
- User-specific data filtering

### Layer 4: Audit Trail
- All operations logged with timestamp
- Includes user ID and operation type
- Helps identify unauthorized attempts

## Adding New RBAC Rules

### Step 1: Define Permission
In `rbac.js`:
```javascript
const permissions = {
  // ... existing permissions
  new_permission: (u) => isTeacher(u),
};
```

### Step 2: Use in Service
```javascript
export const someService = async (user, data) => {
  assertPermission(user, 'new_permission');
  // ... rest of function
};
```

### Step 3: Add Firestore Rule
```javascript
match /collection/{document=**} {
  allow write: if hasNewPermission();
}
```

### Step 4: Protect Component
```javascript
{verifyPermission(user, 'new_permission') && (
  <button>Action</button>
)}
```

## Testing RBAC

### Test Case: Teacher Cannot View Other Teacher's Attendance
```javascript
// Test data
const teacher1 = { uid: 'T1', assignedClasses: ['C1'] };
const teacher2 = { uid: 'T2', assignedClasses: ['C2'] };
const attendance = { id: 'A1', classId: 'C1', teacherId: 'T1' };

// Test
// Teacher2 tries to read Teacher1's attendance
getAttendanceHistory(teacher2, 'C1'); // Should throw error

// Result: "Access denied: Not assigned to this class"
```

### Test Case: Teacher Cannot Enter Results for Subject Not Taught
```javascript
const teacher = { 
  uid: 'T1', 
  assignedSubjects: ['MATH101'] // Only taught math
};

// Try to enter results for English (not taught)
enterResult(teacher, {
  studentId: 'S1',
  subjectId: 'ENG101', // English, not assigned
  // ...
});

// Result: "Access denied: You do not teach this subject"
```

## Common RBAC Patterns

### Pattern 1: Data Filtering
```javascript
const filterUserData = (user, allData) => {
  if (isAdmin(user)) return allData;
  if (isTeacher(user)) {
    return allData.filter(item => 
      isAssignedToClass(user, item.classId)
    );
  }
  return [];
};
```

### Pattern 2: Permission-Based UI
```javascript
{verifyPermission(user, 'post_announcements') && (
  <button onClick={postAnnouncement}>Post</button>
)}
```

### Pattern 3: Ownership Check
```javascript
if (resource.authorId !== user.uid && !isAdmin(user)) {
  throw new Error('Not authorized');
}
```

### Pattern 4: Relationship Check
```javascript
if (!isAssignedToClass(user, resource.classId)) {
  throw new Error('Not assigned to this class');
}
```

## Error Handling

### Permission Denied Errors
```javascript
try {
  await takeAttendance(user, classId, data);
} catch (error) {
  if (error.message.includes('Access denied')) {
    // Handle permission error
    showErrorMessage('You are not assigned to this class');
  }
}
```

### Best Practices
1. Always wrap service calls in try-catch
2. Check permissions before rendering sensitive UI
3. Log unauthorized attempts
4. Display user-friendly error messages
5. Disable UI elements instead of showing errors
6. Verify permissions at every layer

## Debugging RBAC Issues

### Check Assigned Classes
```javascript
const teacher = await getUserData(user.uid);
console.log('Assigned classes:', teacher.assignedClasses);
```

### Verify Permission Function
```javascript
console.log(
  'Can take attendance?',
  verifyPermission(user, 'take_attendance')
);
```

### Firestore Rules Test
Use Firebase Emulator to test rules:
```bash
firebase emulators:start
```

### Enable Debug Logging
```javascript
import { enableLogging } from 'firebase/firestore';
enableLogging(true);
```

## Conclusion

The RBAC system works through:
1. **Identification**: Know who the user is
2. **Assignment**: Know their role and assignments
3. **Verification**: Check permissions before action
4. **Enforcement**: Block unauthorized operations

This multi-layer approach ensures security and prevents unauthorized access to sensitive data.
