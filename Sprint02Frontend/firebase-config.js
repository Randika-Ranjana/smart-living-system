import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { getFirestore, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDUwuzlSSNRQmi4nnYM9HQh2L8bU6aRLGI",
  authDomain: "smart-temp-7c070.firebaseapp.com",
  projectId: "smart-temp-7c070",
  storageBucket: "smart-temp-7c070.appspot.com",
  messagingSenderId: "215204905627",
  appId: "1:215204905627:web:05b158fc08c666e4837c3e",
  measurementId: "G-M634L42DWH"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db, doc, setDoc, serverTimestamp };