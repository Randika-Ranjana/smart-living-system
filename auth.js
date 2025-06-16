import { auth, db, doc, setDoc } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

async function signup() {
  const username = document.getElementById("username")?.value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    // Store user data in 'usernames' collection
    await setDoc(doc(db, "usernames", userCredential.user.uid), {
      username: username,
      email: email,
      createdAt: new Date(),
      devices: []
    });

    showMessage("Account created successfully! Redirecting...", "success");
    setTimeout(() => {
      window.location.href = "dashboard.html";
    }, 1500);
  } catch (error) {
    showMessage(`Signup failed: ${error.message}`, "error");
  }
}

async function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    showMessage("Login successful! Redirecting...", "success");
    setTimeout(() => {
      window.location.href = "dashboard.html";
    }, 1500);
  } catch (error) {
    showMessage(`Login failed: ${error.message}`, "error");
  }
}

function logout() {
  signOut(auth)
    .then(() => {
      showMessage("Logged out successfully.", "success");
      setTimeout(() => {
        window.location.href = "index.html";
      }, 1000);
    })
    .catch((error) => {
      showMessage(`Logout error: ${error.message}`, "error");
    });
}

function showMessage(text, type) {
  message.textContent = text;
  message.className = `notification ${type}`;
}

// Make functions globally accessible
window.login = login;
window.signup = signup;
window.logout = logout;

// Check auth state and redirect
onAuthStateChanged(auth, (user) => {
  if (user && (window.location.pathname.includes("login.html") || 
               window.location.pathname.includes("signup.html"))) {
    window.location.href = "dashboard.html";
  }
  
  if (!user && window.location.pathname.includes("dashboard.html")) {
    window.location.href = "login.html";
  }
});