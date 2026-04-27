import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Copy, Loader2, Plus, Shield, Stethoscope, Trash2, UserRound } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';

export default function Admin() {
  const { authHeaders, currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('PATIENT');
  const [createdUser, setCreatedUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState('');
  const [error, setError] = useState('');

  const patients = useMemo(() => users.filter((user) => user.role === 'PATIENT'), [users]);
  const doctors = useMemo(() => users.filter((user) => user.role === 'DOCTOR'), [users]);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/admin/users`, {
        headers: authHeaders,
      });
      setUsers(response.data);
    } catch {
      setError('Unable to load users.');
    } finally {
      setIsLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreate = async (event) => {
    event.preventDefault();
    setError('');
    setCreatedUser(null);
    setIsCreating(true);

    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/admin/users`,
        { id, name, role },
        { headers: authHeaders },
      );
      setCreatedUser(response.data);
      setId('');
      setName('');
      setRole('PATIENT');
      await fetchUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to create user.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (user) => {
    const confirmed = window.confirm(
      `Delete ${user.name}?${user.role === 'PATIENT' ? ' This will also delete their logs.' : ''}`,
    );
    if (!confirmed) return;

    setError('');
    setCreatedUser(null);
    setDeletingUserId(user.id);

    try {
      await axios.delete(`${API_BASE_URL}/api/admin/users/${user.id}`, {
        headers: authHeaders,
      });
      setUsers((previousUsers) => previousUsers.filter((item) => item.id !== user.id));
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to delete user.');
    } finally {
      setDeletingUserId('');
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-3 sm:p-6 animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
        <section className="bg-white/90 border border-white/70 shadow-sm rounded-[2rem] p-5 sm:p-7">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-gray-500 mt-1">Manage MindBridge doctors and patients.</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Shield className="w-6 h-6" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="rounded-3xl border border-teal-100 bg-teal-50/50 p-5">
              <p className="text-sm font-semibold text-teal-700">Patients</p>
              <p className="text-4xl font-extrabold text-teal-800 mt-2">{patients.length}</p>
            </div>
            <div className="rounded-3xl border border-blue-100 bg-blue-50/50 p-5">
              <p className="text-sm font-semibold text-blue-700">Doctors</p>
              <p className="text-4xl font-extrabold text-blue-800 mt-2">{doctors.length}</p>
            </div>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-gray-400 font-medium">Loading users...</div>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Name</th>
                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Role</th>
                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">ID</th>
                    <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wider text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((user) => {
                    const canDelete = user.role !== 'ADMIN' && user.id !== currentUser?.id;
                    return (
                      <tr key={user.id} className="hover:bg-gray-50/80">
                        <td className="px-5 py-4 font-semibold text-gray-800">{user.name}</td>
                        <td className="px-5 py-4">
                          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-600">
                            {user.role}
                          </span>
                        </td>
                        <td className="px-5 py-4 font-mono text-xs text-gray-500">{user.id}</td>
                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={() => handleDelete(user)}
                            disabled={!canDelete || deletingUserId === user.id}
                            className="inline-flex items-center gap-1.5 rounded-full border border-red-100 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            {deletingUserId === user.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="bg-white/90 border border-white/70 shadow-sm rounded-[2rem] p-5 sm:p-7 h-fit">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Create User</h2>
          <p className="text-sm text-gray-500 mb-6">Assign a simple 10-number ID for a patient or doctor.</p>

          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">10-number ID</label>
              <input
                value={id}
                onChange={(event) => setId(event.target.value.replace(/\D/g, '').slice(0, 10))}
                inputMode="numeric"
                pattern="\d{10}"
                maxLength={10}
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 font-mono outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                placeholder="1234567890"
              />
              <p className="mt-1 text-xs text-gray-400">The ID must be exactly 10 numbers and unique.</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Name</label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                placeholder="Full name"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Role</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'PATIENT', icon: UserRound, label: 'Patient' },
                  { value: 'DOCTOR', icon: Stethoscope, label: 'Doctor' },
                ].map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      type="button"
                      key={option.value}
                      onClick={() => setRole(option.value)}
                      className={`rounded-2xl border p-4 font-semibold transition-all flex flex-col items-center gap-2 ${
                        role === option.value
                          ? 'border-teal-300 bg-teal-50 text-teal-800'
                          : 'border-gray-100 bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {error && <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}

            <button
              type="submit"
              disabled={isCreating || !name.trim() || id.length !== 10}
              className="w-full rounded-2xl bg-[#1ed760] px-5 py-3 font-semibold text-white hover:bg-[#1db954] disabled:bg-gray-300 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
              Create User
            </button>
          </form>

          {createdUser && (
            <div className="mt-6 rounded-3xl border border-green-100 bg-green-50 p-4">
              <p className="text-sm font-bold text-green-800">User Created</p>
              <div className="mt-2 flex items-center gap-2 rounded-2xl bg-white p-3">
                <code className="flex-1 text-xs text-gray-700 break-all">{createdUser.id}</code>
                <button
                  onClick={() => navigator.clipboard?.writeText(createdUser.id)}
                  className="rounded-xl bg-gray-100 p-2 text-gray-600 hover:bg-gray-200"
                  aria-label="Copy generated ID"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <p className="mt-2 text-xs text-green-700">Give this ID to {createdUser.name} for login.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
