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
  const messageDiv = document.getElementById("message");

  try {
    // Validate inputs
    if (!username || !email || !password) {
      showMessage("Please fill in all fields", "error");
      return;
    }

    // Create user with email and password
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    // Store additional user data in Firestore
    await setDoc(doc(db, "users", userCredential.user.uid), {
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
    console.error("Signup error:", error);
    let errorMessage = "Signup failed";
    if (error.code === "auth/email-already-in-use") {
      errorMessage = "Email already in use";
    } else if (error.code === "auth/weak-password") {
      errorMessage = "Password should be at least 6 characters";
    } else if (error.code === "auth/invalid-email") {
      errorMessage = "Invalid email address";
    }
    showMessage(errorMessage, "error");
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
    console.error("Login error:", error);
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
      console.error("Logout error:", error);
      showMessage(`Logout error: ${error.message}`, "error");
    });
}

function showMessage(text, type) {
  const message = document.getElementById('message');
  if (message) {
    message.textContent = text;
    message.className = `p-3 rounded-lg ${type === 'error' ? 'bg-red-500' : 'bg-green-500'} text-white`;
    message.classList.remove('hidden');
    
    setTimeout(() => {
      message.classList.add('hidden');
    }, 3000);
  }
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