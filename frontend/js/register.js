import { makeAuthenticatedRequest } from './auth.js';

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('register-form');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirm-password');
    const passwordStrength = document.getElementById('password-strength');
    const passwordMatch = document.getElementById('password-match');
    const addDeviceBtn = document.getElementById('add-device-btn');
    const deviceIdsContainer = document.getElementById('device-ids-container');
    const errorElement = document.getElementById('register-error');
    const successElement = document.getElementById('register-success');

    // Password strength indicator
    passwordInput.addEventListener('input', () => {
        const password = passwordInput.value;
        let strength = 'Weak';
        let color = 'text-red-500';

        if (password.length >= 12) {
            strength = 'Strong';
            color = 'text-green-500';
        } else if (password.length >= 8) {
            strength = 'Medium';
            color = 'text-yellow-500';
        }

        passwordStrength.textContent = `Password strength: ${strength}`;
        passwordStrength.className = `text-xs mt-1 ${color}`;
    });

    // Password match checker
    confirmPasswordInput.addEventListener('input', () => {
        if (confirmPasswordInput.value === passwordInput.value && passwordInput.value !== '') {
            passwordMatch.classList.remove('hidden');
            passwordMatch.className = 'text-xs mt-1 text-green-500';
            passwordMatch.textContent = 'Passwords match';
        } else if (confirmPasswordInput.value !== '') {
            passwordMatch.classList.remove('hidden');
            passwordMatch.className = 'text-xs mt-1 text-red-500';
            passwordMatch.textContent = 'Passwords do not match';
        } else {
            passwordMatch.classList.add('hidden');
        }
    });

    // Add device ID field
    addDeviceBtn.addEventListener('click', () => {
        const newDeviceField = document.createElement('div');
        newDeviceField.className = 'flex';
        newDeviceField.innerHTML = `
            <input type="text" name="device-id" placeholder="Device ID"
                class="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm">
            <button type="button" class="remove-device-btn ml-2 px-2 text-red-500">×</button>
        `;
        deviceIdsContainer.appendChild(newDeviceField);

        // Add event listener to remove button
        newDeviceField.querySelector('.remove-device-btn').addEventListener('click', () => {
            deviceIdsContainer.removeChild(newDeviceField);
        });
    });

    // Form submission
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorElement.classList.add('hidden');
        successElement.classList.add('hidden');

        // Get form data
        const formData = new FormData(registerForm);
        const deviceIds = Array.from(document.querySelectorAll('input[name="device-id"]')).map(input => input.value);

        // Validate
        if (passwordInput.value !== confirmPasswordInput.value) {
            errorElement.textContent = 'Passwords do not match';
            errorElement.classList.remove('hidden');
            return;
        }

        if (deviceIds.some(id => !id.trim())) {
            errorElement.textContent = 'All device IDs must be filled';
            errorElement.classList.remove('hidden');
            return;
        }

        const userData = {
            fullName: formData.get('full-name'),
            email: formData.get('email'),
            password: formData.get('password'),
            address: formData.get('address'),
            deviceIds: deviceIds.filter(id => id.trim())
        };

        try {
            const response = await fetch('http://localhost:4000/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Registration failed');
            }

            // Show success message and redirect
            successElement.classList.remove('hidden');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
        } catch (error) {
            console.error('Registration error:', error);
            errorElement.textContent = error.message;
            errorElement.classList.remove('hidden');
        }
    });
});