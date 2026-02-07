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
let currentEditingAnnouncementId = null;
let attendanceChart = null; // Store chart instance

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
        // Check if user is admin
        if (!currentUser || currentUser.role !== 'admin') {
            showMessage('studentRegisterMessage', 'Only admins can register new students', 'danger');
            return;
        }

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
            registrationNumber: regNum, // Will be auto-generated if empty
            parentName,
            parentPhone,
            phone,
            address
        });

        showMessage('studentRegisterMessage', `Student registered successfully! (Reg #: ${student.registrationNumber})`, 'success');
        
        // Reset form
        document.getElementById('studentRegistrationForm').reset();
        
        // Clear the registration number field for next entry
        document.getElementById('studentRegNum').value = '';
        
        // Reload students list
        loadStudentsList();
    } catch (error) {
        showMessage('studentRegisterMessage', error.message, 'danger');
        console.error('Registration error:', error);
    }
}

// Store all students for search functionality
let allStudents = [];

async function loadStudentsList() {
    try {
        let students = [];
        let displayTitle = 'Registered Students';
        
        // If user is a teacher, only show students in their assigned class
        if (currentUser && currentUser.role === 'teacher') {
            if (currentUser.assignedClass) {
                students = await getStudentsByClass(currentUser.assignedClass);
                displayTitle = `Students in ${currentUser.assignedClass}`;
            } else {
                students = [];
            }
        } else {
            // Admin sees all students
            students = await getStudents();
        }

        // Store all students for search
        allStudents = students;
        
        // Reset search input
        const searchInput = document.getElementById('studentSearch');
        if (searchInput) {
            searchInput.value = '';
            searchInput.onkeyup = filterStudents;
        }

        renderStudentsList(students, displayTitle);
    } catch (error) {
        console.error('Error loading students:', error);
        document.getElementById('studentsList').innerHTML = `<p class="text-danger">Error loading students</p>`;
    }
}

function filterStudents() {
    const searchTerm = document.getElementById('studentSearch').value.toLowerCase();
    
    if (!searchTerm) {
        // If search is empty, show all students
        renderStudentsList(allStudents, 'Registered Students');
        return;
    }
    
    const filteredStudents = allStudents.filter(student => {
        const name = (student.name || '').toLowerCase();
        const className = (student.class || '').toLowerCase();
        const regNum = (student.registrationNumber || '').toLowerCase();
        
        return name.includes(searchTerm) || className.includes(searchTerm) || regNum.includes(searchTerm);
    });
    
    renderStudentsList(filteredStudents, 'Search Results');
}

function renderStudentsList(students, displayTitle) {
    const studentsList = document.getElementById('studentsList');

    if (students.length === 0) {
        studentsList.innerHTML = '<p class="text-muted">No students found</p>';
    } else {
        // Count header with role-based info
        const countInfo = currentUser && currentUser.role === 'teacher' 
            ? `${students.length} student${students.length !== 1 ? 's' : ''} in ${currentUser.assignedClass}`
            : `${students.length} student${students.length !== 1 ? 's' : ''} found`;
        
        let studentsHTML = `<div class="mb-3"><p class="text-muted"><strong>${countInfo}</strong></p></div><div class="table-responsive"><table class="table table-hover"><thead><tr><th>Name</th><th>Email</th><th>Class</th><th>Reg. Number</th>`;
        
        // Only show Actions column if user is admin
        if (currentUser && currentUser.role === 'admin') {
            studentsHTML += '<th>Actions</th>';
        }
        
        studentsHTML += '</tr></thead><tbody>';
        
        students.forEach(student => {
            studentsHTML += `
                <tr>
                    <td><strong>${student.name}</strong></td>
                    <td>${student.email}</td>
                    <td><span class="badge bg-primary">${student.class}</span></td>
                    <td>${student.registrationNumber || '-'}</td>`;
            
            // Only show action buttons if user is admin
            if (currentUser && currentUser.role === 'admin') {
                studentsHTML += `
                    <td>
                        <button onclick="editStudent('${student.id}')" class="btn btn-sm btn-info">Edit</button>
                        <button onclick="deleteStudentRecord('${student.id}', '${student.name}')" class="btn btn-sm btn-danger">Delete</button>
                    </td>`;
            }
            
            studentsHTML += '</tr>';
        });
        
        studentsHTML += '</tbody></table></div>';
        studentsList.innerHTML = studentsHTML;
    }
}

async function deleteStudentRecord(studentId, studentName) {
    // Check if user is admin
    if (!currentUser || currentUser.role !== 'admin') {
        alert('Only admins can delete students');
        return;
    }

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
    // Check if user is admin
    if (!currentUser || currentUser.role !== 'admin') {
        alert('Only admins can edit students');
        return;
    }
    
    // Find the student in allStudents
    const student = allStudents.find(s => s.id === studentId);
    if (!student) {
        alert('Student not found');
        return;
    }
    
    // Populate the edit form
    document.getElementById('editStudentId').value = student.id;
    document.getElementById('editStudentName').textContent = student.name;
    document.getElementById('editStudentFormName').value = student.name;
    document.getElementById('editStudentFormEmail').value = student.email;
    document.getElementById('editStudentFormClass').value = student.class;
    document.getElementById('editStudentFormDOB').value = student.dateOfBirth || '';
    document.getElementById('editStudentFormRegNum').value = student.registrationNumber || '';
    document.getElementById('editStudentFormParentName').value = student.parentName || '';
    document.getElementById('editStudentFormParentPhone').value = student.parentPhone || '';
    document.getElementById('editStudentFormPhone').value = student.phone || '';
    document.getElementById('editStudentFormAddress').value = student.address || '';
    document.getElementById('editStudentMessage').innerHTML = '';
    
    // Show the modal
    const modal = new window.bootstrap.Modal(document.getElementById('editStudentModal'));
    modal.show();
}

async function handleSaveStudentChanges() {
    try {
        const studentId = document.getElementById('editStudentId').value;
        const name = document.getElementById('editStudentFormName').value.trim();
        const email = document.getElementById('editStudentFormEmail').value.trim();
        const className = document.getElementById('editStudentFormClass').value;
        const dob = document.getElementById('editStudentFormDOB').value;
        const parentName = document.getElementById('editStudentFormParentName').value.trim();
        const parentPhone = document.getElementById('editStudentFormParentPhone').value.trim();
        const phone = document.getElementById('editStudentFormPhone').value.trim();
        const address = document.getElementById('editStudentFormAddress').value.trim();
        
        if (!name || !email || !className) {
            document.getElementById('editStudentMessage').innerHTML = '<div class="alert alert-danger">Name, email, and class are required</div>';
            return;
        }
        
        document.getElementById('editStudentMessage').innerHTML = '<div class="alert alert-info">Updating student...</div>';
        
        await updateStudent(studentId, {
            name,
            email,
            class: className,
            dateOfBirth: dob,
            parentName,
            parentPhone,
            phone,
            address
        });
        
        document.getElementById('editStudentMessage').innerHTML = '<div class="alert alert-success">Student updated successfully!</div>';
        
        // Close modal and reload students
        setTimeout(() => {
            const modal = window.bootstrap.Modal.getInstance(document.getElementById('editStudentModal'));
            if (modal) modal.hide();
            loadStudentsList();
        }, 1500);
    } catch (error) {
        document.getElementById('editStudentMessage').innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
        console.error('Update error:', error);
    }
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
        
        // Populate admin name in payment recording form (auto-filled and read-only)
        const paymentReceivedByField = document.getElementById('paymentReceivedBy');
        if (paymentReceivedByField && currentUser) {
            const adminName = currentUser.name || currentUser.displayName || 'Unknown';
            paymentReceivedByField.value = adminName;
        }
        
        // Show admin panel button only for admins
        const adminBtn = document.getElementById('adminPanelBtn');
        const adminBtnMobile = document.getElementById('adminPanelBtnMobile');
        if (currentUser && currentUser.role === 'admin') {
            adminBtn.style.display = 'block';
            if (adminBtnMobile) adminBtnMobile.style.display = 'block';
        } else {
            adminBtn.style.display = 'none';
            if (adminBtnMobile) adminBtnMobile.style.display = 'none';
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
        
        // Fetch announcement count from last 24 hours
        let announcementsCount = 0;
        try {
            announcementsCount = await window.getRecentAnnouncementCount();
        } catch (error) {
            console.error('Error fetching announcement count:', error);
            announcementsCount = 0;
        }
        
        // Update all stat elements (navbar, mobile, desktop)
        const classesCount = overview.totalClasses || 0;
        const studentsCount = overview.totalStudents || 0;
        const subjectsCount = overview.totalSubjects || 0;
        
        // Update navbar stats
        const statsClassesNav = document.getElementById('statsClassesNav');
        const statsStudentsNav = document.getElementById('statsStudentsNav');
        const statsSubjectsNav = document.getElementById('statsSubjectsNav');
        const statsAnnouncementsNav = document.getElementById('statsAnnouncementsNav');
        
        if (statsClassesNav) statsClassesNav.textContent = classesCount;
        if (statsStudentsNav) statsStudentsNav.textContent = studentsCount;
        if (statsSubjectsNav) statsSubjectsNav.textContent = subjectsCount;
        if (statsAnnouncementsNav) statsAnnouncementsNav.textContent = announcementsCount;
        
        // Update mobile stats
        const statsClassesMobile = document.getElementById('statsClassesMobile');
        const statsStudentsMobile = document.getElementById('statsStudentsMobile');
        const statsSubjectsMobile = document.getElementById('statsSubjectsMobile');
        const statsAnnouncementsMobile = document.getElementById('statsAnnouncementsMobile');
        
        if (statsClassesMobile) statsClassesMobile.textContent = classesCount;
        if (statsStudentsMobile) statsStudentsMobile.textContent = studentsCount;
        if (statsSubjectsMobile) statsSubjectsMobile.textContent = subjectsCount;
        if (statsAnnouncementsMobile) statsAnnouncementsMobile.textContent = announcementsCount;
        
        // Update desktop stats
        const statsClasses = document.getElementById('statsClasses');
        const statsStudents = document.getElementById('statsStudents');
        const statsSubjects = document.getElementById('statsSubjects');
        const statsAnnouncements = document.getElementById('statsAnnouncements');
        
        if (statsClasses) statsClasses.textContent = classesCount;
        if (statsStudents) statsStudents.textContent = studentsCount;
        if (statsSubjects) statsSubjects.textContent = subjectsCount;
        if (statsAnnouncements) statsAnnouncements.textContent = announcementsCount;
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
        const classSelect = document.getElementById('attendanceClass');
        const statsClassSelect = document.getElementById('statsAttendanceClass');
        const statsDateInput = document.getElementById('statsAttendanceDate');
        
        classSelect.innerHTML = '<option value="">-- Select Class --</option>';
        statsClassSelect.innerHTML = '<option value="">-- Select Class --</option>';
        
        // Set today's date as default for stats
        const today = new Date().toISOString().split('T')[0];
        statsDateInput.value = today;
        
        let classes = [];
        
        // Admins can see all classes, teachers see only assigned classes
        if (currentUser && currentUser.role === 'admin') {
            classes = await window.getAllClasses(currentUser);
        } else if (currentUser) {
            // For teachers, use their assigned classes
            classes = currentUser.assignedClasses ? currentUser.assignedClasses.map(cls => ({
                id: cls,
                name: cls
            })) : [];
        }
        
        if (classes && classes.length > 0) {
            const options = classes.map(cls => 
                `<option value="${cls.id || cls}">${cls.name || cls.id || cls}</option>`
            ).join('');
            classSelect.innerHTML += options;
            statsClassSelect.innerHTML += options;
        }
        
        // For admins, show overall statistics by default
        if (currentUser && currentUser.role === 'admin') {
            await loadOverallAttendanceChart(today);
        }
    } catch (error) {
        console.error('Attendance tab error:', error);
    }
}

async function loadAttendanceStudents() {
    const classId = document.getElementById('attendanceClass').value;
    if (!classId) return;
    
    try {
        let students = [];
        
        // Admins can load students from any class, teachers from assigned classes
        if (currentUser && currentUser.role === 'admin') {
            students = await window.getAllStudentsInClass(currentUser, classId);
        } else {
            students = await getClassStudents(currentUser, classId);
        }
        
        const content = document.getElementById('attendanceStudentsContent');
        
        if (students && students.length > 0) {
            attendanceData = {};
            
            // Load today's attendance if it exists
            let todayAttendance = null;
            try {
                todayAttendance = await window.getTodayAttendance(currentUser, classId);
            } catch (error) {
                console.error('Error loading today attendance:', error);
            }
            
            // Create a map of already marked attendance
            const attendanceMap = {};
            if (todayAttendance && todayAttendance.students) {
                todayAttendance.students.forEach(record => {
                    attendanceMap[record.studentId] = record.status;
                });
            }
            
            content.innerHTML = `
                <div class="table-responsive">
                    <table class="table table-hover">
                        <thead>
                            <tr>
                                <th>Student</th>
                                <th>Reg. Number</th>
                                <th style="text-align: center;">Present</th>
                                <th style="text-align: center;">Absent</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${students.map((student) => {
                                const previousStatus = attendanceMap[student.id];
                                attendanceData[student.id] = { status: previousStatus || '', name: student.name };
                                const isPresentChecked = previousStatus === 'present' ? 'checked' : '';
                                const isAbsentChecked = previousStatus === 'absent' ? 'checked' : '';
                                
                                return `
                                    <tr>
                                        <td><strong>${student.name || 'N/A'}</strong></td>
                                        <td><small>${student.registrationNumber || '-'}</small></td>
                                        <td style="text-align: center;">
                                            <input type="checkbox" class="form-check-input" id="present_${student.id}" 
                                                   ${isPresentChecked}
                                                   onchange="updateAttendanceStatus('${student.id}', 'present')">
                                        </td>
                                        <td style="text-align: center;">
                                            <input type="checkbox" class="form-check-input" id="absent_${student.id}" 
                                                   ${isAbsentChecked}
                                                   onchange="updateAttendanceStatus('${student.id}', 'absent')">
                                        </td>
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
        console.error('Load attendance students error:', error);
        document.getElementById('attendanceStudentsContent').innerHTML = `<p class="text-danger">Error: ${error.message}</p>`;
    }
}

function updateAttendanceStatus(studentId, status) {
    const presentCheckbox = document.getElementById(`present_${studentId}`);
    const absentCheckbox = document.getElementById(`absent_${studentId}`);
    
    if (status === 'present') {
        presentCheckbox.checked = true;
        absentCheckbox.checked = false;
        attendanceData[studentId].status = 'present';
    } else if (status === 'absent') {
        presentCheckbox.checked = false;
        absentCheckbox.checked = true;
        attendanceData[studentId].status = 'absent';
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
        // Build students array with status
        const students = Object.keys(attendanceData).map(studentId => ({
            studentId,
            studentName: attendanceData[studentId].name,
            status: attendanceData[studentId].status || 'present'
        }));
        
        if (students.length === 0) {
            alert('Please select at least one student');
            return;
        }
        
        await window.takeAttendance(currentUser, classId, {
            students,
            date
        });
        
        alert('Attendance submitted successfully');
        loadAttendanceStudents();
        document.getElementById('attendanceDate').value = '';
    } catch (error) {
        alert('Error submitting attendance: ' + error.message);
        console.error('Attendance error:', error);
    }
}

// ============================================
// RESULTS TAB
// ============================================

async function loadResultsTab() {
    try {
        let classes;
        
        // Admins can see all classes, teachers see only assigned classes
        if (currentUser.role === 'admin') {
            classes = await getAllClasses(currentUser);
            // Hide enter results for admins
            document.getElementById('enterResultsCard').style.display = 'none';
        } else {
            classes = await getTeacherClasses(currentUser);
            // Show enter results for teachers
            document.getElementById('enterResultsCard').style.display = 'block';
        }
        
        const classSelect = document.getElementById('resultsClass');
        const viewClassSelect = document.getElementById('viewResultsClass');
        
        const classOptions = '<option value="">-- Select Class --</option>' + 
            (classes && classes.length > 0 ? classes.map(cls => 
                `<option value="${cls.id}">${cls.name || cls.id}</option>`
            ).join('') : '');
        
        classSelect.innerHTML = classOptions;
        viewClassSelect.innerHTML = classOptions;
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
                    <table class="table table-sm">
                        <thead>
                            <tr>
                                <th>Student</th>
                                <th>CA1 (/30)</th>
                                <th>CA2 (/30)</th>
                                <th>CA3 (/30)</th>
                                <th>Exam (/70)</th>
                                <th>CA Avg</th>
                                <th>Final Score</th>
                                <th>Grade</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${students.map((student) => {
                                resultsData[student.id] = {
                                    id: student.id,
                                    name: student.name,
                                    regNum: student.regNum || 'N/A',
                                    ca1: 0, ca2: 0, ca3: 0, exam: 0,
                                    classId: classId,
                                    subjectId: subjectId,
                                    termId: document.getElementById('resultsTerm').value
                                };
                                return `
                                    <tr>
                                        <td>${student.name || 'N/A'}</td>
                                        <td>
                                            <input type="number" class="form-control form-control-sm ca-input" 
                                                   data-student="${student.id}" data-field="ca1"
                                                   max="30" min="0" step="0.5" placeholder="0"
                                                   onchange="updateResultsRow('${student.id}')">
                                        </td>
                                        <td>
                                            <input type="number" class="form-control form-control-sm ca-input" 
                                                   data-student="${student.id}" data-field="ca2"
                                                   max="30" min="0" step="0.5" placeholder="0"
                                                   onchange="updateResultsRow('${student.id}')">
                                        </td>
                                        <td>
                                            <input type="number" class="form-control form-control-sm ca-input" 
                                                   data-student="${student.id}" data-field="ca3"
                                                   max="30" min="0" step="0.5" placeholder="0"
                                                   onchange="updateResultsRow('${student.id}')">
                                        </td>
                                        <td>
                                            <input type="number" class="form-control form-control-sm ca-input" 
                                                   data-student="${student.id}" data-field="exam"
                                                   max="70" min="0" step="0.5" placeholder="0"
                                                   onchange="updateResultsRow('${student.id}')">
                                        </td>
                                        <td><input type="text" class="form-control form-control-sm ca-avg_${student.id}" readonly></td>
                                        <td><input type="text" class="form-control form-control-sm final_${student.id}" readonly></td>
                                        <td><input type="text" class="form-control form-control-sm grade_${student.id}" readonly></td>
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

async function loadResultsSubjects() {
    const classId = document.getElementById('resultsClass').value;
    if (!classId) return;
    
    try {
        const subjects = await getTeacherSubjects(currentUser, classId);
        const subjectSelect = document.getElementById('resultsSubject');
        
        subjectSelect.innerHTML = '<option value="">-- Select Subject --</option>';
        if (subjects && subjects.length > 0) {
            subjectSelect.innerHTML += subjects.map(subj => 
                `<option value="${subj.id}">${subj.name || subj.id}</option>`
            ).join('');
        }
    } catch (error) {
        console.error('Load subjects error:', error);
    }
}

function updateResultsRow(studentId) {
    if (!resultsData[studentId]) return;
    
    const ca1Input = document.querySelector(`[data-student="${studentId}"][data-field="ca1"]`);
    const ca2Input = document.querySelector(`[data-student="${studentId}"][data-field="ca2"]`);
    const ca3Input = document.querySelector(`[data-student="${studentId}"][data-field="ca3"]`);
    const examInput = document.querySelector(`[data-student="${studentId}"][data-field="exam"]`);
    
    const ca1 = parseFloat(ca1Input?.value) || 0;
    const ca2 = parseFloat(ca2Input?.value) || 0;
    const ca3 = parseFloat(ca3Input?.value) || 0;
    const exam = parseFloat(examInput?.value) || 0;
    
    const caAvgField = document.querySelector(`.ca-avg_${studentId}`);
    const finalField = document.querySelector(`.final_${studentId}`);
    const gradeField = document.querySelector(`.grade_${studentId}`);
    
    // Update data
    resultsData[studentId].ca1 = ca1;
    resultsData[studentId].ca2 = ca2;
    resultsData[studentId].ca3 = ca3;
    resultsData[studentId].exam = exam;
    
    // Only calculate if ALL fields have been entered
    if (ca1Input?.value && ca2Input?.value && ca3Input?.value && examInput?.value) {
        const caAvg = window.calculateCAAverage(ca1, ca2, ca3);
        const finalScore = window.calculateFinalScore(ca1, ca2, ca3, exam);
        const grade = window.calculateGradeFromScore(finalScore);
        
        caAvgField.value = caAvg.toFixed(2);
        finalField.value = finalScore.toFixed(2);
        gradeField.value = grade;
        
        resultsData[studentId].caAverage = caAvg;
        resultsData[studentId].finalScore = finalScore;
        resultsData[studentId].grade = grade;
    } else {
        // Clear calculated fields if not all inputs are filled
        caAvgField.value = '';
        finalField.value = '';
        gradeField.value = '';
        
        resultsData[studentId].caAverage = 0;
        resultsData[studentId].finalScore = 0;
        resultsData[studentId].grade = '';
    }
}

async function submitResultForm() {
    const classId = document.getElementById('resultsClass').value;
    const subjectId = document.getElementById('resultsSubject').value;
    const messageDiv = document.getElementById('resultsMessage');
    
    if (!classId || !subjectId) {
        messageDiv.innerHTML = '<div class="alert alert-warning">Please select class and subject</div>';
        return;
    }
    
    try {
        messageDiv.innerHTML = '<div class="alert alert-info">Saving results...</div>';
        let successCount = 0;
        let errorCount = 0;
        
        for (const studentId in resultsData) {
            const result = resultsData[studentId];
            if (result.ca1 || result.ca2 || result.ca3 || result.exam) {
                try {
                    await window.submitResult(currentUser, {
                        studentId: result.id,
                        studentName: result.name,
                        subjectId: subjectId,
                        classId: classId,
                        termId: document.getElementById('resultsTerm').value,
                        ca1: result.ca1,
                        ca2: result.ca2,
                        ca3: result.ca3,
                        exam: result.exam,
                        comments: ''
                    });
                    successCount++;
                } catch (error) {
                    console.error(`Error saving result for ${result.name}:`, error);
                    errorCount++;
                }
            }
        }
        
        if (successCount > 0) {
            messageDiv.innerHTML = `<div class="alert alert-success">Successfully saved ${successCount} result(s)${errorCount > 0 ? `. ${errorCount} failed.` : ''}</div>`;
        } else {
            messageDiv.innerHTML = '<div class="alert alert-warning">No results to save</div>';
        }
    } catch (error) {
        console.error('Submit results error:', error);
        messageDiv.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
    }
}

async function loadViewResults() {
    const classId = document.getElementById('viewResultsClass').value;
    const subjectId = document.getElementById('viewResultsSubject').value;
    const termId = document.getElementById('viewResultsTerm').value;
    const content = document.getElementById('viewResultsContent');
    
    if (!classId || !subjectId) {
        content.innerHTML = '';
        document.getElementById('printBtn').style.display = 'none';
        return;
    }
    
    try {
        let results;
        
        // Use appropriate function based on user role
        if (currentUser.role === 'admin') {
            results = await window.getAdminResults(currentUser, classId, subjectId, termId);
        } else {
            results = await window.getTeacherResults(currentUser, classId, subjectId, termId);
        }
        
        if (results && results.length > 0) {
            document.getElementById('printBtn').style.display = 'block';
            content.innerHTML = `
                <div class="table-responsive">
                    <table class="table table-sm table-striped">
                        <thead>
                            <tr>
                                <th>Student</th>
                                <th>CA1</th>
                                <th>CA2</th>
                                <th>CA3</th>
                                <th>Exam</th>
                                <th>CA Avg</th>
                                <th>Final Score</th>
                                <th>Grade</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${results.map((result) => `
                                <tr>
                                    <td>${result.studentName || 'N/A'}</td>
                                    <td>${result.ca1 || 0}</td>
                                    <td>${result.ca2 || 0}</td>
                                    <td>${result.ca3 || 0}</td>
                                    <td>${result.exam || 0}</td>
                                    <td>${result.caAverage ? result.caAverage.toFixed(2) : '0'}</td>
                                    <td>${result.finalScore ? result.finalScore.toFixed(2) : '0'}</td>
                                    <td><strong>${result.grade || 'N/A'}</strong></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } else {
            document.getElementById('printBtn').style.display = 'none';
            content.innerHTML = '<p class="text-muted">No results found</p>';
        }
    } catch (error) {
        console.error('Load view results error:', error);
        document.getElementById('printBtn').style.display = 'none';
        content.innerHTML = `<p class="text-danger">Error: ${error.message}</p>`;
    }
}

function printResults() {
    const classId = document.getElementById('viewResultsClass').value;
    const subjectId = document.getElementById('viewResultsSubject').value;
    const termId = document.getElementById('viewResultsTerm').value;
    const table = document.querySelector('#viewResultsContent table');
    
    if (!table) {
        alert('No results to print');
        return;
    }
    
    const printWindow = window.open('', 'PRINT', 'height=600,width=800');
    const schoolName = 'Abimbola School Management System';
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Results Print</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .header { text-align: center; margin-bottom: 20px; }
                .header h2 { margin: 5px 0; }
                .header p { margin: 2px 0; color: #666; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #667eea; color: white; font-weight: bold; }
                tr:nth-child(even) { background-color: #f9f9f9; }
                .footer { margin-top: 30px; font-size: 12px; color: #666; }
            </style>
        </head>
        <body>
            <div class="header">
                <h2>${schoolName}</h2>
                <p>Results Sheet</p>
                <p>Term: ${termId.replace('term', 'Term ')} | Date: ${new Date().toLocaleDateString()}</p>
            </div>
            ${table.outerHTML}
            <div class="footer">
                <p>Printed on: ${new Date().toLocaleString()}</p>
            </div>
        </body>
        </html>
    `);
    
    printWindow.document.close();
    printWindow.print();
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

function showTeachersTab(e) {
    e.preventDefault();
    document.getElementById('teachersTab').classList.add('show', 'active');
    document.getElementById('studentsTab').classList.remove('show', 'active');
    document.getElementById('feesTab').classList.remove('show', 'active');
    // Update active tab styling
    document.querySelectorAll('#adminTabs .nav-link').forEach(link => link.classList.remove('active'));
    e.target.classList.add('active');
}

function showStudentsTab(e) {
    e.preventDefault();
    document.getElementById('studentsTab').classList.add('show', 'active');
    document.getElementById('teachersTab').classList.remove('show', 'active');
    document.getElementById('feesTab').classList.remove('show', 'active');
    // Update active tab styling
    document.querySelectorAll('#adminTabs .nav-link').forEach(link => link.classList.remove('active'));
    e.target.classList.add('active');
    
    // Show registration form only if user is admin
    const adminForm = document.getElementById('adminStudentForm');
    if (adminForm) {
        adminForm.style.display = (currentUser && currentUser.role === 'admin') ? '' : 'none';
    }
    
    // Load students when tab is shown
    loadStudentsList();
}

function showFeesTab(e) {
    e.preventDefault();
    document.getElementById('feesTab').classList.add('show', 'active');
    document.getElementById('teachersTab').classList.remove('show', 'active');
    document.getElementById('studentsTab').classList.remove('show', 'active');
    // Update active tab styling
    document.querySelectorAll('#adminTabs .nav-link').forEach(link => link.classList.remove('active'));
    e.target.classList.add('active');
    
    // Initialize fees tab on first load
    if (!document.getElementById('feesTab').hasAttribute('data-initialized')) {
        initializeFeesTab();
        document.getElementById('feesTab').setAttribute('data-initialized', 'true');
    }
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
function handleApproveTeacher(teacherUid) {
    console.log('Approving teacher:', teacherUid);
    window.approveTeacher(teacherUid)
        .then(() => {
            console.log('Teacher approved');
            alert('Teacher approved successfully!');
            loadAdminPanel();
        })
        .catch(error => {
            console.error('Approval error:', error);
            alert('Failed to approve teacher: ' + error.message);
        });
}

function handleRejectTeacher(teacherUid) {
    console.log('Rejecting teacher:', teacherUid);
    if (confirm('Are you sure you want to reject this teacher?')) {
        window.db.collection('teachers').doc(teacherUid).delete()
            .then(() => {
                console.log('Teacher rejected');
                alert('Teacher rejected successfully!');
                loadAdminPanel();
            })
            .catch(error => {
                console.error('Rejection error:', error);
                alert('Failed to reject teacher: ' + error.message);
            });
    }
}

function openTeacherAssignmentModal(teacherUid) {
    console.log('Opening modal for teacher:', teacherUid);
    
    window.db.collection('teachers').doc(teacherUid).get()
        .then(doc => {
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
                if (modalElement) {
                    const modal = new bootstrap.Modal(modalElement);
                    modal.show();
                    console.log('Modal opened successfully');
                } else {
                    console.error('Modal element not found');
                }
            } else {
                alert('Teacher not found');
                console.error('Teacher document does not exist');
            }
        })
        .catch(error => {
            console.error('Error fetching teacher data:', error);
            alert('Error loading teacher data: ' + error.message);
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

// ============================================
// ANNOUNCEMENTS
// ============================================

async function postAnnouncement() {
    try {
        const titleInput = document.getElementById('announcementTitle');
        const messageInput = document.getElementById('announcementMessage');
        const feedbackDiv = document.getElementById('announcementFormMessage');
        
        const title = titleInput.value.trim();
        const content = messageInput.value.trim();
        
        // Validation
        if (!title) {
            feedbackDiv.innerHTML = '<div class="alert alert-warning">Please enter an announcement title</div>';
            return;
        }
        
        if (!content) {
            feedbackDiv.innerHTML = '<div class="alert alert-warning">Please enter announcement content</div>';
            return;
        }
        
        // Check if user is admin
        if (currentUser.role !== 'admin') {
            feedbackDiv.innerHTML = '<div class="alert alert-danger">Only admins can post announcements</div>';
            return;
        }
        
        // Prepare announcement data
        const announcementData = {
            title,
            content,
            type: 'admin'
        };
        
        // Call service function
        const result = await window.postAdminAnnouncement(currentUser, announcementData);
        
        if (result.success) {
            feedbackDiv.innerHTML = '<div class="alert alert-success">✓ Announcement posted successfully!</div>';
            titleInput.value = '';
            messageInput.value = '';
            
            // Reload announcements after a short delay
            setTimeout(() => {
                loadAnnouncementsTab();
            }, 500);
        }
    } catch (error) {
        const feedbackDiv = document.getElementById('announcementFormMessage');
        feedbackDiv.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
        console.error('Error posting announcement:', error);
    }
}

async function loadAnnouncementsTab() {
    try {
        const announcementsContent = document.getElementById('announcementsContent');
        announcementsContent.innerHTML = '<p class="text-muted">Loading announcements...</p>';
        
        // Show/hide admin form based on role
        const adminForm = document.getElementById('adminAnnouncementForm');
        if (currentUser && currentUser.role === 'admin') {
            adminForm.style.display = 'block';
        } else {
            adminForm.style.display = 'none';
        }
        
        // Fetch announcements
        const announcements = await window.getAllAnnouncements();
        
        if (!announcements || announcements.length === 0) {
            announcementsContent.innerHTML = '<p class="text-muted text-center py-4">No announcements yet</p>';
            return;
        }
        
        // Render announcements
        let html = '';
        announcements.forEach(announcement => {
            const date = announcement.createdAt 
                ? new Date(announcement.createdAt.seconds ? announcement.createdAt.seconds * 1000 : announcement.createdAt)
                : new Date();
            
            const formattedDate = date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            // Check if current user is the author (for edit/delete buttons)
            const isAuthor = currentUser && currentUser.uid === announcement.authorId;
            
            html += `
                <div class="card mb-3 border-left border-primary border-4">
                    <div class="card-body">
                        <h5 class="card-title">${announcement.title || 'Untitled'}</h5>
                        <p class="card-text">${announcement.content || ''}</p>
                        <small class="text-muted">
                            Posted by: ${announcement.authorName || 'Admin'} • ${formattedDate}
                        </small>`;
            
            // Add edit/delete buttons if user is the author
            if (isAuthor) {
                html += `
                        <div class="mt-2">
                            <button class="btn btn-sm btn-info" onclick="openEditAnnouncementModal('${announcement.id}', \`${announcement.title.replace(/`/g, '\\`')}\`, \`${announcement.content.replace(/`/g, '\\`')}\`)">Edit</button>
                            <button class="btn btn-sm btn-danger" onclick="deleteAnnouncementConfirm('${announcement.id}', '${announcement.title}')">Delete</button>
                        </div>`;
            }
            
            html += `
                    </div>
                </div>
            `;
        });
        
        announcementsContent.innerHTML = html;
    } catch (error) {
        const announcementsContent = document.getElementById('announcementsContent');
        announcementsContent.innerHTML = `<p class="text-danger">Error loading announcements: ${error.message}</p>`;
        console.error('Error loading announcements:', error);
    }
}

function openEditAnnouncementModal(announcementId, title, content) {
    currentEditingAnnouncementId = announcementId;
    document.getElementById('editAnnouncementTitle').value = title;
    document.getElementById('editAnnouncementContent').value = content;
    document.getElementById('editAnnouncementMessage').innerHTML = '';
    
    const modal = new window.bootstrap.Modal(document.getElementById('editAnnouncementModal'));
    modal.show();
}

async function handleSaveAnnouncementChanges() {
    try {
        const title = document.getElementById('editAnnouncementTitle').value.trim();
        const content = document.getElementById('editAnnouncementContent').value.trim();
        const messageDiv = document.getElementById('editAnnouncementMessage');
        
        if (!title) {
            messageDiv.innerHTML = '<div class="alert alert-warning">Please enter a title</div>';
            return;
        }
        
        if (!content) {
            messageDiv.innerHTML = '<div class="alert alert-warning">Please enter content</div>';
            return;
        }
        
        messageDiv.innerHTML = '<div class="alert alert-info">Updating announcement...</div>';
        
        await window.updateAnnouncement(currentUser, currentEditingAnnouncementId, {
            title,
            content
        });
        
        messageDiv.innerHTML = '<div class="alert alert-success">Announcement updated successfully!</div>';
        
        setTimeout(() => {
            const modal = window.bootstrap.Modal.getInstance(document.getElementById('editAnnouncementModal'));
            if (modal) modal.hide();
            loadAnnouncementsTab();
        }, 1500);
    } catch (error) {
        document.getElementById('editAnnouncementMessage').innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
        console.error('Error updating announcement:', error);
    }
}

function deleteAnnouncementConfirm(announcementId, title) {
    if (confirm(`Are you sure you want to delete "${title}"?`)) {
        handleDeleteAnnouncement(announcementId);
    }
}

async function handleDeleteAnnouncement(announcementId = null) {
    try {
        const id = announcementId || currentEditingAnnouncementId;
        if (!id) {
            alert('No announcement selected');
            return;
        }
        
        const messageDiv = document.getElementById('editAnnouncementMessage');
        messageDiv.innerHTML = '<div class="alert alert-info">Deleting announcement...</div>';
        
        await window.deleteAnnouncement(currentUser, id);
        
        messageDiv.innerHTML = '<div class="alert alert-success">Announcement deleted successfully!</div>';
        
        setTimeout(() => {
            const modal = window.bootstrap.Modal.getInstance(document.getElementById('editAnnouncementModal'));
            if (modal) modal.hide();
            loadAnnouncementsTab();
        }, 1500);
    } catch (error) {
        const messageDiv = document.getElementById('editAnnouncementMessage');
        messageDiv.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
        console.error('Error deleting announcement:', error);
    }
}

// ============================================
// ATTENDANCE STATISTICS & CHARTS
// ============================================

async function loadOverallAttendanceChart(date) {
    try {
        // Only admins can see overall statistics
        if (!currentUser || currentUser.role !== 'admin') {
            document.getElementById('attendanceStatsText').innerHTML = '<p class="text-muted">Only admins can view overall statistics</p>';
            return;
        }
        
        const classSelect = document.getElementById('statsAttendanceClass');
        
        // Get all classes
        let classes = [];
        try {
            classes = await window.getAllClasses(currentUser);
        } catch (error) {
            console.error('Error fetching classes:', error);
        }
        
        if (!classes || classes.length === 0) {
            document.getElementById('attendanceStatsText').innerHTML = '<p class="text-muted">No classes found</p>';
            return;
        }
        
        // Fetch attendance stats for all classes
        let totalPresent = 0;
        let totalAbsent = 0;
        
        for (const cls of classes) {
            try {
                const stats = await window.getAttendanceStats(currentUser, cls.id, date);
                totalPresent += stats.present || 0;
                totalAbsent += stats.absent || 0;
            } catch (error) {
                console.error(`Error fetching stats for class ${cls.id}:`, error);
            }
        }
        
        const total = totalPresent + totalAbsent;
        const statsText = document.getElementById('attendanceStatsText');
        
        if (total === 0) {
            statsText.innerHTML = '<p class="text-muted">No attendance records for this date</p>';
            return;
        }
        
        // Calculate percentages
        const presentPercent = ((totalPresent / total) * 100).toFixed(1);
        const absentPercent = ((totalAbsent / total) * 100).toFixed(1);
        
        statsText.innerHTML = `
            <div class="row text-center">
                <div class="col-md-6">
                    <h3 class="text-success">${totalPresent}</h3>
                    <p class="text-muted">Present (${presentPercent}%)</p>
                </div>
                <div class="col-md-6">
                    <h3 class="text-danger">${totalAbsent}</h3>
                    <p class="text-muted">Absent (${absentPercent}%)</p>
                </div>
            </div>
            <p class="text-center text-muted mt-3">Total Students: ${total}</p>
        `;
        
        // Create pie chart
        const container = document.getElementById('attendanceChartContainer');
        container.innerHTML = '<canvas id="attendanceChart"></canvas>';
        
        // No need to destroy - we just recreated the canvas
        const ctx = document.getElementById('attendanceChart').getContext('2d');
        
        window.attendanceChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Present', 'Absent'],
                datasets: [{
                    data: [totalPresent, totalAbsent],
                    backgroundColor: ['#28a745', '#dc3545'],
                    borderColor: ['#20c997', '#fd7e14'],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const percent = ((value / total) * 100).toFixed(1);
                                return `${label}: ${value} (${percent}%)`;
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error loading overall attendance chart:', error);
        document.getElementById('attendanceStatsText').innerHTML = `<p class="text-danger">Error: ${error.message}</p>`;
    }
}

async function loadAttendanceChart() {
    try {
        const classId = document.getElementById('statsAttendanceClass').value;
        const date = document.getElementById('statsAttendanceDate').value;
        const statsText = document.getElementById('attendanceStatsText');
        
        if (!classId || !date) {
            statsText.innerHTML = '<p class="text-muted">Select a class and date to view statistics</p>';
            if (attendanceChart) {
                attendanceChart.destroy();
                attendanceChart = null;
            }
            return;
        }
        
        // Fetch attendance stats
        const stats = await window.getAttendanceStats(currentUser, classId, date);
        
        // Update stats text
        const attendancePercentage = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;
        statsText.innerHTML = `
            <div class="row">
                <div class="col-md-4">
                    <h6>Total Students</h6>
                    <h3 class="text-primary">${stats.total}</h3>
                </div>
                <div class="col-md-4">
                    <h6>Present</h6>
                    <h3 class="text-success">${stats.present}</h3>
                </div>
                <div class="col-md-4">
                    <h6>Absent</h6>
                    <h3 class="text-danger">${stats.absent}</h3>
                </div>
            </div>
            <div class="mt-2">
                <h6>Attendance Rate</h6>
                <div class="progress">
                    <div class="progress-bar bg-success" role="progressbar" style="width: ${attendancePercentage}%" aria-valuenow="${attendancePercentage}" aria-valuemin="0" aria-valuemax="100">
                        ${attendancePercentage}%
                    </div>
                </div>
            </div>
        `;
        
        // Create or update chart
        const container = document.getElementById('attendanceChartContainer');
        container.innerHTML = '<canvas id="attendanceChart"></canvas>';
        
        // No need to destroy - we just recreated the canvas
        const ctx = document.getElementById('attendanceChart').getContext('2d');
        
        window.attendanceChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Present', 'Absent'],
                datasets: [{
                    data: [stats.present, stats.absent],
                    backgroundColor: ['#28a745', '#dc3545'],
                    borderColor: ['#fff', '#fff'],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((context.parsed / total) * 100);
                                return context.label + ': ' + context.parsed + ' (' + percentage + '%)';
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error loading attendance chart:', error);
        document.getElementById('attendanceStatsText').innerHTML = `<p class="text-danger">Error: ${error.message}</p>`;
    }
}

// ============================================
// FEE MANAGEMENT FUNCTIONS
// ============================================

/**
 * Initialize fees tab with class data
 */
async function initializeFeesTab() {
    try {
        // Load classes for fee structure form
        const classes = await window.getAllClasses(currentUser);
        const classSelects = [
            'feeStructureClass',
            'summaryClass',
            'paymentStudentClass',
            'detailsStudentClass'
        ];
        
        classSelects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (select) {
                select.innerHTML = '<option value="">-- Select Class --</option>';
                classes.forEach(cls => {
                    const option = document.createElement('option');
                    option.value = cls.id;
                    option.textContent = cls.name;
                    select.appendChild(option);
                });
            }
        });
        
        // Set today's date for payment date field
        const paymentDateField = document.getElementById('paymentDate');
        if (paymentDateField) {
            paymentDateField.value = new Date().toISOString().split('T')[0];
        }
        
        // Load saved form data from localStorage
        loadFeeFormFromLocalStorage();
        
    } catch (error) {
        console.error('Error initializing fees tab:', error);
        alert('Failed to initialize fees tab: ' + error.message);
    }
}

/**
 * Add a new fee item row
 */
function addFeeItem() {
    const container = document.getElementById('feeItemsContainer');
    const rows = container.querySelectorAll('.fee-item-row');
    const newIndex = rows.length;
    
    const newRow = document.createElement('div');
    newRow.className = 'fee-item-row row mb-2';
    newRow.setAttribute('data-fee-index', newIndex);
    newRow.innerHTML = `
        <div class="col-12 col-md-6 mb-2">
            <input type="text" class="form-control fee-item-name" placeholder="Fee Type">
        </div>
        <div class="col-12 col-md-4 mb-2">
            <input type="number" class="form-control fee-item-amount" placeholder="Amount" min="0" oninput="calculateTotalFee()">
        </div>
        <div class="col-12 col-md-2 mb-2">
            <button type="button" class="btn btn-danger btn-sm w-100" onclick="removeFeeItem(${newIndex})">Remove</button>
        </div>
    `;
    
    container.appendChild(newRow);
    calculateTotalFee();
}

/**
 * Remove a fee item row
 */
function removeFeeItem(index) {
    const rows = document.querySelectorAll('.fee-item-row');
    if (rows.length > 1) {
        rows[index].remove();
        calculateTotalFee();
    } else {
        alert('You must have at least one fee item');
    }
}

/**
 * Calculate total fee from all items
 */
function calculateTotalFee() {
    const amounts = document.querySelectorAll('.fee-item-amount');
    let total = 0;
    
    amounts.forEach(input => {
        total += parseFloat(input.value) || 0;
    });
    
    const displayElement = document.getElementById('totalFeeDisplay');
    if (displayElement) {
        displayElement.textContent = '₦' + total.toLocaleString();
    }
    
    // Save to localStorage for persistence
    saveFeeFormToLocalStorage();
}

/**
 * Save fee form to localStorage
 */
function saveFeeFormToLocalStorage() {
    const classId = document.getElementById('feeStructureClass').value;
    const term = document.getElementById('feeStructureTerm').value;
    const feeItems = [];
    
    document.querySelectorAll('.fee-item-row').forEach(row => {
        const name = row.querySelector('.fee-item-name').value;
        const amount = row.querySelector('.fee-item-amount').value;
        if (name || amount) {
            feeItems.push({ name, amount });
        }
    });
    
    const formData = { classId, term, feeItems };
    localStorage.setItem('feeFormData', JSON.stringify(formData));
}

/**
 * Load fee form from localStorage
 */
function loadFeeFormFromLocalStorage() {
    const saved = localStorage.getItem('feeFormData');
    if (!saved) return;
    
    try {
        const formData = JSON.parse(saved);
        
        // Set class and term
        const classSelect = document.getElementById('feeStructureClass');
        const termSelect = document.getElementById('feeStructureTerm');
        
        if (formData.classId && classSelect) {
            classSelect.value = formData.classId;
        }
        if (formData.term && termSelect) {
            termSelect.value = formData.term;
        }
        
        // Restore fee items
        if (formData.feeItems && formData.feeItems.length > 0) {
            const container = document.getElementById('feeItemsContainer');
            const existingRows = container.querySelectorAll('.fee-item-row');
            
            // Clear existing items (except the header row)
            existingRows.forEach(row => row.remove());
            
            // Add restored items
            formData.feeItems.forEach((item, index) => {
                const newRow = document.createElement('div');
                newRow.className = 'fee-item-row row mb-2';
                newRow.setAttribute('data-fee-index', index);
                newRow.innerHTML = `
                    <div class="col-12 col-md-6 mb-2">
                        <input type="text" class="form-control fee-item-name" placeholder="Fee Type" value="${item.name || ''}">
                    </div>
                    <div class="col-12 col-md-4 mb-2">
                        <input type="number" class="form-control fee-item-amount" placeholder="Amount" min="0" value="${item.amount || ''}" oninput="calculateTotalFee()">
                    </div>
                    <div class="col-12 col-md-2 mb-2">
                        <button type="button" class="btn btn-danger btn-sm w-100" onclick="removeFeeItem(${index})">Remove</button>
                    </div>
                `;
                container.appendChild(newRow);
            });
            
            calculateTotalFee();
        }
    } catch (error) {
        console.error('Error loading fee form from localStorage:', error);
    }
}

/**
 * Handle creating/updating fee structure
 */
async function handleCreateFeeStructure(event) {
    event.preventDefault();
    
    try {
        // Check permissions
        if (!canManageFees(currentUser)) {
            alert('You do not have permission to manage fees');
            return;
        }
        
        const classId = document.getElementById('feeStructureClass').value;
        const term = document.getElementById('feeStructureTerm').value;
        const session = document.getElementById('feeStructureSession').value;
        const messageEl = document.getElementById('feeStructureMessage');
        
        if (!classId || !term || !session) {
            showMessage(messageEl, 'Please select session, class and term', 'danger');
            return;
        }
        
        // Collect fee items
        const feeStructure = {};
        const feeItems = document.querySelectorAll('.fee-item-row');
        
        feeItems.forEach(row => {
            const nameInput = row.querySelector('.fee-item-name');
            const amountInput = row.querySelector('.fee-item-amount');
            
            const name = nameInput.value.trim();
            const amount = parseFloat(amountInput.value) || 0;
            
            if (name && amount > 0) {
                feeStructure[name.toLowerCase().replace(/\s+/g, '_')] = amount;
            }
        });
        
        if (Object.keys(feeStructure).length === 0) {
            showMessage(messageEl, 'Please add at least one fee item', 'danger');
            return;
        }
        
        showMessage(messageEl, 'Creating fee structure...', 'info');
        
        // Prepare admin info
        const adminInfo = {
            uid: currentUser.uid,
            name: currentUser.displayName || currentUser.email
        };
        
        // Create fee structure with session and admin tracking
        await createFeeStructure(classId, term, session, feeStructure, adminInfo);
        
        // Bulk initialize student fees
        const totalFee = Object.values(feeStructure).reduce((sum, fee) => sum + fee, 0);
        const result = await bulkInitializeStudentFees(classId, term, totalFee, session);
        
        showMessage(messageEl, `✅ Fee structure created! Initialized ${result.studentsInitialized} student records.`, 'success');
        
        // Don't reset form - keep the fee items for reference or further editing
        // Just clear the class/term selections for next entry
        // document.getElementById('feeStructureForm').reset();
        // calculateTotalFee();
        
    } catch (error) {
        console.error('Error creating fee structure:', error);
        showMessage(document.getElementById('feeStructureMessage'), error.message, 'danger');
    }
}

/**
 * Load existing fee structure
 */
async function loadExistingFeeStructure() {
    try {
        const classId = document.getElementById('feeStructureClass').value;
        const term = document.getElementById('feeStructureTerm').value;
        const session = document.getElementById('feeStructureSession').value;
        
        if (!classId || !term || !session) {
            alert('Please select class, term, and session first');
            return;
        }
        
        const feeStructure = await getFeeStructure(classId, term, session);
        
        if (!feeStructure) {
            alert('No existing fee structure found for this class and term');
            return;
        }
        
        // Populate session field if available
        if (feeStructure.session) {
            document.getElementById('feeStructureSession').value = feeStructure.session;
        }
        
        // Clear current items
        const container = document.getElementById('feeItemsContainer');
        const rows = container.querySelectorAll('.fee-item-row');
        rows.forEach((row, index) => {
            if (index > 0) row.remove();
        });
        
        // Populate with existing data
        let index = 0;
        for (const [key, value] of Object.entries(feeStructure)) {
            if (key !== 'totalFee' && key !== 'createdAt' && key !== 'updatedAt' && 
                key !== 'session' && key !== 'createdBy' && key !== 'createdByName' &&
                key !== 'classId' && key !== 'term') {
                const feeType = key.split('_').join(' ');
                const row = document.querySelectorAll('.fee-item-row')[index] || null;
                
                if (row) {
                    row.querySelector('.fee-item-name').value = feeType;
                    row.querySelector('.fee-item-amount').value = value;
                } else {
                    document.getElementById('feeItemsContainer').insertAdjacentHTML('beforeend', `
                        <div class="fee-item-row row mb-2" data-fee-index="${index}">
                            <div class="col-12 col-md-6 mb-2">
                                <input type="text" class="form-control fee-item-name" placeholder="Fee Type" value="${feeType}">
                            </div>
                            <div class="col-12 col-md-4 mb-2">
                                <input type="number" class="form-control fee-item-amount" placeholder="Amount" value="${value}" min="0" oninput="calculateTotalFee()">
                            </div>
                            <div class="col-12 col-md-2 mb-2">
                                <button type="button" class="btn btn-danger btn-sm w-100" onclick="removeFeeItem(${index})">Remove</button>
                            </div>
                        </div>
                    `);
                }
                index++;
            }
        }
        
        calculateTotalFee();
        
        // Show audit info
        let auditInfo = '';
        if (feeStructure.createdByName) {
            let createdDate = 'N/A';
            if (feeStructure.createdAt) {
                try {
                    // Handle Firestore Timestamp objects
                    if (feeStructure.createdAt.toDate) {
                        createdDate = feeStructure.createdAt.toDate().toLocaleString();
                    } 
                    // Handle regular timestamps (milliseconds)
                    else if (typeof feeStructure.createdAt === 'number') {
                        createdDate = new Date(feeStructure.createdAt).toLocaleString();
                    }
                    // Handle Date objects
                    else if (feeStructure.createdAt instanceof Date) {
                        createdDate = feeStructure.createdAt.toLocaleString();
                    }
                } catch (e) {
                    createdDate = 'Unable to parse date';
                }
            }
            auditInfo = `✓ Created by ${feeStructure.createdByName} on ${createdDate}`;
        }
        
        alert(`Fee structure loaded successfully!\n${auditInfo}`);
        
    } catch (error) {
        console.error('Error loading fee structure:', error);
        alert('Failed to load fee structure: ' + error.message);
    }
}

/**
 * Load class fee summary
 */
async function loadClassFeeSummary() {
    try {
        const classId = document.getElementById('summaryClass').value;
        const term = document.getElementById('summaryTerm').value;
        const session = document.getElementById('summarySession').value;
        
        if (!classId || !term || !session) {
            const statsDiv = document.getElementById('feeSummaryStats');
            if (statsDiv) {
                statsDiv.innerHTML = '<p class="text-muted">Select a class, term, and session to view summary</p>';
            }
            return;
        }
        
        const summary = await getClassFeeSummary(classId, term, session);
        
        // Update stats - check if elements exist
        const summaryStudents = document.getElementById('summaryStudents');
        const summaryExpected = document.getElementById('summaryExpected');
        const summaryCollected = document.getElementById('summaryCollected');
        const summaryOutstanding = document.getElementById('summaryOutstanding');
        
        if (summaryStudents) summaryStudents.textContent = summary.totalStudents;
        if (summaryExpected) summaryExpected.textContent = '₦' + summary.totalExpected.toLocaleString();
        if (summaryCollected) summaryCollected.textContent = '₦' + summary.totalCollected.toLocaleString();
        if (summaryOutstanding) summaryOutstanding.textContent = '₦' + summary.totalOutstanding.toLocaleString();
        
        // Generate details table
        let html = `
            <table class="table table-striped table-hover">
                <thead class="table-light">
                    <tr>
                        <th>Student Name</th>
                        <th>Total Fee</th>
                        <th>Paid</th>
                        <th>Balance</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        summary.feeRecords.forEach(record => {
            const statusColor = record.status === 'Paid' ? 'success' : record.status === 'Part Payment' ? 'warning' : 'danger';
            html += `
                <tr>
                    <td>${record.studentName}</td>
                    <td>₦${record.totalFee.toLocaleString()}</td>
                    <td>₦${record.totalPaid.toLocaleString()}</td>
                    <td>₦${record.balance.toLocaleString()}</td>
                    <td><span class="badge bg-${statusColor}">${record.status}</span></td>
                </tr>
            `;
        });
        
        html += `
                </tbody>
            </table>
        `;
        
        const detailsDiv = document.getElementById('feeSummaryDetails');
        if (detailsDiv) {
            detailsDiv.innerHTML = html;
        }
        
    } catch (error) {
        console.error('Error loading fee summary:', error);
        const detailsDiv = document.getElementById('feeSummaryDetails');
        if (detailsDiv) {
            detailsDiv.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
        }
    }
}

/**
 * Load students for payment recording
 */
async function loadStudentsForPayment() {
    try {
        const classId = document.getElementById('paymentStudentClass').value;
        const select = document.getElementById('paymentStudent');
        select.innerHTML = '<option value="">-- Select Student --</option>';
        
        if (!classId) return;
        
        const students = await getStudentsByClass(classId);
        
        students.forEach(student => {
            const option = document.createElement('option');
            option.value = student.id;
            option.textContent = student.name;
            select.appendChild(option);
        });
        
    } catch (error) {
        console.error('Error loading students:', error);
        alert('Failed to load students: ' + error.message);
    }
}

/**
 * Load student fee status
 */
async function loadStudentFeeStatus() {
    try {
        const studentId = document.getElementById('paymentStudent').value;
        const term = document.getElementById('paymentTerm').value;
        const statusCard = document.getElementById('studentFeeStatusCard');
        
        if (!studentId || !term) {
            alert('Please select student and term');
            return;
        }
        
        const feeRecord = await getStudentFeeRecord(studentId, term);
        
        if (!feeRecord) {
            alert('No fee record found for this student in the selected term');
            return;
        }
        
        // Update status card
        document.getElementById('feeStatusTotal').textContent = '₦' + feeRecord.totalFee.toLocaleString();
        document.getElementById('feeStatusPaid').textContent = '₦' + feeRecord.totalPaid.toLocaleString();
        document.getElementById('feeStatusBalance').textContent = '₦' + feeRecord.balance.toLocaleString();
        document.getElementById('feeStatusStatus').textContent = feeRecord.status;
        statusCard.style.display = '';
        
    } catch (error) {
        console.error('Error loading fee status:', error);
        alert('Failed to load fee status: ' + error.message);
    }
}

/**
 * Handle recording a payment
 */
async function handleRecordPayment(event) {
    event.preventDefault();
    
    try {
        // Check permissions
        if (!canRecordPayments(currentUser)) {
            alert('You do not have permission to record payments');
            return;
        }
        
        const studentId = document.getElementById('paymentStudent').value;
        const term = document.getElementById('paymentTerm').value;
        const amount = parseFloat(document.getElementById('paymentAmount').value);
        const date = document.getElementById('paymentDate').value;
        const method = document.getElementById('paymentMethod').value;
        const reference = document.getElementById('paymentReference').value;
        const messageEl = document.getElementById('recordPaymentMessage');
        
        // Always use the current admin's name - no manual entry allowed (name only, no email)
        const adminName = currentUser.displayName || currentUser.name || 'Unknown';
        
        if (!studentId || !term || !amount || !date || !method) {
            showMessage(messageEl, 'Please fill in all required fields', 'danger');
            return;
        }
        
        if (amount <= 0) {
            showMessage(messageEl, 'Amount must be greater than 0', 'danger');
            return;
        }
        
        showMessage(messageEl, 'Recording payment...', 'info');
        
        // Prepare admin/bursar info (name only, no email for security)
        const adminInfo = {
            uid: currentUser.uid,
            name: adminName
        };
        
        const payment = await recordPayment(studentId, term, {
            amount,
            date,
            method,
            receivedBy: adminName,
            reference
        }, adminInfo);
        
        showMessage(messageEl, '✅ Payment recorded successfully!', 'success');
        
        // Reset form
        document.getElementById('recordPaymentForm').reset();
        document.getElementById('studentFeeStatusCard').style.display = 'none';
        document.getElementById('paymentDate').value = new Date().toISOString().split('T')[0];
        
    } catch (error) {
        console.error('Error recording payment:', error);
        showMessage(document.getElementById('recordPaymentMessage'), error.message, 'danger');
    }
}

/**
 * Load students for fee details view
 */
async function loadStudentsForDetails() {
    try {
        const classId = document.getElementById('detailsStudentClass').value;
        const select = document.getElementById('detailsStudent');
        select.innerHTML = '<option value="">-- Select Student --</option>';
        
        if (!classId) return;
        
        const students = await getStudentsByClass(classId);
        
        students.forEach(student => {
            const option = document.createElement('option');
            option.value = student.id;
            option.textContent = student.name;
            select.appendChild(option);
        });
        
    } catch (error) {
        console.error('Error loading students:', error);
        alert('Failed to load students: ' + error.message);
    }
}

/**
 * Load and display student fee details with payment history
 */
async function loadStudentFeeDetails() {
    try {
        const studentId = document.getElementById('detailsStudent').value;
        const container = document.getElementById('studentFeeDetailsContainer');
        
        if (!studentId) {
            container.innerHTML = '<p class="text-muted">Select a student to view fee details and payment history</p>';
            return;
        }
        
        // Get student info
        const studentDoc = await window.db.collection('students').doc(studentId).get();
        const student = studentDoc.data();
        
        // Get all fee records
        const allFeeRecords = await getStudentAllFeeRecords(studentId);
        
        let html = '<div class="row">';
        
        for (const [term, feeRecord] of Object.entries(allFeeRecords)) {
            // Get payments for this term
            const payments = await getStudentPayments(studentId, term);
            
            const statusColor = feeRecord.status === 'Paid' ? 'success' : feeRecord.status === 'Part Payment' ? 'warning' : 'danger';
            
            html += `
                <div class="col-12 mb-4">
                    <div class="card">
                        <div class="card-header bg-light">
                            <h6 class="mb-0">${term.replace(/([A-Z])/g, ' $1').trim()} - <span class="badge bg-${statusColor}">${feeRecord.status}</span></h6>
                        </div>
                        <div class="card-body">
                            <div class="row mb-3">
                                <div class="col-12 col-md-3 text-center">
                                    <h6 class="text-muted">Total Fee</h6>
                                    <h5>₦${feeRecord.totalFee.toLocaleString()}</h5>
                                </div>
                                <div class="col-12 col-md-3 text-center">
                                    <h6 class="text-muted">Paid</h6>
                                    <h5 style="color: #28a745;">₦${feeRecord.totalPaid.toLocaleString()}</h5>
                                </div>
                                <div class="col-12 col-md-3 text-center">
                                    <h6 class="text-muted">Balance</h6>
                                    <h5 style="color: #dc3545;">₦${feeRecord.balance.toLocaleString()}</h5>
                                </div>
                                <div class="col-12 col-md-3 text-center">
                                    <h6 class="text-muted">Collection %</h6>
                                    <h5>${feeRecord.totalFee > 0 ? ((feeRecord.totalPaid / feeRecord.totalFee) * 100).toFixed(0) : 0}%</h5>
                                </div>
                            </div>

                            <hr>

                            <h6 class="mb-3">Payment History</h6>
                            ${payments.length > 0 ? `
                                <table class="table table-sm table-striped">
                                    <thead class="table-light">
                                        <tr>
                                            <th>Date</th>
                                            <th>Amount</th>
                                            <th>Method</th>
                                            <th>Received By</th>
                                            <th>Recorded By</th>
                                            <th>Time</th>
                                            <th>Reference</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${payments.map(payment => {
                                            let recordedTime = 'N/A';
                                            if (payment.recordedAt) {
                                                try {
                                                    // Handle Firestore Timestamp objects
                                                    if (payment.recordedAt.toDate) {
                                                        recordedTime = payment.recordedAt.toDate().toLocaleString();
                                                    } 
                                                    // Handle regular timestamps (milliseconds)
                                                    else if (typeof payment.recordedAt === 'number') {
                                                        recordedTime = new Date(payment.recordedAt).toLocaleString();
                                                    }
                                                    // Handle Date objects
                                                    else if (payment.recordedAt instanceof Date) {
                                                        recordedTime = payment.recordedAt.toLocaleString();
                                                    }
                                                } catch (e) {
                                                    recordedTime = 'Invalid Date';
                                                }
                                            }
                                            return `
                                            <tr>
                                                <td>${payment.date}</td>
                                                <td>₦${payment.amount.toLocaleString()}</td>
                                                <td>${payment.method}</td>
                                                <td><small>${payment.receivedBy || 'Unknown'}</small></td>
                                                <td><small>${payment.recordedByName || 'Unknown'}</small></td>
                                                <td><small>${recordedTime}</small></td>
                                                <td>${payment.reference || '--'}</td>
                                            </tr>
                                        `}).join('')}
                                    </tbody>
                                </table>
                            ` : `<p class="text-muted">No payments recorded yet</p>`}
                        </div>
                    </div>
                </div>
            `;
        }
        
        html += '</div>';
        
        if (Object.keys(allFeeRecords).length === 0) {
            html = '<p class="text-muted">No fee records found for this student</p>';
        }
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading fee details:', error);
        document.getElementById('studentFeeDetailsContainer').innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
    }
}

/**
 * Delete a payment record
 */
async function deletePaymentRecord(studentId, term, paymentId) {
    if (confirm('Are you sure you want to delete this payment? This will recalculate the fee balance.')) {
        try {
            await deletePayment(studentId, term, paymentId);
            loadStudentFeeDetails();
            alert('Payment deleted successfully!');
        } catch (error) {
            alert('Failed to delete payment: ' + error.message);
        }
    }
}

// Helper function to show messages
function showMessage(element, message, type) {
    if (!element) return;
    element.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
}

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
window.showFeesTab = showFeesTab;
window.postAnnouncement = postAnnouncement;
window.loadAnnouncementsTab = loadAnnouncementsTab;
window.openEditAnnouncementModal = openEditAnnouncementModal;
window.handleSaveAnnouncementChanges = handleSaveAnnouncementChanges;
window.handleDeleteAnnouncement = handleDeleteAnnouncement;
window.deleteAnnouncementConfirm = deleteAnnouncementConfirm;
window.loadAttendanceChart = loadAttendanceChart;
window.loadOverallAttendanceChart = loadOverallAttendanceChart;
// Fee management functions
window.initializeFeesTab = initializeFeesTab;
window.addFeeItem = addFeeItem;
window.removeFeeItem = removeFeeItem;
window.calculateTotalFee = calculateTotalFee;
window.handleCreateFeeStructure = handleCreateFeeStructure;
window.loadExistingFeeStructure = loadExistingFeeStructure;
window.loadClassFeeSummary = loadClassFeeSummary;
window.loadStudentsForPayment = loadStudentsForPayment;
window.loadStudentFeeStatus = loadStudentFeeStatus;
window.handleRecordPayment = handleRecordPayment;
window.loadStudentsForDetails = loadStudentsForDetails;
window.loadStudentFeeDetails = loadStudentFeeDetails;
window.deletePaymentRecord = deletePaymentRecord;