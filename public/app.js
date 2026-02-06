/**
 * Teacher Dashboard - Vanilla JavaScript (HTML/CSS/Bootstrap)
 * Connects to Firebase services for RBAC-protected teacher dashboard
 */

// Global state
let currentUser = null;
let currentTab = 'overview';
let selectedClasses = new Set();
let attendanceData = {};
let resultsData = {};
let currentPage = 'loginPage';

// ============================================
// INITIALIZATION & AUTH STATE MANAGEMENT
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    checkAuthState();
    setDefaultDates();
});

// Monitor auth state and load appropriate page
async function checkAuthState() {
    try {
        onAuthChange(async (user) => {
            if (user) {
                // Fetch user data from Firestore
                const userData = await getUserData(user.uid);
                currentUser = { ...user, ...userData };
                
                // Check if user is admin or needs approval
                if (userData && userData.role === 'admin') {
                    currentPage = 'dashboardPage';
                    showPage('dashboardPage');
                    await loadDashboard();
                } else if (userData && userData.approved) {
                    currentPage = 'dashboardPage';
                    showPage('dashboardPage');
                    await loadDashboard();
                } else {
                    // Pending approval
                    currentPage = 'loginPage';
                    showPendingApproval();
                }
            } else {
                currentUser = null;
                currentPage = 'loginPage';
                showPage('loginPage');
                clearLoginForm();
            }
        });
    } catch (error) {
        console.error('Auth check error:', error);
        showPage('loginPage');
    }
}

function setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    const attendanceDateField = document.getElementById('attendanceDate');
    if (attendanceDateField) attendanceDateField.value = today;
}

// ============================================
// LOGIN & LOGOUT
// ============================================

async function handleLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');

    if (!email || !password) {
        showError(errorDiv, 'Please enter email and password');
        return;
    }

    try {
        showError(errorDiv, 'Signing in...');
        await loginUser(email, password);
        showError(errorDiv, '');
    } catch (error) {
        showError(errorDiv, error.message || 'Login failed');
        console.error('Login error:', error);
    }
}

async function handleSignup() {
    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const errorDiv = document.getElementById('signupError');

    if (!name || !email || !password) {
        showError(errorDiv, 'Please fill in all fields');
        return;
    }

    if (password.length < 6) {
        showError(errorDiv, 'Password must be at least 6 characters');
        return;
    }

    try {
        showError(errorDiv, 'Creating account...');
        
        // Register new teacher
        const user = await registerTeacher(email, password, {
            name,
            department: '',
            assignedClasses: [],
            assignedSubjects: [],
            phone: ''
        });
        
        showError(errorDiv, '');
        
        // Show pending approval message
        document.getElementById('signupBox').style.display = 'none';
        showPendingApproval();
    } catch (error) {
        showError(errorDiv, error.message || 'Signup failed');
        console.error('Signup error:', error);
    }
}

function toggleAuthForm(event) {
    event.preventDefault();
    const loginBox = document.getElementById('loginBox');
    const signupBox = document.getElementById('signupBox');
    
    if (loginBox.style.display === 'none') {
        loginBox.style.display = 'block';
        signupBox.style.display = 'none';
    } else {
        loginBox.style.display = 'none';
        signupBox.style.display = 'block';
    }
}

function showPendingApproval() {
    const loginBox = document.getElementById('loginBox');
    const signupBox = document.getElementById('signupBox');
    const pendingBox = document.getElementById('pendingBox');
    
    if (loginBox) loginBox.style.display = 'none';
    if (signupBox) signupBox.style.display = 'none';
    if (pendingBox) pendingBox.style.display = 'block';
}

async function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        try {
            await logoutUser();
            currentUser = null;
            showPage('loginPage');
            clearLoginForm();
        } catch (error) {
            alert('Logout failed: ' + error.message);
        }
    }
}

function clearLoginForm() {
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';
    document.getElementById('loginError').textContent = '';
    
    // Reset auth boxes visibility
    const loginBox = document.getElementById('loginBox');
    const signupBox = document.getElementById('signupBox');
    const pendingBox = document.getElementById('pendingBox');
    
    if (loginBox) loginBox.style.display = 'block';
    if (signupBox) signupBox.style.display = 'none';
    if (pendingBox) pendingBox.style.display = 'none';
}

// ============================================
// PAGE NAVIGATION
// ============================================

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    currentPage = pageId;
}

function switchPage(pageId) {
    showPage(pageId);
    if (pageId === 'dashboardPage') {
        loadDashboard();
    }
}

function showAdminPanel() {
    showPage('adminPage');
    loadAdminPanel();
}

// ============================================
// STUDENT MANAGEMENT FUNCTIONS
// ============================================

async function handleRegisterStudent(event) {
    event.preventDefault();
    
    try {
        const name = document.getElementById('studentName').value.trim();
        const email = document.getElementById('studentEmail').value.trim();
        const className = document.getElementById('studentClass').value;
        const dob = document.getElementById('studentDOB').value;
        const regNum = document.getElementById('studentRegNum').value.trim();
        const parentName = document.getElementById('studentParentName').value.trim();
        const parentPhone = document.getElementById('studentParentPhone').value.trim();
        const phone = document.getElementById('studentPhone').value.trim();
        const address = document.getElementById('studentAddress').value.trim();

        if (!name || !email || !className) {
            showMessage('studentRegisterMessage', 'Name, email, and class are required', 'danger');
            return;
        }

        showMessage('studentRegisterMessage', 'Registering student...', 'info');

        const student = await registerStudent({
            name,
            email,
            class: className,
            dateOfBirth: dob,
            registrationNumber: regNum,
            parentName,
            parentPhone,
            phone,
            address
        });

        showMessage('studentRegisterMessage', 'Student registered successfully!', 'success');
        
        // Reset form
        document.getElementById('studentRegistrationForm').reset();
        
        // Reload students list
        loadStudentsList();
    } catch (error) {
        showMessage('studentRegisterMessage', error.message, 'danger');
        console.error('Registration error:', error);
    }
}

async function loadStudentsList() {
    try {
        const students = await getStudents();
        const studentsList = document.getElementById('studentsList');

        if (students.length === 0) {
            studentsList.innerHTML = '<p class="text-muted">No students registered yet</p>';
        } else {
            let studentsHTML = '<div class="table-responsive"><table class="table table-hover"><thead><tr><th>Name</th><th>Email</th><th>Class</th><th>Reg. Number</th><th>Actions</th></tr></thead><tbody>';
            
            students.forEach(student => {
                studentsHTML += `
                    <tr>
                        <td><strong>${student.name}</strong></td>
                        <td>${student.email}</td>
                        <td><span class="badge bg-primary">${student.class}</span></td>
                        <td>${student.registrationNumber || '-'}</td>
                        <td>
                            <button onclick="editStudent('${student.id}')" class="btn btn-sm btn-info">Edit</button>
                            <button onclick="deleteStudentRecord('${student.id}', '${student.name}')" class="btn btn-sm btn-danger">Delete</button>
                        </td>
                    </tr>
                `;
            });
            
            studentsHTML += '</tbody></table></div>';
            studentsList.innerHTML = studentsHTML;
        }
    } catch (error) {
        console.error('Error loading students:', error);
        document.getElementById('studentsList').innerHTML = `<p class="text-danger">Error loading students</p>`;
    }
}

async function deleteStudentRecord(studentId, studentName) {
    if (confirm(`Are you sure you want to delete ${studentName}?`)) {
        try {
            await deleteStudent(studentId);
            alert('Student deleted successfully');
            loadStudentsList();
        } catch (error) {
            alert('Failed to delete student: ' + error.message);
            console.error('Delete error:', error);
        }
    }
}

function editStudent(studentId) {
    alert('Student editing feature coming soon!');
    // This can be expanded to include edit modal
}

function showMessage(elementId, message, type) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = `<div class="alert alert-${type} mb-0">${message}</div>`;
    }
}

function switchTab(tabName) {
    currentTab = tabName;
    
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    
    // Remove active class from all nav links
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    
    // Show selected tab
    const tabElement = document.getElementById(tabName + 'Tab');
    if (tabElement) {
        tabElement.classList.add('active');
    }
    
    // Add active class to clicked button
    if (event && event.target) {
        event.target.classList.add('active');
    }
    
    // Load tab-specific data
    loadTabData(tabName);
}

async function loadTabData(tabName) {
    try {
        switch(tabName) {
            case 'overview':
                await loadOverviewTab();
                break;
            case 'classes':
                await loadClassesTab();
                break;
            case 'attendance':
                await loadAttendanceTab();
                break;
            case 'results':
                await loadResultsTab();
                break;
            case 'announcements':
                await loadAnnouncementsTab();
                break;
            case 'profile':
                await loadProfileTab();
                break;
        }
    } catch (error) {
        console.error(`Error loading ${tabName} tab:`, error);
    }
}

// ============================================
// DASHBOARD INITIALIZATION
// ============================================

async function loadDashboard() {
    try {
        // Update header with teacher name
        if (currentUser && currentUser.name) {
            document.getElementById('teacherName').textContent = `Welcome, ${currentUser.name}`;
        }
        
        // Show admin panel button only for admins
        const adminBtn = document.getElementById('adminPanelBtn');
        if (currentUser && currentUser.role === 'admin') {
            adminBtn.style.display = 'block';
        } else {
            adminBtn.style.display = 'none';
        }
        
        // Load statistics
        await loadStatistics();
        
        // Load overview tab by default
        await loadOverviewTab();
    } catch (error) {
        console.error('Dashboard load error:', error);
    }
}

async function loadStatistics() {
    try {
        const overview = await getTeacherDashboardOverview(currentUser);
        
        document.getElementById('statsClasses').textContent = overview.totalClasses || 0;
        document.getElementById('statsStudents').textContent = overview.totalStudents || 0;
        document.getElementById('statsSubjects').textContent = overview.totalSubjects || 0;
        document.getElementById('statsAnnouncements').textContent = overview.announcements?.length || 0;
    } catch (error) {
        console.error('Statistics load error:', error);
    }
}

// ============================================
// OVERVIEW TAB
// ============================================

async function loadOverviewTab() {
    try {
        const overview = await getTeacherDashboardOverview(currentUser);
        
        // Load timetable
        const timetableContent = document.getElementById('timetableContent');
        if (overview.timetable && overview.timetable.length > 0) {
            timetableContent.innerHTML = overview.timetable.map(item => `
                <div class="mb-2 p-2 border-bottom">
                    <strong>${item.class || 'N/A'}</strong> - ${item.subject || 'N/A'}<br>
                    <small class="text-muted">${item.time || 'Time TBA'}</small>
                </div>
            `).join('');
        } else {
            timetableContent.innerHTML = '<p class="text-muted">No timetable available</p>';
        }
        
        // Load pending actions
        const pendingContent = document.getElementById('pendingContent');
        
        // For admins, show pending teacher approvals
        if (currentUser && currentUser.role === 'admin') {
            try {
                const pendingTeachers = await getPendingTeachers();
                if (pendingTeachers && pendingTeachers.length > 0) {
                    let pendingHTML = `<div class="alert alert-warning" role="alert">
                        <strong>⚠️ ${pendingTeachers.length} Teacher(s) Pending Approval</strong>
                    </div>`;
                    
                    pendingTeachers.forEach(teacher => {
                        pendingHTML += `
                            <div class="mb-3 p-2 border-left border-warning" style="border-left: 4px solid #ffc107;">
                                <strong>${teacher.name}</strong><br>
                                <small class="text-muted">${teacher.email}</small><br>
                                <button onclick="showAdminPanel()" class="btn btn-sm btn-warning mt-2">Review & Approve</button>
                            </div>
                        `;
                    });
                    pendingContent.innerHTML = pendingHTML;
                } else {
                    pendingContent.innerHTML = '<p class="text-muted">✓ No pending actions</p>';
                }
            } catch (error) {
                console.error('Error loading pending teachers:', error);
                pendingContent.innerHTML = '<p class="text-muted">No pending actions</p>';
            }
        } else {
            // For regular teachers, show other pending actions
            const pending = overview.pendingActions || [];
            if (pending.length > 0) {
                pendingContent.innerHTML = pending.map(action => `
                    <div class="mb-2 p-2 border-bottom">
                        <strong>${action.title || 'Action'}</strong><br>
                        <small class="text-muted">${action.description || ''}</small>
                    </div>
                `).join('');
            } else {
                pendingContent.innerHTML = '<p class="text-muted">No pending actions</p>';
            }
        }
    } catch (error) {
        console.error('Overview tab error:', error);
        document.getElementById('timetableContent').innerHTML = '<p class="text-danger">Error loading timetable</p>';
        document.getElementById('pendingContent').innerHTML = '<p class="text-danger">Error loading pending items</p>';
    }
}

// ============================================
// MY CLASSES TAB
// ============================================

async function loadClassesTab() {
    try {
        // Get the teacher's assigned classes directly from their profile
        const assignedClasses = currentUser.assignedClasses || [];
        const assignedSubjects = currentUser.assignedSubjects || [];
        
        const classesContent = document.getElementById('classesContent');
        
        if (assignedClasses && assignedClasses.length > 0) {
            let classesHtml = '<div class="mb-3"><h6><strong>Classes:</strong></h6><div class="list-group">';
            
            assignedClasses.forEach(cls => {
                classesHtml += `
                    <div class="list-group-item">
                        <p class="mb-0"><strong>${cls}</strong></p>
                    </div>
                `;
            });
            
            classesHtml += '</div></div>';
            
            if (assignedSubjects && assignedSubjects.length > 0) {
                classesHtml += '<div class="mb-3"><h6><strong>Subjects Teaching:</strong></h6><div class="list-group">';
                
                assignedSubjects.forEach(subject => {
                    classesHtml += `
                        <div class="list-group-item">
                            <p class="mb-0">${subject}</p>
                        </div>
                    `;
                });
                
                classesHtml += '</div></div>';
            }
            
            classesContent.innerHTML = classesHtml;
        } else {
            classesContent.innerHTML = '<p class="text-muted">No classes assigned</p>';
        }
    } catch (error) {
        console.error('Classes tab error:', error);
        document.getElementById('classesContent').innerHTML = '<p class="text-danger">Error loading classes</p>';
    }
}

// ============================================
// ATTENDANCE TAB
// ============================================

async function loadAttendanceTab() {
    try {
        const classes = await getTeacherClasses(currentUser);
        const classSelect = document.getElementById('attendanceClass');
        
        classSelect.innerHTML = '<option value="">-- Select Class --</option>';
        if (classes && classes.length > 0) {
            classSelect.innerHTML += classes.map(cls => 
                `<option value="${cls.id}">${cls.name || cls.id}</option>`
            ).join('');
        }
    } catch (error) {
        console.error('Attendance tab error:', error);
    }
}

async function loadAttendanceStudents() {
    const classId = document.getElementById('attendanceClass').value;
    if (!classId) return;
    
    try {
        const students = await getClassStudents(currentUser, classId);
        const content = document.getElementById('attendanceStudentsContent');
        
        if (students && students.length > 0) {
            attendanceData = {};
            content.innerHTML = `
                <table class="table">
                    <thead>
                        <tr>
                            <th>Student</th>
                            <th>Present</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${students.map((student) => {
                            attendanceData[student.id] = false;
                            return `
                                <tr>
                                    <td>${student.name || 'N/A'}</td>
                                    <td>
                                        <input type="checkbox" id="attend_${student.id}" 
                                               onchange="attendanceData['${student.id}'] = this.checked">
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            `;
        } else {
            content.innerHTML = '<p class="text-muted">No students in this class</p>';
        }
    } catch (error) {
        console.error('Load attendance students error:', error);
        document.getElementById('attendanceStudentsContent').innerHTML = '<p class="text-danger">Error loading students</p>';
    }
}

async function submitAttendance() {
    const classId = document.getElementById('attendanceClass').value;
    const date = document.getElementById('attendanceDate').value;
    
    if (!classId || !date) {
        alert('Please select class and date');
        return;
    }
    
    try {
        const presentStudents = Object.keys(attendanceData).filter(id => attendanceData[id]);
        await takeAttendance(currentUser, classId, date, presentStudents);
        alert('Attendance submitted successfully');
        loadAttendanceStudents();
    } catch (error) {
        alert('Error submitting attendance: ' + error.message);
    }
}

// ============================================
// RESULTS TAB
// ============================================

async function loadResultsTab() {
    try {
        const classes = await getTeacherClasses(currentUser);
        const classSelect = document.getElementById('resultsClass');
        
        classSelect.innerHTML = '<option value="">-- Select Class --</option>';
        if (classes && classes.length > 0) {
            classSelect.innerHTML += classes.map(cls => 
                `<option value="${cls.id}">${cls.name || cls.id}</option>`
            ).join('');
        }
    } catch (error) {
        console.error('Results tab error:', error);
    }
}

async function loadResultsStudents() {
    const classId = document.getElementById('resultsClass').value;
    const subjectId = document.getElementById('resultsSubject').value;
    
    if (!classId || !subjectId) {
        document.getElementById('resultsStudentsContent').innerHTML = '';
        return;
    }
    
    try {
        const students = await getClassStudents(currentUser, classId);
        const content = document.getElementById('resultsStudentsContent');
        
        if (students && students.length > 0) {
            resultsData = {};
            content.innerHTML = `
                <div class="table-responsive">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Student</th>
                                <th>Classwork</th>
                                <th>Test</th>
                                <th>Exam</th>
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${students.map((student) => {
                                resultsData[student.id] = {classwork: 0, test: 0, exam: 0};
                                return `
                                    <tr>
                                        <td>${student.name || 'N/A'}</td>
                                        <td>
                                            <input type="number" class="form-control form-control-sm" 
                                                   max="15" min="0" placeholder="0"
                                                   onchange="calculateTotal('${student.id}')">
                                        </td>
                                        <td>
                                            <input type="number" class="form-control form-control-sm" 
                                                   max="10" min="0" placeholder="0"
                                                   onchange="calculateTotal('${student.id}')">
                                        </td>
                                        <td>
                                            <input type="number" class="form-control form-control-sm" 
                                                   max="75" min="0" placeholder="0"
                                                   onchange="calculateTotal('${student.id}')">
                                        </td>
                                        <td><input type="text" class="form-control form-control-sm" 
                                                   id="total_${student.id}" readonly></td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } else {
            content.innerHTML = '<p class="text-muted">No students in this class</p>';
        }
    } catch (error) {
        console.error('Load results students error:', error);
        document.getElementById('resultsStudentsContent').innerHTML = '<p class="text-danger">Error loading students</p>';
    }
}

function calculateTotal(studentId) {
    const total = Object.values(resultsData[studentId] || {}).reduce((a, b) => a + b, 0);
    const totalField = document.getElementById('total_' + studentId);
    if (totalField) totalField.value = total;
}

async function submitResults() {
    alert('Results submission will save to Firebase');
}

// ============================================
// ANNOUNCEMENTS TAB
// ============================================

async function loadAnnouncementsTab() {
    try {
        const classes = await getTeacherClasses(currentUser);
        
        // Load class checkboxes
        const classCheckboxes = document.getElementById('classCheckboxes');
        classCheckboxes.innerHTML = classes.map(cls => `
            <div class="form-check">
                <input class="form-check-input" type="checkbox" value="${cls.id}" 
                       id="class_${cls.id}" onchange="toggleClass('${cls.id}')">
                <label class="form-check-label" for="class_${cls.id}">
                    ${cls.name || cls.id}
                </label>
            </div>
        `).join('');
        
        // Load announcements
        const announcements = await getAnnouncementsForTeacher(currentUser);
        const announcementsContent = document.getElementById('announcementsContent');
        
        if (announcements && announcements.length > 0) {
            announcementsContent.innerHTML = announcements.map(ann => `
                <div class="card mb-3">
                    <div class="card-header">
                        <h6 class="mb-1">${ann.title || 'Announcement'}</h6>
                        <small class="text-muted">${ann.postedBy || 'Admin'} - ${ann.date || 'N/A'}</small>
                    </div>
                    <div class="card-body">
                        <p>${ann.message || ''}</p>
                    </div>
                </div>
            `).join('');
        } else {
            announcementsContent.innerHTML = '<p class="text-muted">No announcements</p>';
        }
    } catch (error) {
        console.error('Announcements tab error:', error);
    }
}

function toggleClass(classId) {
    const checkbox = document.getElementById('class_' + classId);
    if (checkbox.checked) {
        selectedClasses.add(classId);
    } else {
        selectedClasses.delete(classId);
    }
}

async function postAnnouncement() {
    const title = document.getElementById('announcementTitle').value.trim();
    const message = document.getElementById('announcementMessage').value.trim();
    const messageDiv = document.getElementById('announcementMessage');
    
    if (!title || !message) {
        showAlert(messageDiv, 'Please fill in title and message', 'warning');
        return;
    }
    
    if (selectedClasses.size === 0) {
        showAlert(messageDiv, 'Please select at least one class', 'warning');
        return;
    }
    
    try {
        showAlert(messageDiv, 'Posting...', 'info');
        await postTeacherAnnouncement(currentUser, {
            title,
            message,
            classIds: Array.from(selectedClasses),
            date: new Date().toLocaleDateString()
        });
        
        showAlert(messageDiv, 'Announcement posted successfully!', 'success');
        document.getElementById('announcementTitle').value = '';
        document.getElementById('announcementMessage').value = '';
        selectedClasses.clear();
        
        // Reload announcements
        await loadAnnouncementsTab();
    } catch (error) {
        showAlert(messageDiv, 'Error posting announcement: ' + error.message, 'danger');
    }
}

// ============================================
// PROFILE TAB
// ============================================

async function loadProfileTab() {
    try {
        const profile = await getTeacherProfile(currentUser);
        
        document.getElementById('profileName').value = profile.name || '';
        document.getElementById('profileEmail').value = profile.email || '';
        document.getElementById('profileDepartment').value = profile.department || '';
        document.getElementById('profilePhone').value = profile.phone || '';
        document.getElementById('profileBio').value = profile.bio || '';
    } catch (error) {
        console.error('Profile tab error:', error);
    }
}

async function updateProfile() {
    try {
        const updates = {
            department: document.getElementById('profileDepartment').value,
            phone: document.getElementById('profilePhone').value,
            bio: document.getElementById('profileBio').value
        };
        
        await updateTeacherProfile(currentUser, updates);
        showAlert(
            document.getElementById('profileMessage'), 
            'Profile updated successfully', 
            'success'
        );
    } catch (error) {
        showAlert(
            document.getElementById('profileMessage'), 
            'Error updating profile: ' + error.message, 
            'danger'
        );
    }
}

async function changePassword() {
    const current = document.getElementById('currentPassword').value;
    const newPass = document.getElementById('newPassword').value;
    const confirm = document.getElementById('confirmPassword').value;
    const messageDiv = document.getElementById('passwordMessage');
    
    if (!current || !newPass || !confirm) {
        showAlert(messageDiv, 'Please fill in all fields', 'warning');
        return;
    }
    
    if (newPass !== confirm) {
        showAlert(messageDiv, 'Passwords do not match', 'warning');
        return;
    }
    
    try {
        showAlert(messageDiv, 'Updating password...', 'info');
        await updateUserPassword(current, newPass);
        showAlert(messageDiv, 'Password updated successfully', 'success');
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
    } catch (error) {
        showAlert(messageDiv, 'Error: ' + error.message, 'danger');
    }
}

// ============================================
// ADMIN PANEL
// ============================================

// Store teacher data for modal
let currentEditingTeacher = null;

async function loadAdminPanel() {
    try {
        if (currentUser && currentUser.name) {
            document.getElementById('adminName').textContent = currentUser.name;
        }
        
        // Make sure Teachers tab is showing by default
        document.getElementById('teachersTab').classList.add('show', 'active');
        document.getElementById('studentsTab').classList.remove('show', 'active');
        
        // Load pending teachers from Firestore
        try {
            const pendingTeachers = await getPendingTeachers();
            const pendingListDiv = document.getElementById('pendingTeachersList');
            
            if (pendingTeachers.length === 0) {
                pendingListDiv.innerHTML = '<p class="text-muted">No pending approvals</p>';
            } else {
                let pendingHTML = '';
                pendingTeachers.forEach(teacher => {
                    pendingHTML += `
                        <div class="card mb-3">
                            <div class="card-body">
                                <h6 class="card-title">${teacher.name}</h6>
                                <p class="card-text mb-1"><small><strong>Email:</strong> ${teacher.email}</small></p>
                                <p class="card-text mb-1"><small><strong>Department:</strong> ${teacher.department || 'N/A'}</small></p>
                                <p class="card-text mb-2"><small><strong>Phone:</strong> ${teacher.phone || 'N/A'}</small></p>
                                <button onclick="handleApproveTeacher('${teacher.uid}')" class="btn btn-sm btn-success">Approve</button>
                                <button onclick="handleRejectTeacher('${teacher.uid}')" class="btn btn-sm btn-danger">Reject</button>
                            </div>
                        </div>
                    `;
                });
                pendingListDiv.innerHTML = pendingHTML;
            }
        } catch (error) {
            console.error('Error loading pending teachers:', error);
            document.getElementById('pendingTeachersList').innerHTML = `<p class="text-danger">Error loading pending teachers</p>`;
        }
        
        // Load approved teachers
        try {
            const approvedTeachers = await getApprovedTeachers();
            const approvedListDiv = document.getElementById('approvedTeachersList');
            
            if (approvedTeachers.length === 0) {
                approvedListDiv.innerHTML = '<p class="text-muted">No approved teachers yet</p>';
            } else {
                let approvedHTML = '';
                approvedTeachers.forEach(teacher => {
                    const depts = teacher.departments && teacher.departments.length > 0 
                        ? teacher.departments.join(', ') 
                        : 'N/A';
                    const classes = teacher.assignedClasses && teacher.assignedClasses.length > 0 
                        ? teacher.assignedClasses.join(', ') 
                        : 'None assigned';
                    const subjects = teacher.assignedSubjects && teacher.assignedSubjects.length > 0 
                        ? teacher.assignedSubjects.join(', ') 
                        : 'None assigned';
                    
                    approvedHTML += `
                        <div class="card mb-3">
                            <div class="card-body">
                                <h6 class="card-title">${teacher.name}</h6>
                                <p class="card-text mb-1"><small><strong>Email:</strong> ${teacher.email}</small></p>
                                <p class="card-text mb-1"><small><strong>Department:</strong> ${depts}</small></p>
                                <p class="card-text mb-1"><small><strong>Phone:</strong> ${teacher.phone || 'N/A'}</small></p>
                                <p class="card-text mb-1"><small><strong>Role:</strong> <span class="badge bg-info">${teacher.role || 'teacher'}</span></small></p>
                                <p class="card-text mb-1"><small><strong>Classes:</strong> ${classes}</small></p>
                                <p class="card-text mb-2"><small><strong>Subjects:</strong> ${subjects}</small></p>
                                <button onclick="openTeacherAssignmentModal('${teacher.uid}')" class="btn btn-sm btn-primary">Edit Assignment</button>
                            </div>
                        </div>
                    `;
                });
                approvedListDiv.innerHTML = approvedHTML;
            }
        } catch (error) {
            console.error('Error loading approved teachers:', error);
            document.getElementById('approvedTeachersList').innerHTML = `<p class="text-danger">Error loading approved teachers</p>`;
        }
        
        // Load students
        loadStudentsList();
    } catch (error) {
        console.error('Admin panel error:', error);
    }
}

function setupAdminTabs() {
    // Show students tab and hide teachers tab
    document.getElementById('studentsTab').classList.add('show', 'active');
    document.getElementById('teachersTab').classList.remove('show', 'active');
    // Load students when Students tab is clicked
    loadStudentsList();
}

function showTeachersTab(e) {
    e.preventDefault();
    document.getElementById('teachersTab').classList.add('show', 'active');
    document.getElementById('studentsTab').classList.remove('show', 'active');
    // Update active tab styling
    document.querySelectorAll('#adminTabs .nav-link').forEach(link => link.classList.remove('active'));
    e.target.classList.add('active');
}

function showStudentsTab(e) {
    e.preventDefault();
    document.getElementById('studentsTab').classList.add('show', 'active');
    document.getElementById('teachersTab').classList.remove('show', 'active');
    // Update active tab styling
    document.querySelectorAll('#adminTabs .nav-link').forEach(link => link.classList.remove('active'));
    e.target.classList.add('active');
    // Load students when tab is shown
    loadStudentsList();
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function showAlert(element, message, type) {
    if (!element) return;
    element.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
}

function showError(element, message) {
    if (!element) return;
    element.textContent = message;
    element.style.color = message.includes('Signing in') ? '#667eea' : '#dc3545';
}
async function handleApproveTeacher(teacherUid) {
    try {
        await approveTeacher(teacherUid);
        alert('Teacher approved successfully!');
        loadAdminPanel();
    } catch (error) {
        alert('Failed to approve teacher: ' + error.message);
        console.error('Approval error:', error);
    }
}

async function handleRejectTeacher(teacherUid) {
    if (confirm('Are you sure you want to reject this teacher?')) {
        try {
            // For now, just delete the teacher document
            await window.db.collection('teachers').doc(teacherUid).delete();
            alert('Teacher rejected successfully!');
            loadAdminPanel();
        } catch (error) {
            alert('Failed to reject teacher: ' + error.message);
            console.error('Rejection error:', error);
        }
    }
}

function openTeacherAssignmentModal(teacherUid) {
    // Fetch the teacher data and populate the modal
    window.db.collection('teachers').doc(teacherUid).get().then(doc => {
        if (doc.exists) {
            const teacher = doc.data();
            currentEditingTeacher = { uid: teacherUid, ...teacher };
            
            document.getElementById('editTeacherId').value = teacherUid;
            document.getElementById('editTeacherName').textContent = teacher.name;
            document.getElementById('editTeacherRole').value = teacher.role || 'teacher';
            document.getElementById('editTeacherPhone').value = teacher.phone || '';
            document.getElementById('editTeacherSubjects').value = (teacher.assignedSubjects || []).join(', ');
            
            // Reset all department checkboxes
            document.querySelectorAll('.department-checkbox').forEach(checkbox => {
                checkbox.checked = false;
            });
            
            // Check the assigned departments
            const departments = teacher.departments || [];
            departments.forEach(deptValue => {
                const deptId = deptValue.toLowerCase().replace(/\s+/g, '_').replace(/[\(\)]/g, '');
                const checkbox = document.getElementById(`dept_${deptId}`);
                if (checkbox) {
                    checkbox.checked = true;
                }
            });
            
            // Reset all class checkboxes
            document.querySelectorAll('.class-checkbox').forEach(checkbox => {
                checkbox.checked = false;
            });
            
            // Check the assigned classes
            const assignedClasses = teacher.assignedClasses || [];
            assignedClasses.forEach(classValue => {
                const classId = classValue.toLowerCase().replace(/\s+/g, '_').replace(/[\(\)]/g, '');
                const checkbox = document.getElementById(`class_${classId}`);
                if (checkbox) {
                    checkbox.checked = true;
                }
            });
            
            // Open the modal
            const modalElement = document.getElementById('assignTeacherModal');
            const modal = new bootstrap.Modal(modalElement);
            modal.show();
        }
    }).catch(error => {
        console.error('Error fetching teacher data:', error);
        alert('Error loading teacher data');
    });
}

async function handleSaveTeacherAssignment() {
    try {
        const teacherUid = document.getElementById('editTeacherId').value;
        const role = document.getElementById('editTeacherRole').value;
        const subjectsInput = document.getElementById('editTeacherSubjects').value;
        
        // Get checked departments
        const departments = [];
        document.querySelectorAll('.department-checkbox:checked').forEach(checkbox => {
            departments.push(checkbox.value);
        });
        
        // Get checked classes
        const assignedClasses = [];
        document.querySelectorAll('.class-checkbox:checked').forEach(checkbox => {
            assignedClasses.push(checkbox.value);
        });
        
        // Parse subjects
        const assignedSubjects = subjectsInput
            .split(',')
            .map(s => s.trim())
            .filter(s => s);
        
        await updateTeacherAssignment(teacherUid, {
            role,
            departments,
            assignedClasses,
            assignedSubjects
        });
        
        alert('Teacher assignment updated successfully!');
        
        // Close modal using Bootstrap
        const modalElement = document.getElementById('assignTeacherModal');
        const modal = bootstrap.Modal.getInstance(modalElement);
        if (modal) {
            modal.hide();
        }
        
        loadAdminPanel();
    } catch (error) {
        alert('Failed to save teacher assignment: ' + error.message);
        console.error('Save error:', error);
    }
}

// Toggle password visibility
function togglePasswordVisibility(inputId) {
    const passwordInput = document.getElementById(inputId);
    const toggleButton = document.getElementById(inputId + 'Toggle');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleButton.querySelector('.password-toggle-icon').textContent = '🙈';
    } else {
        passwordInput.type = 'password';
        toggleButton.querySelector('.password-toggle-icon').textContent = '👁️';
    }
}

// Expose functions globally
window.handleLogin = handleLogin;
window.handleSignup = handleSignup;
window.handleLogout = handleLogout;
window.toggleAuthForm = toggleAuthForm;
window.togglePasswordVisibility = togglePasswordVisibility;
window.handleApproveTeacher = handleApproveTeacher;
window.handleRejectTeacher = handleRejectTeacher;
window.openTeacherAssignmentModal = openTeacherAssignmentModal;
window.handleSaveTeacherAssignment = handleSaveTeacherAssignment;
window.showAdminPanel = showAdminPanel;
window.handleRegisterStudent = handleRegisterStudent;
window.loadStudentsList = loadStudentsList;
window.deleteStudentRecord = deleteStudentRecord;
window.editStudent = editStudent;
window.showTeachersTab = showTeachersTab;
window.showStudentsTab = showStudentsTab;