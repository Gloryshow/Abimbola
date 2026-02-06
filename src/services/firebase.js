// Firebase Configuration and Initialization
// Using CDN-loaded Firebase SDK with compat API (vanilla JS compatible)

const firebaseConfig = {
  apiKey: "AIzaSyDDx0RhTZZCwAktYvOQ7-9Hlh5Fj-nF3X4",
  authDomain: "abimbola-school-573eb.firebaseapp.com",
  projectId: "abimbola-school-573eb",
  storageBucket: "abimbola-school-573eb.firebasestorage.app",
  messagingSenderId: "568959621612",
  appId: "1:568959621612:web:d2e358626dd800294948c9",
  measurementId: "G-96SET4YPWR"
};

// Wait for Firebase SDK to load, then initialize
function initializeFirebase() {
  try {
    if (typeof firebase === 'undefined') {
      console.error('Firebase SDK not loaded');
      setTimeout(initializeFirebase, 100);
      return;
    }

    const app = firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();
    const storage = firebase.storage ? firebase.storage() : null;

    // Set persistence
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
      .catch((error) => console.error('Persistence error:', error));

    // Make auth, db, storage, and firebase globally available
    window.firebase = firebase;
    window.auth = auth;
    window.db = db;
    window.storage = storage;

    console.log('Firebase initialized successfully:', { 
      auth: !!window.auth, 
      db: !!window.db, 
      storage: !!window.storage,
      firebase: !!window.firebase 
    });
  } catch (error) {
    console.error('Firebase initialization error:', error);
  }
}

// Initialize Firebase
initializeFirebase();
