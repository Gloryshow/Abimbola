// Authentication Service with RBAC
// Uses global window.auth and window.db from firebase.js

const USER_ROLES = {
  ADMIN: 'admin',
  TEACHER: 'teacher',
};

/**
 * Register new teacher
 */
const registerTeacher = async (email, password, teacherData) => {
  try {
    console.log('registerTeacher called. window.auth:', !!window.auth, 'window.firebase:', !!window.firebase);
    
    if (!window.auth) {
      throw new Error('Firebase Auth not initialized');
    }
    
    const userCredential = await window.auth.createUserWithEmailAndPassword(email, password);
    const uid = userCredential.user.uid;

    const teacherDoc = {
      uid,
      email,
      name: teacherData.name,
      role: USER_ROLES.TEACHER,
      department: teacherData.department || '',
      assignedClasses: teacherData.assignedClasses || [],
      assignedSubjects: teacherData.assignedSubjects || [],
      phone: teacherData.phone || '',
      approved: false,
      createdAt: window.firebase.firestore.Timestamp.now(),
      updatedAt: window.firebase.firestore.Timestamp.now(),
    };

    await window.db.collection('teachers').doc(uid).set(teacherDoc);
    return { uid, ...teacherDoc };
  } catch (error) {
    throw new Error(`Registration failed: ${error.message}`);
  }
};

/**
 * Login user
 */
const loginUser = async (email, password) => {
  try {
    console.log('loginUser called. window.auth:', !!window.auth);
    
    if (!window.auth) {
      throw new Error('Firebase Auth not initialized. Please refresh the page.');
    }
    
    const userCredential = await window.auth.signInWithEmailAndPassword(email, password);
    const user = userCredential.user;
    const userData = await getUserData(user.uid);

    return {
      uid: user.uid,
      email: user.email,
      ...userData,
    };
  } catch (error) {
    throw new Error(`Login failed: ${error.message}`);
  }
};

/**
 * Get user data from Firestore
 */
const getUserData = async (uid) => {
  try {
    // Check if user is teacher
    const teacherDoc = await window.db.collection('teachers').doc(uid).get();
    if (teacherDoc.exists) {
      return teacherDoc.data();
    }

    // Check if user is admin
    const adminDoc = await window.db.collection('admins').doc(uid).get();
    if (adminDoc.exists) {
      return adminDoc.data();
    }

    throw new Error('User data not found');
  } catch (error) {
    throw new Error(`Failed to fetch user data: ${error.message}`);
  }
};

/**
 * Logout user
 */
const logoutUser = async () => {
  try {
    await window.auth.signOut();
  } catch (error) {
    throw new Error(`Logout failed: ${error.message}`);
  }
};

/**
 * Update password
 */
const updateUserPassword = async (currentPassword, newPassword) => {
  try {
    const user = window.auth.currentUser;
    if (!user) {
      throw new Error('No user logged in');
    }
    await user.updatePassword(newPassword);
  } catch (error) {
    throw new Error(`Password update failed: ${error.message}`);
  }
};

/**
 * Monitor auth state changes
 */
const onAuthChange = (callback) => {
  return window.auth.onAuthStateChanged(async (user) => {
    if (user) {
      try {
        const userData = await getUserData(user.uid);
        callback({
          uid: user.uid,
          email: user.email,
          ...userData,
        });
      } catch (error) {
        console.error('Error fetching user data:', error);
        callback(null);
      }
    } else {
      callback(null);
    }
  });
};

// Expose functions globally
window.registerTeacher = registerTeacher;
window.loginUser = loginUser;
window.getUserData = getUserData;
window.logoutUser = logoutUser;
window.updateUserPassword = updateUserPassword;
window.onAuthChange = onAuthChange;
