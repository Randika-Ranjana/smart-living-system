import { makeAuthenticatedRequest } from './auth.js';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const errorElement = document.getElementById('login-error');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorElement.classList.add('hidden');

        const formData = new FormData(loginForm);
        const loginData = {
            email: formData.get('email'),
            password: formData.get('password')
        };

        try {
            const response = await fetch('http://localhost:4000/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(loginData)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Login failed');
            }

            // Store token and redirect
            sessionStorage.setItem('authToken', result.token);
            sessionStorage.setItem('userEmail', loginData.email);
            window.location.href = 'dashboard.html';
        } catch (error) {
            console.error('Login error:', error);
            errorElement.textContent = error.message;
            errorElement.classList.remove('hidden');
        }
    });
});