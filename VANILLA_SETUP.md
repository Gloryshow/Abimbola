# 📚 Vanilla HTML/CSS/JavaScript - Teacher Dashboard

## Updated Architecture

You've switched from **React** to **Vanilla HTML/CSS/Bootstrap**. Here's the new structure:

### 📂 What's Different

**Old Structure (React - Not Used):**
```
public/index.html (React entry point)
src/App.jsx (React router)
src/components/ (React components)
src/hooks/ (React hooks)
```

**New Structure (Vanilla - Currently Active):**
```
index.html ..................... Main HTML page with all UI
app.js ......................... Vanilla JavaScript controlling the page
styles.css ..................... Custom CSS styling
src/services/ .................. Firebase backend services (unchanged)
src/utils/rbac.js .............. RBAC permission system (unchanged)
```

---

## 🚀 How It Works

### 1. **HTML Structure** (`index.html`)
- Two main pages: **Login Page** & **Dashboard Page**
- Dashboard has 6 tabs: Overview, Classes, Attendance, Results, Announcements, Profile
- Uses **Bootstrap 5** for responsive design
- All UI elements marked with IDs for JavaScript control

### 2. **JavaScript Logic** (`app.js`)
- Connects to existing Firebase services
- Handles page switching, tab navigation, form submissions
- Loads data from `teacherService.js`, `attendanceService.js`, etc.
- Enforces RBAC through service functions

### 3. **Backend Services** (Unchanged)
Still using all existing services:
- `src/services/firebase.js` - Firebase config
- `src/services/authService.js` - Login/logout
- `src/services/teacherService.js` - Classes, profile, dashboard
- `src/services/attendanceService.js` - Attendance management
- `src/services/resultsService.js` - Grades management
- `src/services/announcementService.js` - Announcements
- `src/utils/rbac.js` - Permission checking

---

## 📋 Setup Steps

### Step 1: Firebase Configuration
1. Copy `.env.example` to `.env`
2. Add your Firebase credentials:
   ```
   REACT_APP_FIREBASE_API_KEY=your-api-key
   REACT_APP_FIREBASE_AUTH_DOMAIN=your-auth-domain
   REACT_APP_FIREBASE_PROJECT_ID=your-project-id
   REACT_APP_FIREBASE_STORAGE_BUCKET=your-storage-bucket
   REACT_APP_FIREBASE_MESSAGING_ID=your-messaging-id
   REACT_APP_FIREBASE_APP_ID=your-app-id
   ```

### Step 2: Deploy Firestore Rules
```bash
firebase deploy --only firestore:rules
```

### Step 3: Create Firestore Collections
In Firebase Console, create these collections:
- `teachers` - Teacher profiles
- `classes` - Classes (with assignedTeachers array)
- `students` - Student records
- `subjects` - Subject list
- `classSubjects` - Class-subject mappings
- `attendance` - Daily attendance records
- `results` - Grade/result records
- `announcements` - System announcements
- `announcementReads` - Read status tracking
- `timetables` - Class schedules

### Step 4: Open in Browser
Simply open `index.html` in a browser:
```bash
# Option 1: Direct file
open index.html

# Option 2: Use a local server
python -m http.server 8000
# Then visit http://localhost:8000
```

---

## 🔐 RBAC Implementation

### How Vanilla Version Enforces RBAC

**Layer 1: Authentication**
```javascript
// app.js - Only authenticated users see dashboard
onAuthChange(async (user) => {
    if (user) {
        showPage('dashboardPage');  // Dashboard
        await loadDashboard();
    } else {
        showPage('loginPage');  // Back to login
    }
});
```

**Layer 2: Service-Level Checks**
```javascript
// Each service function checks permissions
await getTeacherClasses(currentUser);  // Only returns assigned classes
await getClassStudents(currentUser, classId);  // Checks if teacher assigned
await takeAttendance(currentUser, classId, date, students);  // Verifies teaching
```

**Layer 3: Component-Level Guards**
```javascript
// HTML only shows relevant forms/buttons based on user role
// Attendance form only shows for assigned classes
// Results form only shows for taught subjects
```

**Layer 4: Firestore Rules**
```javascript
// Database enforces access at collection level
// Teachers cannot query unauthorized classes
// Results filtered by taught subjects
```

---

## 📱 Features Walkthrough

### 1. **Login Page**
- Email/password login form
- RBAC checked in `authService.js`
- Must be approved teacher or admin

### 2. **Overview Tab**
- Statistics cards (classes, students, subjects, announcements)
- Teacher's timetable (if available)
- Pending actions (ToDo)

### 3. **My Classes Tab**
- Lists all assigned classes
- Shows students in each class (read-only)
- Subject list for each class

### 4. **Attendance Tab**
- Select class and date
- Mark students present/absent
- Submit attendance to Firestore
- RBAC check: only assigned classes shown

### 5. **Results Tab**
- Select class and subject
- Enter classwork, test, exam scores
- Auto-calculates total
- RBAC check: only taught subjects shown

### 6. **Announcements Tab**
- View all announcements
- Post new announcements to assigned classes
- Select multiple classes for targeting
- RBAC check: can't post to unassigned classes

### 7. **Profile Tab**
- View/edit department, phone, bio
- Change password
- See assigned classes and subjects

---

## 🛠️ Development Tips

### To Test RBAC:
1. Create two teacher accounts in Firebase Auth
2. Add them to `teachers` collection with different assigned classes
3. Login with each and verify:
   - Different classes appear in "My Classes"
   - Attendance only shows for assigned classes
   - Results only shows for taught subjects

### To Debug:
```javascript
// Open browser console (F12)
// Check service function calls
console.log(currentUser);  // Current teacher object
console.log(currentUser.assignedClasses);  // Their classes
```

### To Modify UI:
- Edit `index.html` for HTML structure
- Edit `styles.css` for styling
- Edit `app.js` for JavaScript behavior
- Bootstrap classes work directly in HTML

---

## 📊 Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, Bootstrap 5 |
| JavaScript | Vanilla (no frameworks) |
| Backend | Firebase Firestore + Auth |
| RBAC | Custom permission system (rbac.js) |
| Security | Firestore Rules + Service-level checks |

---

## ✅ Verification Checklist

Before deploying:
- [ ] Firebase credentials in `.env.example`
- [ ] Firestore collections created
- [ ] Security rules deployed
- [ ] Test teacher account created
- [ ] Can login and see dashboard
- [ ] Can see assigned classes only
- [ ] Can mark attendance
- [ ] Can enter results
- [ ] Can post announcements

---

## 🎓 Next Steps

1. **Test thoroughly** with multiple teacher accounts
2. **Customize styling** in `styles.css` if needed
3. **Deploy to Firebase Hosting**:
   ```bash
   firebase init hosting
   firebase deploy
   ```

4. **Add more features** by extending app.js and services

---

## 📞 Support

- Check **RBAC_GUIDE.md** for security details
- Check **DOCUMENTATION.md** for complete feature guide
- Check **QUICK_REFERENCE.md** for common tasks
- Services in `src/services/` have inline comments
