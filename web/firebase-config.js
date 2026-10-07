// =================================================================
// firebase-config.js — Configuration Firebase
// =================================================================
// 
// INSTRUCTIONS DE CONFIGURATION :
// 1. Allez sur https://console.firebase.google.com
// 2. Créez un nouveau projet (ex: "abdennour-site")
// 3. Ajoutez une application Web (icône </>)
// 4. Copiez les valeurs de votre config Firebase ci-dessous
// 5. Activez Firestore Database dans la console Firebase :
//    - Build > Firestore Database > Create Database
//    - Choisissez le mode "production"
// 6. Configurez les règles de sécurité Firestore :
//    (voir les règles suggérées plus bas dans ce fichier)
//
// =================================================================

const firebaseConfig = {
  apiKey: "AIzaSyCHYcIs1DHbCvAcYQoIGRRvPayvsPsMqrU",
  authDomain: "perso-website-8204f.firebaseapp.com",
  databaseURL: "https://perso-website-8204f-default-rtdb.firebaseio.com",
  projectId: "perso-website-8204f",
  storageBucket: "perso-website-8204f.firebasestorage.app",
  messagingSenderId: "119430280027",
  appId: "1:119430280027:web:c16105b6355ed74046e07e",
  measurementId: "G-KVXSE006PW"
};

// =================================================================
// RÈGLES FIRESTORE SUGGÉRÉES (à copier dans la console Firebase) :
// =================================================================
//
// rules_version = '2';
// service cloud.firestore {
//   match /databases/{database}/documents {
//     // Lecture publique pour tout le monde
//     match /blog_posts/{postId} {
//       allow read: if true;
//       allow write: if request.auth != null;
//     }
//     match /projects/{projectId} {
//       allow read: if true;
//       allow write: if request.auth != null;
//     }
//     match /settings/{docId} {
//       allow read, write: if request.auth != null;
//     }
//   }
// }
//
// NOTE : Pour simplifier (pas de Firebase Auth), on utilisera des
// règles ouvertes en écriture au début. Vous pourrez les sécuriser
// plus tard avec Firebase Authentication.
// =================================================================

// Initialisation Firebase
let db = null;
let firebaseReady = false;
const firebaseReadyCallbacks = [];

function onFirebaseReady(callback) {
    if (firebaseReady) {
        callback();
    } else {
        firebaseReadyCallbacks.push(callback);
    }
}

try {
    // Vérifier que la config est renseignée
    if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "VOTRE_API_KEY") {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        firebaseReady = true;
        console.log('✅ Firebase Firestore initialisé');
        firebaseReadyCallbacks.forEach(cb => cb());
    } else {
        console.warn('⚠️ Firebase non configuré — mode localStorage (données locales uniquement)');
        firebaseReady = false;
    }
} catch (error) {
    console.error('❌ Erreur Firebase:', error);
    firebaseReady = false;
}
