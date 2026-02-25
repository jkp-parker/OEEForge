import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi, linesApi, type User, type UserCreate } from "@/lib/api";
import { Plus, Trash2, Pencil } from "lucide-react";

interface UserFormData {
  username: string;
  email: string;
  password: string;
  role: string;
  line_id?: number | null;
}

export default function AdminUsers() {
  const qc = useQueryClient();
  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: () => usersApi.list().then((r) => r.data) });
  const { data: lines = [] } = useQuery({ queryKey: ["lines"], queryFn: () => linesApi.list().then((r) => r.data) });

  const [form, setForm] = useState<UserFormData>({ username: "", email: "", password: "", role: "operator", line_id: null });
  const [editId, setEditId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

  const createMutation = useMutation({
    mutationFn: (data: UserCreate) => usersApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); setShowForm(false); resetForm(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<UserCreate> }) => usersApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); setShowForm(false); resetForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => usersApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  const resetForm = () => {
    setForm({ username: "", email: "", password: "", role: "operator", line_id: null });
    setEditId(null);
  };

  const handleEdit = (user: User) => {
    setForm({ username: user.username, email: user.email, password: "", role: user.role, line_id: user.line_id });
    setEditId(user.id);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editId) {
      const payload: Partial<UserCreate> = { ...form };
      if (!payload.password) delete payload.password;
      updateMutation.mutate({ id: editId, data: payload });
    } else {
      createMutation.mutate(form as UserCreate);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <button className="btn-primary" onClick={() => { setShowForm(!showForm); resetForm(); }}>
          <Plus className="h-4 w-4" /> Add User
        </button>
      </div>

      {showForm && (
        <div className="card">
          <div className="px-6 pt-6 pb-4">
            <h3 className="text-base font-semibold text-gray-900">{editId ? "Edit User" : "New User"}</h3>
          </div>
          <div className="px-6 pb-6">
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Username</label>
                <input className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div>
                <label className="label">{editId ? "New Password (leave blank to keep)" : "Password"}</label>
                <input type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editId} />
              </div>
              <div>
                <label className="label">Role</label>
                <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="admin">Admin</option>
                  <option value="operator">Operator</option>
                </select>
              </div>
              {form.role === "operator" && (
                <div>
                  <label className="label">Assigned Line</label>
                  <select
                    className="input"
                    value={form.line_id ?? ""}
                    onChange={(e) => setForm({ ...form, line_id: e.target.value ? Number(e.target.value) : null })}
                  >
                    <option value="">— None —</option>
                    {lines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
              )}
              <div className="flex gap-2 md:col-span-2">
                <button type="submit" className="btn-primary">{editId ? "Update" : "Create"}</button>
                <button type="button" className="btn-secondary" onClick={() => { setShowForm(false); resetForm(); }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="table-th">Username</th>
                <th className="table-th">Email</th>
                <th className="table-th">Role</th>
                <th className="table-th">Status</th>
                <th className="table-th"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="table-td font-medium">{user.username}</td>
                  <td className="table-td">{user.email}</td>
                  <td className="table-td">
                    <span className={user.role === "admin" ? "badge-blue" : "badge-gray"}>{user.role}</span>
                  </td>
                  <td className="table-td">
                    <span className={user.is_active ? "badge-green" : "badge-red"}>
                      {user.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="table-td text-right">
                    <button className="btn-ghost p-1.5" onClick={() => handleEdit(user)}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button className="btn-ghost p-1.5" onClick={() => deleteMutation.mutate(user.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
