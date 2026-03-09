import { db } from './db.js';
import { showToast } from './utils.js';

/**
 * Authentication Helper Functions (Local Storage Version)
 */

export const signUp = async (username, password, fullName, role, rollNumber = null) => {
    try {
        const { data, error } = await db.auth.signUp({
            username,
            password,
            options: {
                data: {
                    full_name: fullName,
                    role: role,
                    roll_number: rollNumber
                }
            }
        });

        if (error) throw error;
        showToast('Account created! You can now login.', 'success');
        return { success: true };
    } catch (error) {
        showToast(error.message, 'danger');
        return { success: false };
    }
};

export const signIn = async (username, password) => {
    try {
        const { data, error } = await db.auth.signInWithPassword({
            username,
            password
        });

        if (error) throw error;
        return { success: true, role: data.user.role };
    } catch (error) {
        showToast(error.message, 'danger');
        return { success: false };
    }
};

export const signOut = async () => {
    try {
        const { error } = await db.auth.signOut();
        if (error) throw error;

        // Determine relative path to root index.html
        const depth = window.location.pathname.split('/').filter(Boolean).length - 1;
        const prefix = depth > 0 ? '../'.repeat(depth) : './';
        window.location.href = prefix + 'index.html';
    } catch (error) {
        showToast(error.message, 'danger');
    }
};

export const getCurrentUser = async () => {
    const { data } = await db.auth.getUser();
    return data.user;
};

export const getProfile = async (userId) => {
    const { data, error } = await db.from('profiles').eq('id', userId).single();
    if (error) return null;
    return data;
};
