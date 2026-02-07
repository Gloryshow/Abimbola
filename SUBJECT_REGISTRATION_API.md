# Subject Registration Service - API Reference

## Overview
The Subject Registration Service provides functions to manage student-subject assignments with full RBAC enforcement.

## Core Functions

### 1. registerStudentSubject(user, registrationData)
Register a single student for a subject in a specific class.

**Parameters:**
- `user` (object) - Current user object with role and permissions
- `registrationData` (object):
  - `studentId` (string, required) - Student document ID
  - `subjectId` (string, required) - Subject document ID  
  - `classId` (string, required) - Class ID (must match student's class)
  - `notes` (string, optional) - Additional notes

**Returns:**
```javascript
{
  id: string,                    // Registration document ID
  studentId: string,
  subjectId: string,
  classId: string,
  registeredBy: string,          // UID of registering user
  registeredByName: string,
  registeredByRole: string,
  status: 'active',
  registeredAt: Timestamp,
  createdAt: Timestamp,
  updatedAt: Timestamp,
  success: true,
  message: 'Subject registered successfully'
}
```

**Throws:**
- "Student ID, Subject ID, and Class ID are required"
- "Access denied: You are not assigned to this class" (Teachers only)
- "Student not found"
- "Student does not belong to the specified class"
- "Subject not found"
- "Student is already registered for this subject in this class"

**Example:**
```javascript
const result = await registerStudentSubject(currentUser, {
  studentId: 'student123',
  subjectId: 'physics',
  classId: 'JSS1A',
  notes: 'Science stream'
});
```

---

### 2. getStudentSubjects(studentId)
Get all active subjects registered for a specific student.

**Parameters:**
- `studentId` (string) - Student document ID

**Returns:**
```javascript
[
  {
    id: string,                 // Registration ID
    studentId: string,
    subjectId: string,
    subjectName: string,
    classId: string,
    status: 'active',
    registeredAt: Timestamp,
    ...
  },
  ...
]
```

**Throws:**
- "Failed to fetch student subjects: [error]"

**Example:**
```javascript
const subjects = await getStudentSubjects('student123');
subjects.forEach(subject => {
  console.log(`${subject.studentName} takes ${subject.subjectName}`);
});
```

---

### 3. getStudentsForSubject(user, subjectId, classId)
Get all students registered for a specific subject in a class.

**Parameters:**
- `user` (object) - Current user (for permission check)
- `subjectId` (string) - Subject ID
- `classId` (string) - Class ID

**Returns:**
```javascript
[
  {
    id: string,                // Registration ID
    studentId: string,
    studentName: string,
    subjectId: string,
    classId: string,
    registeredBy: string,
    registeredByName: string,
    status: 'active',
    registeredAt: Timestamp,
    ...
  },
  ...
]
```

**Throws:**
- "Access denied: You are not assigned to this class"
- "Failed to fetch students for subject: [error]"

**Example:**
```javascript
// Get all students taking Physics in JSS1A
const students = await getStudentsForSubject(currentUser, 'physics', 'JSS1A');
console.log(`${students.length} students taking Physics`);
```

---

### 4. getClassSubjects(user, classId)
Get all subjects being taken in a class, grouped by subject.

**Parameters:**
- `user` (object) - Current user
- `classId` (string) - Class ID

**Returns:**
```javascript
[
  {
    subjectId: string,
    subjectName: string,
    classId: string,
    studentCount: number,
    students: [
      {
        registrationId: string,
        studentId: string,
        studentName: string,
        registeredAt: Timestamp
      },
      ...
    ]
  },
  ...
]
```

**Throws:**
- "Access denied: You are not assigned to this class"
- "Failed to fetch class subjects: [error]"

**Example:**
```javascript
const classSubjects = await getClassSubjects(currentUser, 'JSS1A');
classSubjects.forEach(subject => {
  console.log(`${subject.subjectName}: ${subject.studentCount} students`);
});
```

---

### 5. updateSubjectRegistration(user, registrationId, updateData)
Update an existing subject registration (status, notes, etc).

**Parameters:**
- `user` (object) - Current user
- `registrationId` (string) - Registration document ID
- `updateData` (object):
  - `status` (string, optional) - "active", "dropped", or "suspended"
  - `notes` (string, optional) - Updated notes

**Returns:**
```javascript
{
  success: true,
  message: 'Subject registration updated successfully'
}
```

**Throws:**
- "Subject registration not found"
- "Access denied: You are not assigned to this class"
- "Invalid status. Must be one of: active, dropped, suspended"
- "Failed to update subject registration: [error]"

**Example:**
```javascript
await updateSubjectRegistration(currentUser, 'regId123', {
  status: 'dropped',
  notes: 'Student requested to drop Physics'
});
```

---

### 6. removeSubjectRegistration(user, registrationId)
Remove a student from a subject (delete registration).

**Parameters:**
- `user` (object) - Current user
- `registrationId` (string) - Registration document ID

**Returns:**
```javascript
{
  success: true,
  message: 'Subject registration removed successfully'
}
```

**Throws:**
- "Subject registration not found"
- "Access denied: You are not assigned to this class"
- "Failed to remove subject registration: [error]"

**Example:**
```javascript
await removeSubjectRegistration(currentUser, 'regId123');
console.log('Registration removed successfully');
```

---

### 7. getClassSubjectSummary(user, classId)
Get statistics on subject registrations in a class.

**Parameters:**
- `user` (object) - Current user
- `classId` (string) - Class ID

**Returns:**
```javascript
{
  classId: string,
  totalRegistrations: number,
  subjectStats: {
    'physics': {
      subjectId: 'physics',
      subjectName: 'Physics',
      studentCount: 45
    },
    'chemistry': {
      subjectId: 'chemistry',
      subjectName: 'Chemistry',
      studentCount: 42
    },
    ...
  }
}
```

**Throws:**
- "Access denied: You are not assigned to this class"
- "Failed to fetch class subject summary: [error]"

**Example:**
```javascript
const summary = await getClassSubjectSummary(currentUser, 'JSS1A');
console.log(`Total registrations: ${summary.totalRegistrations}`);
Object.values(summary.subjectStats).forEach(stat => {
  console.log(`${stat.subjectName}: ${stat.studentCount}`);
});
```

---

### 8. bulkRegisterSubjects(user, bulkData)
Register multiple students for a subject at once.

**Parameters:**
- `user` (object) - Current user
- `bulkData` (object):
  - `classId` (string, required) - Class ID
  - `subjectId` (string, required) - Subject ID
  - `studentIds` (array of strings, required) - Student document IDs
  - `notes` (string, optional) - Notes for all registrations

**Returns:**
```javascript
{
  success: boolean,              // true if all succeeded, false if any failed
  results: {
    successful: [
      {
        studentId: string,
        registrationId: string,
        message: 'Registered successfully'
      },
      ...
    ],
    failed: [
      {
        studentId: string,
        error: string              // Error message
      },
      ...
    ]
  },
  summary: {
    totalAttempted: number,
    successCount: number,
    failedCount: number
  }
}
```

**Throws:**
- "Class ID, Subject ID, and Student IDs array are required"
- "Access denied: You are not assigned to this class"
- "Subject not found"
- "Failed to bulk register subjects: [error]"

**Example:**
```javascript
const result = await bulkRegisterSubjects(currentUser, {
  classId: 'JSS1A',
  subjectId: 'mathematics',
  studentIds: ['student1', 'student2', 'student3'],
  notes: 'Core subject registration'
});

console.log(`Success: ${result.summary.successCount}`);
console.log(`Failed: ${result.summary.failedCount}`);

result.results.failed.forEach(failure => {
  console.error(`${failure.studentId}: ${failure.error}`);
});
```

---

## RBAC Utilities

### Helper Functions in rbac.js

```javascript
// Check if user can register subjects for a class
canRegisterSubjects(user, classId) → boolean

// Check if user can edit subject registrations
canEditSubjectRegistrations(user, classId) → boolean

// Check if user can view subject registrations  
canViewSubjectRegistrations(user, classId) → boolean

// Check if user can remove students from subjects
canRemoveStudentFromSubject(user, classId) → boolean
```

**Example:**
```javascript
if (canRegisterSubjects(currentUser, 'JSS1A')) {
  // Show registration UI
} else {
  // Show "access denied" message
}
```

---

## Complete Workflow Example

```javascript
// Step 1: Get current user's assigned classes
const user = currentUser;
console.log('My classes:', user.assignedClasses);

// Step 2: Get summary of subject distribution
const summary = await getClassSubjectSummary(user, 'JSS1A');
console.log('Current registrations:', summary.totalRegistrations);

// Step 3: Register multiple students for Physics
const regResult = await bulkRegisterSubjects(user, {
  classId: 'JSS1A',
  subjectId: 'physics',
  studentIds: ['id1', 'id2', 'id3'],
  notes: 'Science stream selection'
});

console.log(`Registered: ${regResult.summary.successCount}`);
console.log(`Failed: ${regResult.summary.failedCount}`);

// Step 4: View all students taking Physics
const students = await getStudentsForSubject(user, 'physics', 'JSS1A');
students.forEach(s => console.log(`- ${s.studentName}`));

// Step 5: Update a registration
await updateSubjectRegistration(user, 'regId123', {
  status: 'active',
  notes: 'Updated stream'
});

// Step 6: Remove if needed
await removeSubjectRegistration(user, 'regId123');
```

---

## Error Handling Best Practices

```javascript
try {
  const result = await registerStudentSubject(currentUser, {
    studentId: studentId,
    subjectId: subjectId,
    classId: classId
  });
  
  // Show success message
  showSuccess('Student registered successfully');
  
} catch (error) {
  // Handle different error types
  if (error.message.includes('Access denied')) {
    showError('You do not have permission to register students in this class');
  } else if (error.message.includes('already registered')) {
    showWarning('Student is already registered for this subject');
  } else {
    showError(`Registration failed: ${error.message}`);
  }
}
```

---

## Database Schema

### studentSubjects Collection
```javascript
{
  studentId: string,           // Reference to students collection
  studentName: string,         // Denormalized for quick display
  subjectId: string,          // Reference to subjects collection
  subjectName: string,        // Denormalized for quick display
  classId: string,            // Class identifier (e.g., "JSS1A")
  registeredBy: string,       // UID of teacher/admin who registered
  registeredByName: string,   // Name of registering teacher/admin
  registeredByRole: string,   // "teacher" or "admin"
  notes: string,              // Optional notes about registration
  status: string,             // "active" | "dropped" | "suspended"
  registeredAt: Timestamp,    // When the registration was made
  createdAt: Timestamp,       // Document creation time
  updatedAt: Timestamp        // Last modification time
}
```

---

## Firestore Rules
```plaintext
match /studentSubjects/{document=**} {
  allow read: if request.auth != null;
  allow write: if isAdmin(request.auth.uid) || 
                  (get(/databases/$(database)/documents/teachers/$(request.auth.uid)).data.role == 'teacher' &&
                   request.auth.uid in get(/databases/$(database)/documents/teachers/$(request.auth.uid)).data.assignedClasses);
}
```

---

## Performance Considerations

1. **Bulk Operations** - Use `bulkRegisterSubjects()` for registering multiple students instead of calling `registerStudentSubject()` in a loop
2. **Query Optimization** - Firestore queries are indexed by collection and field, so filtering by class is efficient
3. **Caching** - Consider caching student lists in UI state to avoid repeated queries
4. **Real-time Updates** - Don't set up listeners on the entire collection; query specific classes only

---

## Version History

- **v1.0** (Feb 6, 2026) - Initial implementation with full RBAC support
