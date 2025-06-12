// ✅ Firebase 初期化（init.js）
const firebaseConfig = {
	apiKey: "AIzaSyDVM03mzjPhbxxmxjThrFRHchj8ISkraKI",
    authDomain: "perva-pj.firebaseapp.com",
    projectId: "perva-pj",
    storageBucket: "perva-pj.firebasestorage.app",
    messagingSenderId: "1052917241472",
    appId: "1:1052917241472:web:ad3360df3a5e9ec1493865"
};

firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();
const auth = firebase.auth();
