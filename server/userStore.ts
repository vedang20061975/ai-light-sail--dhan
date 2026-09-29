import fs from 'fs';
import path from 'path';
import { UserAccount } from '../src/types.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Pre-seeded initial users (Admin + Sample Users)
const DEFAULT_USERS: UserAccount[] = [
  {
    id: 'user-admin-1',
    username: 'admin',
    passwordHash: 'admin123',
    fullName: 'System Admin',
    role: 'admin',
    status: 'active',
    createdAt: new Date().toLocaleDateString('en-US'),
    lastLogin: new Date().toLocaleString('en-US')
  },
  {
    id: 'user-trader-1',
    username: 'trader1',
    passwordHash: 'trader123',
    fullName: 'Bharat Parmar',
    role: 'user',
    status: 'active',
    createdAt: new Date().toLocaleDateString('en-US')
  },
  {
    id: 'user-trader-2',
    username: 'trader2',
    passwordHash: 'trader123',
    fullName: 'VIP Client 02',
    role: 'user',
    status: 'active',
    createdAt: new Date().toLocaleDateString('en-US')
  }
];

class UserStoreManager {
  private users: UserAccount[] = [];

  constructor() {
    this.init();
  }

  private init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(USERS_FILE)) {
        const fileContent = fs.readFileSync(USERS_FILE, 'utf-8');
        this.users = JSON.parse(fileContent);
      } else {
        this.users = [...DEFAULT_USERS];
        this.saveToFile();
      }
    } catch (err) {
      console.error('Error initializing userStore:', err);
      this.users = [...DEFAULT_USERS];
    }
  }

  private saveToFile() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(USERS_FILE, JSON.stringify(this.users, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving users file:', err);
    }
  }

  public getUsers(): UserAccount[] {
    return this.users;
  }

  public getUserById(id: string): UserAccount | undefined {
    return this.users.find(u => u.id === id);
  }

  public getUserByUsername(username: string): UserAccount | undefined {
    return this.users.find(u => u.username.toLowerCase() === username.toLowerCase().trim());
  }

  public authenticate(username: string, password: string): UserAccount | null {
    const user = this.getUserByUsername(username);
    if (!user) return null;
    if (user.status !== 'active') return null;
    
    // Check password (simple comparison for admin dashboard management)
    if (user.passwordHash === password.trim()) {
      user.lastLogin = new Date().toLocaleString('en-US');
      this.saveToFile();
      return user;
    }

    return null;
  }

  public addUser(userData: { username: string; password: string; fullName: string; role: 'admin' | 'user' }): { success: boolean; user?: UserAccount; error?: string } {
    if (this.users.length >= 100) {
      return { success: false, error: 'Maximum limit of 100 users reached. Please upgrade or remove inactive users.' };
    }

    const cleanUsername = userData.username.trim().toLowerCase();
    if (!cleanUsername || cleanUsername.length < 3) {
      return { success: false, error: 'Username must be at least 3 characters long.' };
    }

    if (!userData.password || userData.password.trim().length < 4) {
      return { success: false, error: 'Password must be at least 4 characters long.' };
    }

    if (this.getUserByUsername(cleanUsername)) {
      return { success: false, error: `Username "${cleanUsername}" already exists.` };
    }

    const newUser: UserAccount = {
      id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      username: cleanUsername,
      passwordHash: userData.password.trim(),
      fullName: userData.fullName.trim() || cleanUsername,
      role: userData.role || 'user',
      status: 'active',
      createdAt: new Date().toLocaleDateString('en-US')
    };

    this.users.push(newUser);
    this.saveToFile();
    return { success: true, user: newUser };
  }

  public updateUser(id: string, updates: Partial<{ username: string; password: string; fullName: string; role: 'admin' | 'user'; status: 'active' | 'inactive' }>): { success: boolean; user?: UserAccount; error?: string } {
    const user = this.getUserById(id);
    if (!user) {
      return { success: false, error: 'User not found.' };
    }

    if (updates.username) {
      const newUsername = updates.username.trim().toLowerCase();
      const existing = this.getUserByUsername(newUsername);
      if (existing && existing.id !== id) {
        return { success: false, error: `Username "${newUsername}" is already taken.` };
      }
      user.username = newUsername;
    }

    if (updates.password !== undefined && updates.password.trim() !== '') {
      user.passwordHash = updates.password.trim();
    }

    if (updates.fullName !== undefined) {
      user.fullName = updates.fullName.trim();
    }

    if (updates.role !== undefined) {
      user.role = updates.role;
    }

    if (updates.status !== undefined) {
      if (user.username === 'admin' && updates.status === 'inactive') {
        return { success: false, error: 'Primary admin account cannot be deactivated.' };
      }
      user.status = updates.status;
    }

    this.saveToFile();
    return { success: true, user };
  }

  public deleteUser(id: string): { success: boolean; error?: string } {
    const user = this.getUserById(id);
    if (!user) {
      return { success: false, error: 'User not found.' };
    }

    if (user.username === 'admin') {
      return { success: false, error: 'Primary admin user cannot be deleted.' };
    }

    this.users = this.users.filter(u => u.id !== id);
    this.saveToFile();
    return { success: true };
  }

  public bulkCreateSampleUsers(count: number): number {
    let added = 0;
    for (let i = 1; i <= count; i++) {
      if (this.users.length >= 100) break;
      const uname = `user${this.users.length + 1}`;
      if (!this.getUserByUsername(uname)) {
        this.addUser({
          username: uname,
          password: 'user123',
          fullName: `Subscriber ${this.users.length + 1}`,
          role: 'user'
        });
        added++;
      }
    }
    return added;
  }
}

export const userStore = new UserStoreManager();
