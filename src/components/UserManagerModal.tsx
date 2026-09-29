import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Search, Key, Shield, Trash2, CheckCircle, XCircle, Lock, X, RefreshCw, Sparkles, AlertCircle } from 'lucide-react';
import { UserAccount, UserListResponse } from '../types';

interface UserManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount | null;
}

export const UserManagerModal: React.FC<UserManagerModalProps> = ({ isOpen, onClose, currentUser }) => {
  const [userList, setUserList] = useState<UserAccount[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const maxLimit = 100;
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Add User Form State
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [newUsername, setNewUsername] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [newFullName, setNewFullName] = useState<string>('');
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user');
  const [formError, setFormError] = useState<string>('');
  const [formSuccess, setFormSuccess] = useState<string>('');

  // Edit Password Modal State
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editPasswordInput, setEditPasswordInput] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/users');
      const text = await res.text();
      let data: UserListResponse = { success: false, users: [], total: 0, maxLimit: 100 };
      try { data = JSON.parse(text); } catch {}
      if (res.ok) {
        setUserList(data.users || []);
        setTotalCount(data.total || 0);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || currentUser?.role !== 'admin') return null;

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!newUsername.trim() || !newPassword.trim()) {
      setFormError('Username and password are required.');
      return;
    }

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword.trim(),
          fullName: newFullName.trim() || newUsername.trim(),
          role: newRole
        })
      });

      const text = await res.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch {}
      if (res.ok && data.success) {
        setFormSuccess(`User "${data.user.username}" added successfully!`);
        setNewUsername('');
        setNewPassword('');
        setNewFullName('');
        setShowAddForm(false);
        fetchUsers();
      } else {
        setFormError(data.error || 'Failed to add user.');
      }
    } catch (err) {
      setFormError('Network error while adding user.');
    }
  };

  const handleToggleStatus = async (user: UserAccount) => {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        fetchUsers();
      }
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  const handleUpdatePassword = async (userId: string) => {
    if (!editPasswordInput.trim()) return;
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: editPasswordInput.trim() })
      });
      if (res.ok) {
        setEditingUserId(null);
        setEditPasswordInput('');
        fetchUsers();
      }
    } catch (err) {
      console.error('Failed to update password', err);
    }
  };

  const handleDeleteUser = async (user: UserAccount) => {
    if (user.username === 'admin') {
      alert('Primary admin account cannot be deleted.');
      return;
    }

    if (!confirm(`Are you sure you want to delete user "${user.username}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchUsers();
      }
    } catch (err) {
      console.error('Failed to delete user', err);
    }
  };

  const handleSeedSamples = async () => {
    try {
      const res = await fetch('/api/users/seed-samples', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 10 })
      });
      if (res.ok) {
        fetchUsers();
      }
    } catch (err) {
      console.error('Seed error', err);
    }
  };

  const filteredUsers = userList.filter(u =>
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full p-6 shadow-2xl relative text-slate-100 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                User Account Management
                <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {totalCount} / {maxLimit} Users
                </span>
              </h3>
              <p className="text-xs text-slate-400">Add user names, set passwords, and manage access rights (Up to 100 Users)</p>
            </div>
          </div>

          <button
            onClick={onClose}
            type="button"
            title="Close Modal"
            aria-label="Close modal"
            className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white border border-slate-700 hover:border-rose-500 shadow-md transition-all flex items-center gap-1.5 font-bold text-xs shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
            <span className="hidden sm:inline">Close</span>
          </button>
        </div>

        {/* Capacity Progress Bar */}
        <div className="py-3">
          <div className="flex justify-between items-center text-xs text-slate-400 mb-1">
            <span>User Capacity Limit</span>
            <span className="font-mono font-medium text-slate-200">{totalCount} registered out of {maxLimit} max slots</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                totalCount >= 90 ? 'bg-rose-500' : totalCount >= 50 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, (totalCount / maxLimit) * 100)}%` }}
            />
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 my-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search user name or username..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-xl flex items-center space-x-1.5 shadow-sm transition-all"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{showAddForm ? 'Cancel Add' : 'Add New User'}</span>
            </button>

            <button
              onClick={handleSeedSamples}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-xs rounded-xl flex items-center space-x-1.5 border border-slate-700 transition-all"
              title="Add 10 sample user slots for testing capacity"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Seed +10 Users</span>
            </button>

            <button
              onClick={fetchUsers}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl border border-slate-700"
              title="Refresh User List"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Add User Form Drawer */}
        {showAddForm && (
          <form onSubmit={handleAddUser} className="bg-slate-800/90 border border-emerald-500/30 rounded-xl p-4 mb-4 space-y-3 animate-in fade-in zoom-in-95 duration-150">
            <div className="text-xs font-bold text-emerald-400 flex items-center space-x-1.5">
              <UserPlus className="w-4 h-4" />
              <span>Create New User Account (Capacity: {totalCount + 1}/100)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Username</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="e.g. johndoe"
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Password</label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Set Password"
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as 'user' | 'admin')}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="user">User (Trader View)</option>
                  <option value="admin">Admin (Full Access)</option>
                </select>
              </div>
            </div>

            {formError && (
              <div className="text-xs text-rose-400 bg-rose-950/30 px-3 py-1.5 rounded border border-rose-800/40">
                {formError}
              </div>
            )}

            {formSuccess && (
              <div className="text-xs text-emerald-400 bg-emerald-950/30 px-3 py-1.5 rounded border border-emerald-800/40">
                {formSuccess}
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg shadow"
              >
                Save Account
              </button>
            </div>
          </form>
        )}

        {/* User Table List */}
        <div className="flex-1 overflow-y-auto border border-slate-800 rounded-xl bg-slate-950/50">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/80 text-slate-400 uppercase text-[10px] tracking-wider sticky top-0 z-10 border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">User / Name</th>
                <th className="px-4 py-3">Password</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No matching user accounts found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-800/40 transition-colors">
                    
                    {/* Username & Full Name */}
                    <td className="px-4 py-3">
                      <div className="font-semibold text-white">{user.fullName}</div>
                      <div className="text-[11px] font-mono text-emerald-400">@{user.username}</div>
                    </td>

                    {/* Password View & Edit */}
                    <td className="px-4 py-3">
                      {editingUserId === user.id ? (
                        <div className="flex items-center space-x-1">
                          <input
                            type="text"
                            value={editPasswordInput}
                            onChange={(e) => setEditPasswordInput(e.target.value)}
                            placeholder="New Pass"
                            className="w-24 px-2 py-1 bg-slate-900 border border-emerald-500 rounded text-xs font-mono text-white"
                            autoFocus
                          />
                          <button
                            onClick={() => handleUpdatePassword(user.id)}
                            className="p-1 bg-emerald-600 text-white rounded text-[10px]"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingUserId(null)}
                            className="p-1 bg-slate-800 text-slate-400 rounded text-[10px]"
                          >
                            X
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded text-[11px]">
                            {user.passwordHash}
                          </span>
                          <button
                            onClick={() => {
                              setEditingUserId(user.id);
                              setEditPasswordInput(user.passwordHash);
                            }}
                            className="text-slate-500 hover:text-amber-400 transition-colors"
                            title="Edit Password"
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Role Badge */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${
                        user.role === 'admin'
                          ? 'bg-amber-950/60 text-amber-400 border-amber-800/60'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}>
                        {user.role === 'admin' && <Shield className="w-3 h-3 mr-1 text-amber-400" />}
                        {user.role.toUpperCase()}
                      </span>
                    </td>

                    {/* Status Toggle */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleStatus(user)}
                        className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-semibold border transition-all ${
                          user.status === 'active'
                            ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60 hover:bg-emerald-900/60'
                            : 'bg-rose-950/60 text-rose-400 border-rose-800/60 hover:bg-rose-900/60'
                        }`}
                        title="Click to toggle account status"
                      >
                        {user.status === 'active' ? (
                          <>
                            <CheckCircle className="w-3 h-3" />
                            <span>ACTIVE</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3" />
                            <span>SUSPENDED</span>
                          </>
                        )}
                      </button>
                    </td>

                    {/* Created Date */}
                    <td className="px-4 py-3 text-slate-400 font-mono text-[11px]">
                      {user.createdAt}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right space-x-2">
                      {user.username !== 'admin' && (
                        <button
                          onClick={() => handleDeleteUser(user)}
                          className="p-1 text-slate-500 hover:text-rose-400 transition-colors rounded hover:bg-slate-800"
                          title="Delete Account"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="pt-4 mt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Logged in as Admin: <strong className="text-white">{currentUser?.fullName || 'System Admin'}</strong></span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl transition-colors"
          >
            Close User Manager
          </button>
        </div>

      </div>
    </div>
  );
};
