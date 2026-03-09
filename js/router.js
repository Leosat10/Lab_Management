import { db } from './db.js';

/**
 * Role-Based Access Control (Local Storage Version)
 */
export async function checkAuth(requiredRole = null) {
    const { data: { user } } = await db.auth.getUser();

    if (!user) {
        // Redirect to login if not authenticated
        const depth = window.location.pathname.split('/').filter(Boolean).length - 1;
        const prefix = depth > 0 ? '../'.repeat(depth) : './';
        window.location.href = prefix + 'index.html';
        return null;
    }

    // Role check
    if (requiredRole && user.role !== requiredRole) {
        // Redirection based on actual role
        if (user.role === 'admin') window.location.href = '../admin/dashboard.html';
        else if (user.role === 'committee') window.location.href = '../committee/dashboard.html';
        else window.location.href = '../student/dashboard.html';
        return null;
    }

    return user;
}
