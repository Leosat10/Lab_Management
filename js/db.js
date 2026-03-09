import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { hashPassword } from './utils.js';

/**
 * Cloud-Ready Database Engine
 * Uses Supabase if configured, otherwise falls back to LocalStorage
 */

const DB_KEY = 'lab_system_db';

// Supabase Configuration from environment variables
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let supabase = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Initial Seed Data (Used for LocalStorage only)
const DEFAULT_DATA = {
    profiles: [
        {
            id: 'admin-root',
            full_name: 'System Admin',
            username: 'AdminCSE',
            password: '56cfb66b39123ebfa6c2b2da8d17fce8f7ec9e5c23e5847bb976cdf4b0e2b0b7', // Hashed CSE@admin
            role: 'admin',
            created_at: new Date().toISOString()
        }
    ],
    labs: [],
    systems: [],
    complaints: [],
    activity_log: []
};

class Database {
    constructor() {
        this.isCloud = !!supabase;
        this.data = this.isCloud ? {} : this._loadLocal();
        this.currentUser = JSON.parse(localStorage.getItem('lab_system_user')) || null;
    }

    _loadLocal() {
        const stored = localStorage.getItem(DB_KEY);
        let data;

        try {
            data = stored ? JSON.parse(stored) : JSON.parse(JSON.stringify(DEFAULT_DATA));

            // Migration: Ensure root admin exists and has hashed password
            let rootAdmin = data.profiles.find(p => p.username === 'AdminCSE');

            if (!rootAdmin || rootAdmin.password !== '56cfb66b39123ebfa6c2b2da8d17fce8f7ec9e5c23e5847bb976cdf4b0e2b0b7') {
                console.log("Migrating AdminCSE to new hashed password...");
                // Remove any existing incorrect root admin and re-inject from DEFAULT_DATA
                data.profiles = data.profiles.filter(p => p.username !== 'AdminCSE');
                data.profiles.push({ ...DEFAULT_DATA.profiles[0] });

                // Force logout to clear any stale plain-text session
                localStorage.removeItem('lab_system_user');
            }
        } catch (e) {
            console.error("Failed to load local storage, resetting...", e);
            data = JSON.parse(JSON.stringify(DEFAULT_DATA));
        }

        localStorage.setItem(DB_KEY, JSON.stringify(data));
        return data;
    }

    _saveLocal() {
        if (!this.isCloud) {
            localStorage.setItem(DB_KEY, JSON.stringify(this.data));
        }
    }

    _uuid() {
        return Math.random().toString(36).substr(2, 9);
    }

    from(table) {
        if (this.isCloud) {
            return supabase.from(table);
        }

        const self = this;
        let queryData = [...(this.data[table] || [])];
        let pendingUpdate = null;
        let isDelete = false;

        const builder = {
            select: (columns = '*') => builder,
            insert: async (payload) => {
                const rows = Array.isArray(payload) ? payload : [payload];
                const newRows = rows.map(row => ({
                    id: self._uuid(),
                    created_at: new Date().toISOString(),
                    ...row
                }));
                self.data[table].push(...newRows);
                self._saveLocal();
                return { data: Array.isArray(payload) ? newRows : newRows[0], error: null };
            },
            update: (payload) => {
                pendingUpdate = payload;
                return builder;
            },
            delete: () => {
                isDelete = true;
                return builder;
            },
            eq: (col, val) => {
                queryData = queryData.filter(item => item[col] === val);
                return builder;
            },
            neq: (col, val) => {
                queryData = queryData.filter(item => item[col] !== val);
                return builder;
            },
            in: (col, vals) => {
                queryData = queryData.filter(item => vals.includes(item[col]));
                return builder;
            },
            order: (col, { ascending } = { ascending: true }) => {
                queryData.sort((a, b) => {
                    if (a[col] < b[col]) return ascending ? -1 : 1;
                    if (a[col] > b[col]) return ascending ? 1 : -1;
                    return 0;
                });
                return builder;
            },
            limit: (n) => {
                queryData = queryData.slice(0, n);
                return builder;
            },
            single: async () => {
                if (pendingUpdate || isDelete) {
                    const result = await builder;
                    return { data: result.data[0] || null, error: result.error };
                }
                return { data: queryData[0] || null, error: queryData[0] ? null : { message: 'Not found' } };
            },
            then: (resolve) => {
                const execute = async () => {
                    if (pendingUpdate) {
                        const affectedIds = queryData.map(r => r.id);
                        self.data[table] = self.data[table].map(row => {
                            if (affectedIds.includes(row.id)) {
                                return { ...row, ...pendingUpdate, updated_at: new Date().toISOString() };
                            }
                            return row;
                        });
                        self._saveLocal();
                    } else if (isDelete) {
                        const affectedIds = queryData.map(r => r.id);
                        self.data[table] = self.data[table].filter(row => !affectedIds.includes(row.id));
                        self._saveLocal();
                    }

                    // Enriched data simulation for local join-like behavior
                    const enrichedData = queryData.map(item => {
                        const enriched = { ...item };
                        if (table === 'complaints') {
                            const system = self.data.systems.find(s => s.id === item.system_id);
                            if (system) {
                                enriched.systems = { ...system };
                                const lab = self.data.labs.find(l => l.id === system.lab_id);
                                if (lab) enriched.systems.labs = { ...lab };
                            }
                            const student = self.data.profiles.find(p => p.id === item.student_id);
                            if (student) enriched.profiles = student;
                        }
                        return enriched;
                    });

                    return { data: enrichedData, error: null, count: enrichedData.length };
                };
                execute().then(resolve);
            }
        };

        return builder;
    }

    auth = {
        signUp: async ({ username, password, options }) => {
            if (this.isCloud) {
                // In Supabase, we'll use username@lbm.local as a mock email
                const email = `${username}@lbm.local`;
                return supabase.auth.signUp({ email, password, options: { ...options, data: { ...options.data, username } } });
            }

            const existing = this.data.profiles.find(p => p.username === username);
            if (existing) return { data: null, error: { message: 'Username already exists' } };

            const id = this._uuid();
            const hashedPassword = await hashPassword(password);
            const profile = {
                id,
                username,
                password: hashedPassword,
                full_name: options.data.full_name,
                role: options.data.role,
                roll_number: options.data.roll_number,
                created_at: new Date().toISOString()
            };

            this.data.profiles.push(profile);
            this._saveLocal();
            return { data: { user: { id, username } }, error: null };
        },
        signInWithPassword: async ({ username, password }) => {
            if (this.isCloud) {
                const email = `${username}@lbm.local`;
                const res = await supabase.auth.signInWithPassword({ email, password });
                if (res.data?.user) {
                    const { data: profile } = await supabase.from('profiles').select('*').eq('id', res.data.user.id).single();
                    this.currentUser = profile;
                    localStorage.setItem('lab_system_user', JSON.stringify(profile));
                    return res;
                }
                // Supabase user doesn't exist yet — fall back to local profiles (e.g. built-in AdminCSE)
                const localData = this._loadLocal();
                const hashedPassword = await hashPassword(password);
                const profile = localData.profiles.find(p => p.username === username && p.password === hashedPassword);
                if (profile) {
                    this.currentUser = profile;
                    localStorage.setItem('lab_system_user', JSON.stringify(profile));
                    return { data: { user: profile }, error: null };
                }
                // Return the original Supabase error
                return res;
            }

            const hashedPassword = await hashPassword(password);
            console.log(`Login attempt for ${username}. Input hash: ${hashedPassword}`);
            const profile = this.data.profiles.find(p => p.username === username && p.password === hashedPassword);

            if (!profile) {
                console.error(`Login failed for ${username}. Hash mismatch.`);
                return { data: null, error: { message: 'Invalid username or password' } };
            }

            console.log(`Login successful for ${username}`);
            this.currentUser = profile;
            localStorage.setItem('lab_system_user', JSON.stringify(profile));
            return { data: { user: profile }, error: null };
        },
        signOut: async () => {
            if (this.isCloud) await supabase.auth.signOut();
            this.currentUser = null;
            localStorage.removeItem('lab_system_user');
            return { error: null };
        },
        getUser: async () => {
            if (this.isCloud) {
                const supaRes = await supabase.auth.getUser();
                // If Supabase has a real session, use it
                if (supaRes.data?.user) return supaRes;
                // Otherwise fall back to the locally-stored profile (e.g. AdminCSE fallback login)
                const stored = JSON.parse(localStorage.getItem('lab_system_user')) || null;
                return { data: { user: stored }, error: null };
            }
            return { data: { user: this.currentUser }, error: null };
        }
    };

    exportJSON() {
        const blob = new Blob([JSON.stringify(this.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lab_system_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
    }

    importJSON(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const imported = JSON.parse(e.target.result);
                    if (imported.profiles && imported.labs) {
                        this.data = imported;
                        this._saveLocal();
                        resolve(true);
                    } else reject('Invalid backup file');
                } catch (err) { reject('Failed to parse file'); }
            };
            reader.readAsText(file);
        });
    }
}

export const db = new Database();
