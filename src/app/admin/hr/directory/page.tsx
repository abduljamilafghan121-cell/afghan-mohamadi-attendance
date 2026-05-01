"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../../../components/AppShell";
import { Input } from "../../../../components/ui/Input";
import { apiFetch } from "../../../../lib/clientApi";
import { getToken, parseJwt } from "../../../../lib/clientAuth";

type Employee = {
  id: string; name: string; email: string | null; phone: string | null;
  department: string | null; jobTitle: string | null; role: string;
  isActive: boolean; photoUrl: string | null; managerId: string | null;
};

export default function DirectoryPage() {
  const router = useRouter();
  const token = typeof window !== "undefined" ? getToken() : null;
  const jwtUser = useMemo(() => (token ? parseJwt(token) : null), [token]);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) router.push("/login");
    if (jwtUser && jwtUser.role !== "admin") router.push("/employee");
  }, [token, jwtUser, router]);

  useEffect(() => {
    if (!token) return;
    apiFetch<{ users: Employee[] }>("/api/admin/users?pageSize=500")
      .then((r) => setEmployees(r.users))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [token]);

  const departments = useMemo(() =>
    Array.from(new Set(employees.map((e) => e.department).filter(Boolean))).sort() as string[],
    [employees]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((e) => {
      if (!e.isActive) return false;
      if (filterDept && e.department !== filterDept) return false;
      if (filterRole && e.role !== filterRole) return false;
      if (q) return (
        e.name.toLowerCase().includes(q) ||
        (e.email ?? "").toLowerCase().includes(q) ||
        (e.department ?? "").toLowerCase().includes(q) ||
        (e.jobTitle ?? "").toLowerCase().includes(q)
      );
      return true;
    });
  }, [employees, search, filterDept, filterRole]);

  const grouped = useMemo(() => {
    const map = new Map<string, Employee[]>();
    for (const e of filtered) {
      const dept = e.department ?? "No Department";
      if (!map.has(dept)) map.set(dept, []);
      map.get(dept)!.push(e);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const initials = (name: string) => name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  const roleColor: Record<string, string> = {
    admin: "bg-purple-50 text-purple-700",
    manager: "bg-blue-50 text-blue-700",
    employee: "bg-zinc-100 text-zinc-600",
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Employee Directory</h1>
          <p className="text-sm text-zinc-500">{filtered.length} active employee{filtered.length !== 1 ? "s" : ""}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Input className="max-w-xs" placeholder="Search name, email, title..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm">
            <option value="">All Departments</option>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm">
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="employee">Employee</option>
          </select>
        </div>

        {loading && <div className="rounded-xl bg-zinc-50 p-6 text-center text-sm text-zinc-400">Loading directory...</div>}

        {!loading && grouped.length === 0 && (
          <div className="rounded-xl bg-zinc-50 p-8 text-center text-zinc-400">No employees found.</div>
        )}

        {grouped.map(([dept, emps]) => (
          <div key={dept}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">{dept} ({emps.length})</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {emps.map((e) => (
                <div key={e.id} onClick={() => router.push(`/admin/hr/employees/${e.id}`)} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-start gap-3">
                    {e.photoUrl ? (
                      <img src={e.photoUrl} alt={e.name} className="h-12 w-12 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-zinc-900 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                        {initials(e.name)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-zinc-900 truncate">{e.name}</span>
                        <span className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${roleColor[e.role] ?? "bg-zinc-100 text-zinc-600"}`}>
                          {e.role}
                        </span>
                      </div>
                      {e.jobTitle && <div className="text-xs text-zinc-500 mt-0.5">{e.jobTitle}</div>}
                      {e.email && (
                        <a href={`mailto:${e.email}`} className="mt-1 block text-xs text-blue-600 hover:underline truncate">{e.email}</a>
                      )}
                      {e.phone && <div className="mt-0.5 text-xs text-zinc-500">{e.phone}</div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
