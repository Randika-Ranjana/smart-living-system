// Shared authentication functions
const API_BASE_URL = 'http://localhost:4000';

export function isAuthenticated() {
    return sessionStorage.getItem('authToken') !== null;
}

export function getAuthToken() {
    return sessionStorage.getItem('authToken');
}

export function logout() {
    sessionStorage.removeItem('authToken');
    sessionStorage.removeItem('userEmail');
    window.location.href = 'login.html';
}

export async function makeAuthenticatedRequest(url, options = {}) {
    if (!isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`,
        ...options.headers
    };

    try {
        const response = await fetch(`${API_BASE_URL}${url}`, {
            ...options,
            headers
        });

        if (response.status === 401) {
            logout();
            return;
        }

        return response;
    } catch (error) {
        console.error('API request failed:', error);
        throw error;
    }
}