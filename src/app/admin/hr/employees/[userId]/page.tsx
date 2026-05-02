"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { AppShell } from "../../../../../components/AppShell";
import { Card } from "../../../../../components/ui/Card";
import { Button } from "../../../../../components/ui/Button";
import { apiFetch } from "../../../../../lib/clientApi";
import { getToken, parseJwt } from "../../../../../lib/clientAuth";
import { exportHtmlReport } from "../../../../../lib/exportUtils";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const CONTRACT_LABELS: Record<string, string> = {
  full_time: "Full-Time", part_time: "Part-Time", contract: "Contract", intern: "Intern",
};
const CONTRACT_COLORS: Record<string, string> = {
  full_time: "bg-emerald-50 text-emerald-700",
  part_time: "bg-blue-50 text-blue-700",
  contract: "bg-amber-50 text-amber-700",
  intern: "bg-purple-50 text-purple-700",
};
const RATING_LABELS: Record<string, string> = {
  outstanding: "Outstanding",
  exceeds_expectations: "Exceeds Expectations",
  meets_expectations: "Meets Expectations",
  needs_improvement: "Needs Improvement",
  unsatisfactory: "Unsatisfactory",
};
const RATING_COLORS: Record<string, string> = {
  outstanding: "bg-emerald-50 text-emerald-700",
  exceeds_expectations: "bg-blue-50 text-blue-700",
  meets_expectations: "bg-zinc-100 text-zinc-700",
  needs_improvement: "bg-amber-50 text-amber-700",
  unsatisfactory: "bg-red-50 text-red-700",
};
const TRAINING_COLORS: Record<string, string> = {
  planned: "bg-zinc-100 text-zinc-600",
  in_progress: "bg-blue-50 text-blue-700",
  completed: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-red-50 text-red-600",
};
const DISC_LABELS: Record<string, string> = {
  verbal_warning: "Verbal Warning",
  written_warning: "Written Warning",
  final_warning: "Final Warning",
  suspension: "Suspension",
  termination: "Termination",
};
const DISC_COLORS: Record<string, string> = {
  verbal_warning: "bg-amber-50 text-amber-700",
  written_warning: "bg-orange-50 text-orange-700",
  final_warning: "bg-red-50 text-red-700",
  suspension: "bg-red-100 text-red-800",
  termination: "bg-red-200 text-red-900",
};

type Employee = {
  id: string; name: string; email: string | null; phone: string | null; role: string;
  department: string | null; jobTitle: string | null; employeeId: string | null;
  address: string | null; photoUrl: string | null; isActive: boolean;
  createdAt: string; manager: { id: string; name: string } | null;
};
type Contract = {
  id: string; contractType: string; startDate: string; endDate: string | null;
  probationEndDate: string | null; jobTitle: string | null; department: string | null;
  salary: number | null; currency: string; payFrequency: string; notes: string | null;
  isActive: boolean; createdAt: string;
};
type SalaryRecord = {
  id: string; month: number; year: number; baseSalary: number; allowances: number;
  deductions: number; netSalary: number; currency: string; paidAt: string | null;
  createdBy: { id: string; name: string } | null;
};
type OrgInfo = { title: string; logoUrl: string | null };
type Review = {
  id: string; reviewPeriod: string; rating: string; goals: string | null;
  achievements: string | null; improvements: string | null; comments: string | null;
  reviewDate: string; reviewer: { id: string; name: string };
};
type Training = {
  id: string; title: string; provider: string | null; startDate: string;
  endDate: string | null; status: string; certificate: string | null; notes: string | null;
};
type Disciplinary = {
  id: string; type: string; date: string; reason: string; description: string | null;
  actionTaken: string | null; issuedBy: { id: string; name: string } | null;
};
type EmergencyContact = {
  id: string; name: string; relationship: string; phone: string; phone2: string | null; notes: string | null;
};
type ProfileData = {
  user: Employee;
  contracts: Contract[];
  salaryRecords: SalaryRecord[];
  performanceReviews: Review[];
  trainingRecords: Training[];
  disciplinaryRecords: Disciplinary[];
  emergencyContacts: EmergencyContact[];
};

const TABS = ["Overview", "Contracts", "Salary", "Performance", "Training", "Disciplinary", "Emergency Contacts"] as const;
type Tab = typeof TABS[number];

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-3 py-2 border-b border-zinc-100 last:border-0">
      <span className="text-xs font-medium text-zinc-500 sm:w-36 shrink-0">{label}</span>
      <span className="text-sm text-zinc-900">{value}</span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="py-10 text-center text-sm text-zinc-400">{text}</div>;
}

export default function EmployeeHRProfile() {
  const router = useRouter();
  const params = useParams();
  const userId = params.userId as string;

  const token = typeof window !== "undefined" ? getToken() : null;
  const jwtUser = useMemo(() => (token ? parseJwt(token) : null), [token]);

  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [org, setOrg] = useState<OrgInfo | null>(null);

  const [ecModalOpen, setEcModalOpen] = useState(false);
  const [ecEditTarget, setEcEditTarget] = useState<EmergencyContact | null>(null);
  const [ecForm, setEcForm] = useState({ name: "", relationship: "", phone: "", phone2: "", notes: "" });
  const [ecSaving, setEcSaving] = useState(false);
  const [ecDeleting, setEcDeleting] = useState<string | null>(null);
  const [ecError, setEcError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) router.push("/login");
    if (jwtUser && jwtUser.role !== "admin") router.push("/employee");
  }, [token, jwtUser, router]);

  useEffect(() => {
    fetch("/api/org").then((r) => r.json()).then((d) => { if (d.org) setOrg(d.org); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!token || !userId) return;
    setLoading(true);
    apiFetch<ProfileData>(`/api/admin/hr/employees/${userId}`)
      .then(setData)
      .catch((e: any) => setError(e?.message ?? "Failed to load profile"))
      .finally(() => setLoading(false));
  }, [token, userId]);

  const FULL_MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  const printSlip = (r: SalaryRecord, employeeName: string, department: string | null) => {
    const logoHtml = org?.logoUrl ? `<img style="height:52px;width:52px;object-fit:contain;border-radius:8px;border:1px solid #e4e4e7" src="${org.logoUrl}" alt="${org.title}" />` : "";
    const orgHeader = org ? `<div style="display:flex;align-items:center;gap:14px;padding-bottom:14px;margin-bottom:8px;border-bottom:3px solid #18181b">${logoHtml}<div><div style="font-size:19px;font-weight:800;color:#18181b;margin:0">${org.title}</div><div style="font-size:11px;color:#71717a;margin-top:3px">Official Payslip</div></div></div>` : "";
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Payslip — ${employeeName}</title><style>*{box-sizing:border-box}body{font-family:Arial,sans-serif;padding:40px;max-width:660px;margin:0 auto;color:#18181b}table{width:100%;border-collapse:collapse}th{background:#f4f4f5;padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em}td{padding:10px 12px;border-bottom:1px solid #f4f4f5;font-size:13px}.right{text-align:right;font-weight:600}.total td{font-size:15px;font-weight:700;border-top:2px solid #18181b;border-bottom:none;padding-top:12px}.status{display:inline-block;padding:4px 12px;border-radius:9999px;font-size:12px;font-weight:600}.paid{background:#dcfce7;color:#16a34a}.pending{background:#fef9c3;color:#ca8a04}.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:16px 0 20px}.meta-item label{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#71717a;margin-bottom:2px}.meta-item span{font-weight:600}.sigs{display:flex;justify-content:space-between;margin-top:48px;gap:24px}.sig{flex:1;text-align:center}.sig-line{border-top:1.5px solid #18181b;margin-bottom:8px;height:48px}.sig-name{font-size:12px;font-weight:700}.sig-role{font-size:10px;color:#71717a;margin-top:2px}.footer{margin-top:24px;font-size:10px;color:#a1a1aa;text-align:center}</style></head><body>
    ${orgHeader}
    <div style="display:flex;justify-content:space-between;align-items:flex-end;padding-top:10px;margin-bottom:16px"><div style="font-size:22px;font-weight:800;letter-spacing:.04em">PAYSLIP</div><div style="text-align:right;font-size:12px;color:#71717a"><div style="font-size:14px;font-weight:700">${FULL_MONTHS[r.month - 1]} ${r.year}</div><div>Generated ${new Date().toLocaleDateString()}</div></div></div>
    <div class="meta">
      <div class="meta-item"><label>Employee</label><span>${employeeName}</span></div>
      <div class="meta-item"><label>Department</label><span>${department ?? "—"}</span></div>
      <div class="meta-item"><label>Pay Period</label><span>${FULL_MONTHS[r.month - 1]} ${r.year}</span></div>
      <div class="meta-item"><label>Frequency</label><span style="text-transform:capitalize">${r.currency}</span></div>
    </div>
    <table><thead><tr><th>Component</th><th class="right">Amount (${r.currency})</th></tr></thead><tbody>
      <tr><td>Base Salary</td><td class="right">${r.baseSalary.toLocaleString()}</td></tr>
      <tr><td style="color:#16a34a">+ Allowances</td><td class="right" style="color:#16a34a">+ ${r.allowances.toLocaleString()}</td></tr>
      <tr><td style="color:#dc2626">- Deductions</td><td class="right" style="color:#dc2626">- ${r.deductions.toLocaleString()}</td></tr>
      <tr class="total"><td>Net Salary</td><td class="right">${r.currency} ${r.netSalary.toLocaleString()}</td></tr>
    </tbody></table>
    <div style="margin-top:14px">Payment Status: <span class="status ${r.paidAt ? "paid" : "pending"}">${r.paidAt ? `Paid on ${r.paidAt.slice(0,10)}` : "Pending"}</span></div>
    <div class="sigs">
      <div class="sig"><div class="sig-line"></div><div class="sig-name">${employeeName}</div><div class="sig-role">Employee Signature</div></div>
      <div class="sig"><div class="sig-line"></div><div class="sig-name">${r.createdBy?.name ?? "Administration"}</div><div class="sig-role">Authorised Signatory</div></div>
    </div>
    <div class="footer">${org?.title ?? ""} &nbsp;·&nbsp; Issued by: ${r.createdBy?.name ?? "Administration"} &nbsp;·&nbsp; ${new Date().toLocaleDateString()}</div>
    </body></html>`;
    exportHtmlReport(`payslip_${employeeName.replace(/\s+/g,"_")}_${FULL_MONTHS[r.month-1]}_${r.year}`, html);
  };

  const openEcCreate = () => {
    setEcEditTarget(null);
    setEcForm({ name: "", relationship: "", phone: "", phone2: "", notes: "" });
    setEcError(null);
    setEcModalOpen(true);
  };

  const openEcEdit = (ec: EmergencyContact) => {
    setEcEditTarget(ec);
    setEcForm({ name: ec.name, relationship: ec.relationship, phone: ec.phone, phone2: ec.phone2 ?? "", notes: ec.notes ?? "" });
    setEcError(null);
    setEcModalOpen(true);
  };

  const saveEc = async () => {
    if (!ecForm.name || !ecForm.relationship || !ecForm.phone) {
      setEcError("Name, relationship, and primary phone are required.");
      return;
    }
    setEcSaving(true);
    setEcError(null);
    try {
      const body = { userId, name: ecForm.name, relationship: ecForm.relationship, phone: ecForm.phone, phone2: ecForm.phone2 || null, notes: ecForm.notes || null };
      if (ecEditTarget) {
        await apiFetch(`/api/admin/hr/emergency-contacts`, { method: "PATCH", body: JSON.stringify({ id: ecEditTarget.id, ...body }) });
      } else {
        await apiFetch(`/api/admin/hr/emergency-contacts`, { method: "POST", body: JSON.stringify(body) });
      }
      setEcModalOpen(false);
      const refreshed = await apiFetch<ProfileData>(`/api/admin/hr/employees/${userId}`);
      setData(refreshed);
    } catch (e: any) {
      setEcError(e?.message ?? "Failed to save");
    } finally {
      setEcSaving(false);
    }
  };

  const deleteEc = async (id: string) => {
    if (!confirm("Delete this emergency contact?")) return;
    setEcDeleting(id);
    try {
      await apiFetch(`/api/admin/hr/emergency-contacts?id=${id}`, { method: "DELETE" });
      const refreshed = await apiFetch<ProfileData>(`/api/admin/hr/employees/${userId}`);
      setData(refreshed);
    } catch (e: any) {
      alert(e?.message ?? "Failed to delete");
    } finally {
      setEcDeleting(null);
    }
  };

  const initials = (name: string) =>
    name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

  const activeContract = data?.contracts.find((c) => c.isActive);
  const totalPaid = data?.salaryRecords.filter((r) => r.paidAt).reduce((s, r) => s + r.netSalary, 0) ?? 0;
  const totalPending = data?.salaryRecords.filter((r) => !r.paidAt).reduce((s, r) => s + r.netSalary, 0) ?? 0;

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-24 text-sm text-zinc-400">Loading profile...</div>
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell>
        <div className="rounded-xl bg-red-50 p-6 text-sm text-red-700">{error ?? "Employee not found."}</div>
      </AppShell>
    );
  }

  const { user, contracts, salaryRecords, performanceReviews, trainingRecords, disciplinaryRecords, emergencyContacts } = data;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Back link */}
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800">
          ← Back
        </button>

        {/* Employee header card */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            {user.photoUrl ? (
              <img src={user.photoUrl} alt={user.name} className="h-20 w-20 rounded-full object-cover shrink-0 border-2 border-zinc-200" />
            ) : (
              <div className="h-20 w-20 rounded-full bg-zinc-900 flex items-center justify-center text-white text-xl font-bold shrink-0">
                {initials(user.name)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-zinc-900">{user.name}</h1>
                <span className={`rounded-lg px-2 py-0.5 text-xs font-medium ${user.isActive ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>
                  {user.isActive ? "Active" : "Inactive"}
                </span>
                <span className="rounded-lg px-2 py-0.5 text-xs font-medium bg-zinc-100 text-zinc-600 capitalize">{user.role}</span>
              </div>
              {user.jobTitle && <p className="mt-0.5 text-sm text-zinc-500">{user.jobTitle}</p>}
              {user.department && <p className="text-sm text-zinc-400">{user.department}</p>}
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                {user.email && <span>{user.email}</span>}
                {user.phone && <span>{user.phone}</span>}
                {user.employeeId && <span>ID: {user.employeeId}</span>}
                {user.manager && <span>Manager: {user.manager.name}</span>}
                <span>Joined {new Date(user.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="secondary" onClick={() => router.push(`/admin/hr/contracts?userId=${user.id}`)}>
                Contracts
              </Button>
              <Button onClick={() => router.push(`/admin/hr/salary?userId=${user.id}`)}>
                + Salary
              </Button>
            </div>
          </div>

          {/* Summary stats */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-zinc-50 p-3 text-center">
              <div className="text-lg font-bold text-zinc-900">{contracts.length}</div>
              <div className="text-xs text-zinc-500">Contracts</div>
            </div>
            <div className="rounded-xl bg-zinc-50 p-3 text-center">
              <div className="text-lg font-bold text-zinc-900">{salaryRecords.length}</div>
              <div className="text-xs text-zinc-500">Payslips</div>
            </div>
            <div className="rounded-xl bg-zinc-50 p-3 text-center">
              <div className="text-lg font-bold text-zinc-900">{performanceReviews.length}</div>
              <div className="text-xs text-zinc-500">Reviews</div>
            </div>
            <div className="rounded-xl bg-zinc-50 p-3 text-center">
              <div className="text-lg font-bold text-zinc-900">{trainingRecords.filter(t => t.status === "completed").length}</div>
              <div className="text-xs text-zinc-500">Trainings Done</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="overflow-x-auto">
          <div className="flex gap-1 border-b border-zinc-200 min-w-max">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab
                    ? "border-b-2 border-zinc-900 text-zinc-900"
                    : "text-zinc-500 hover:text-zinc-800"
                }`}
              >
                {tab}
                {tab === "Disciplinary" && disciplinaryRecords.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-red-100 px-1.5 py-0.5 text-xs text-red-700">
                    {disciplinaryRecords.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab: Overview */}
        {activeTab === "Overview" && (
          <div className="grid gap-5 sm:grid-cols-2">
            <Card title="Personal Information">
              <div className="divide-y divide-zinc-100">
                <InfoRow label="Full Name" value={user.name} />
                <InfoRow label="Email" value={user.email} />
                <InfoRow label="Phone" value={user.phone} />
                <InfoRow label="Employee ID" value={user.employeeId} />
                <InfoRow label="Role" value={<span className="capitalize">{user.role}</span>} />
                <InfoRow label="Department" value={user.department} />
                <InfoRow label="Job Title" value={user.jobTitle} />
                <InfoRow label="Manager" value={user.manager?.name} />
                <InfoRow label="Address" value={user.address} />
                <InfoRow label="Joined" value={new Date(user.createdAt).toLocaleDateString()} />
              </div>
            </Card>

            <div className="space-y-5">
              <Card title="Active Contract">
                {activeContract ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-lg px-2 py-1 text-xs font-medium ${CONTRACT_COLORS[activeContract.contractType] ?? "bg-zinc-100 text-zinc-600"}`}>
                        {CONTRACT_LABELS[activeContract.contractType] ?? activeContract.contractType}
                      </span>
                      <span className="text-xs text-zinc-400">{activeContract.payFrequency}</span>
                    </div>
                    <div className="divide-y divide-zinc-100">
                      <InfoRow label="Start Date" value={activeContract.startDate.slice(0, 10)} />
                      <InfoRow label="End Date" value={activeContract.endDate?.slice(0, 10) ?? "Open-ended"} />
                      <InfoRow label="Probation End" value={activeContract.probationEndDate?.slice(0, 10)} />
                      <InfoRow label="Job Title" value={activeContract.jobTitle} />
                      <InfoRow label="Department" value={activeContract.department} />
                      {activeContract.salary != null && (
                        <InfoRow label="Salary" value={`${activeContract.currency} ${activeContract.salary.toLocaleString()} / ${activeContract.payFrequency}`} />
                      )}
                    </div>
                  </div>
                ) : (
                  <EmptyState text="No active contract" />
                )}
              </Card>

              <Card title="Salary Summary">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-emerald-50 p-3 text-center">
                    <div className="text-base font-bold text-emerald-700">
                      {salaryRecords[0]?.currency ?? "AFN"} {salaryRecords.filter(r => r.paidAt).reduce((s, r) => s + r.netSalary, 0).toLocaleString()}
                    </div>
                    <div className="text-xs text-emerald-600 mt-0.5">Total Paid</div>
                  </div>
                  <div className="rounded-xl bg-amber-50 p-3 text-center">
                    <div className="text-base font-bold text-amber-700">
                      {salaryRecords[0]?.currency ?? "AFN"} {salaryRecords.filter(r => !r.paidAt).reduce((s, r) => s + r.netSalary, 0).toLocaleString()}
                    </div>
                    <div className="text-xs text-amber-600 mt-0.5">Pending Payment</div>
                  </div>
                </div>
                {salaryRecords.length > 0 && (
                  <div className="mt-3 text-xs text-zinc-400">
                    Latest: {MONTHS[salaryRecords[0].month - 1]} {salaryRecords[0].year} —{" "}
                    <span className="font-medium text-zinc-700">
                      {salaryRecords[0].currency} {salaryRecords[0].netSalary.toLocaleString()} net
                    </span>
                  </div>
                )}
              </Card>

              {emergencyContacts.length > 0 && (
                <Card title="Emergency Contacts">
                  <div className="space-y-3">
                    {emergencyContacts.map((ec) => (
                      <div key={ec.id} className="rounded-xl bg-zinc-50 p-3">
                        <div className="font-medium text-zinc-900 text-sm">{ec.name}</div>
                        <div className="text-xs text-zinc-500">{ec.relationship}</div>
                        <div className="text-xs text-zinc-600 mt-1">{ec.phone}{ec.phone2 ? ` / ${ec.phone2}` : ""}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* Tab: Contracts */}
        {activeTab === "Contracts" && (
          <Card title="Employment Contracts">
            <div className="flex justify-end mb-3">
              <Button onClick={() => router.push(`/admin/hr/contracts`)}>+ New Contract</Button>
            </div>
            {contracts.length === 0 ? <EmptyState text="No contracts on record." /> : (
              <div className="space-y-3">
                {contracts.map((c) => (
                  <div key={c.id} className={`rounded-xl border p-4 ${c.isActive ? "border-emerald-200 bg-emerald-50/30" : "border-zinc-200 bg-white"}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-lg px-2 py-1 text-xs font-medium ${CONTRACT_COLORS[c.contractType] ?? "bg-zinc-100 text-zinc-600"}`}>
                          {CONTRACT_LABELS[c.contractType] ?? c.contractType}
                        </span>
                        {c.isActive && <span className="rounded-lg px-2 py-1 text-xs font-medium bg-emerald-100 text-emerald-700">Active</span>}
                      </div>
                      {c.salary != null && (
                        <span className="text-sm font-semibold text-zinc-900">{c.currency} {c.salary.toLocaleString()} / {c.payFrequency}</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-zinc-600">
                      <span>Start: {c.startDate.slice(0, 10)}</span>
                      <span>End: {c.endDate?.slice(0, 10) ?? "Open-ended"}</span>
                      {c.jobTitle && <span>Title: {c.jobTitle}</span>}
                      {c.department && <span>Dept: {c.department}</span>}
                      {c.probationEndDate && <span>Probation ends: {c.probationEndDate.slice(0, 10)}</span>}
                    </div>
                    {c.notes && <p className="mt-2 text-xs text-zinc-500 italic">{c.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Tab: Salary */}
        {activeTab === "Salary" && (
          <Card title="Salary Records">
            <div className="flex justify-end mb-3">
              <Button onClick={() => router.push(`/admin/hr/salary?userId=${user.id}`)}>+ Add Record</Button>
            </div>
            {salaryRecords.length === 0 ? <EmptyState text="No salary records." /> : (
              <div className="overflow-x-auto rounded-xl border border-zinc-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-4 py-3">Period</th>
                      <th className="px-4 py-3 hidden sm:table-cell">Base</th>
                      <th className="px-4 py-3 hidden sm:table-cell">Allowances</th>
                      <th className="px-4 py-3 hidden sm:table-cell">Deductions</th>
                      <th className="px-4 py-3">Net Salary</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {salaryRecords.map((r) => (
                      <tr key={r.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                        <td className="px-4 py-3 font-medium text-zinc-900">{MONTHS[r.month - 1]} {r.year}</td>
                        <td className="px-4 py-3 text-zinc-600 hidden sm:table-cell">{r.currency} {r.baseSalary.toLocaleString()}</td>
                        <td className="px-4 py-3 text-emerald-600 hidden sm:table-cell">+{r.allowances.toLocaleString()}</td>
                        <td className="px-4 py-3 text-red-600 hidden sm:table-cell">-{r.deductions.toLocaleString()}</td>
                        <td className="px-4 py-3 font-semibold text-zinc-900">{r.currency} {r.netSalary.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-lg px-2 py-1 text-xs font-medium ${r.paidAt ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                            {r.paidAt ? `Paid ${r.paidAt.slice(0, 10)}` : "Pending"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => printSlip(r, user.name, user.department)}
                            className="rounded-lg px-2 py-1 text-xs font-medium bg-zinc-100 text-zinc-700 hover:bg-zinc-200 transition"
                          >
                            Print Slip
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {/* Tab: Performance */}
        {activeTab === "Performance" && (
          <Card title="Performance Reviews">
            <div className="flex justify-end mb-3">
              <Button onClick={() => router.push(`/admin/hr/performance`)}>+ New Review</Button>
            </div>
            {performanceReviews.length === 0 ? <EmptyState text="No performance reviews yet." /> : (
              <div className="space-y-4">
                {performanceReviews.map((r) => (
                  <div key={r.id} className="rounded-xl border border-zinc-200 p-4 bg-white">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div>
                        <span className="font-semibold text-zinc-900">{r.reviewPeriod}</span>
                        <span className="ml-2 text-xs text-zinc-400">{r.reviewDate.slice(0, 10)}</span>
                      </div>
                      <span className={`rounded-lg px-2 py-1 text-xs font-medium ${RATING_COLORS[r.rating] ?? "bg-zinc-100 text-zinc-600"}`}>
                        {RATING_LABELS[r.rating] ?? r.rating}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-500 mb-2">Reviewed by: {r.reviewer.name}</div>
                    <div className="grid gap-2 sm:grid-cols-2 text-sm">
                      {r.goals && (
                        <div className="rounded-lg bg-zinc-50 p-3">
                          <div className="text-xs font-medium text-zinc-500 mb-1">Goals</div>
                          <p className="text-zinc-700 text-xs">{r.goals}</p>
                        </div>
                      )}
                      {r.achievements && (
                        <div className="rounded-lg bg-emerald-50 p-3">
                          <div className="text-xs font-medium text-emerald-600 mb-1">Achievements</div>
                          <p className="text-zinc-700 text-xs">{r.achievements}</p>
                        </div>
                      )}
                      {r.improvements && (
                        <div className="rounded-lg bg-amber-50 p-3">
                          <div className="text-xs font-medium text-amber-600 mb-1">Areas for Improvement</div>
                          <p className="text-zinc-700 text-xs">{r.improvements}</p>
                        </div>
                      )}
                      {r.comments && (
                        <div className="rounded-lg bg-blue-50 p-3">
                          <div className="text-xs font-medium text-blue-600 mb-1">Comments</div>
                          <p className="text-zinc-700 text-xs">{r.comments}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Tab: Training */}
        {activeTab === "Training" && (
          <Card title="Training & Development">
            <div className="flex justify-end mb-3">
              <Button onClick={() => router.push(`/admin/hr/training`)}>+ Add Training</Button>
            </div>
            {trainingRecords.length === 0 ? <EmptyState text="No training records." /> : (
              <div className="space-y-3">
                {trainingRecords.map((t) => (
                  <div key={t.id} className="rounded-xl border border-zinc-200 p-4 bg-white">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="font-medium text-zinc-900">{t.title}</div>
                        {t.provider && <div className="text-xs text-zinc-500 mt-0.5">Provider: {t.provider}</div>}
                        <div className="text-xs text-zinc-400 mt-1">
                          {t.startDate.slice(0, 10)}{t.endDate ? ` → ${t.endDate.slice(0, 10)}` : ""}
                        </div>
                        {t.notes && <p className="text-xs text-zinc-500 mt-1 italic">{t.notes}</p>}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`rounded-lg px-2 py-1 text-xs font-medium ${TRAINING_COLORS[t.status] ?? "bg-zinc-100 text-zinc-600"}`}>
                          {t.status.replace("_", " ")}
                        </span>
                        {t.certificate && (
                          <span className="rounded-lg px-2 py-1 text-xs font-medium bg-purple-50 text-purple-700">Certificate</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Tab: Disciplinary */}
        {activeTab === "Disciplinary" && (
          <Card title="Disciplinary Records">
            <div className="flex justify-end mb-3">
              <Button onClick={() => router.push(`/admin/hr/disciplinary`)}>+ Add Record</Button>
            </div>
            {disciplinaryRecords.length === 0 ? <EmptyState text="No disciplinary records." /> : (
              <div className="space-y-3">
                {disciplinaryRecords.map((d) => (
                  <div key={d.id} className="rounded-xl border border-red-100 bg-red-50/30 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <span className={`rounded-lg px-2 py-1 text-xs font-medium ${DISC_COLORS[d.type] ?? "bg-zinc-100 text-zinc-600"}`}>
                        {DISC_LABELS[d.type] ?? d.type}
                      </span>
                      <span className="text-xs text-zinc-500">{d.date.slice(0, 10)}</span>
                    </div>
                    <p className="text-sm font-medium text-zinc-900">{d.reason}</p>
                    {d.description && <p className="text-xs text-zinc-600 mt-1">{d.description}</p>}
                    {d.actionTaken && (
                      <div className="mt-2 rounded-lg bg-white border border-zinc-200 p-2 text-xs">
                        <span className="font-medium text-zinc-500">Action taken: </span>{d.actionTaken}
                      </div>
                    )}
                    {d.issuedBy && <div className="mt-2 text-xs text-zinc-400">Issued by: {d.issuedBy.name}</div>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Tab: Emergency Contacts */}
        {activeTab === "Emergency Contacts" && (
          <Card title="Emergency Contacts">
            <div className="flex justify-end mb-3">
              <Button onClick={openEcCreate}>+ Add Contact</Button>
            </div>
            {emergencyContacts.length === 0 ? <EmptyState text="No emergency contacts on record." /> : (
              <div className="space-y-3">
                {emergencyContacts.map((ec) => (
                  <div key={ec.id} className="rounded-xl border border-zinc-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-zinc-900">{ec.name}</div>
                        <div className="text-xs text-zinc-500 mt-0.5">{ec.relationship}</div>
                        <div className="text-sm text-zinc-700 mt-1">{ec.phone}</div>
                        {ec.phone2 && <div className="text-sm text-zinc-700">{ec.phone2}</div>}
                        {ec.notes && <p className="text-xs text-zinc-400 mt-1 italic">{ec.notes}</p>}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => openEcEdit(ec)}
                          className="rounded-lg px-2 py-1 text-xs font-medium bg-zinc-100 text-zinc-700 hover:bg-zinc-200 transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteEc(ec.id)}
                          disabled={ecDeleting === ec.id}
                          className="rounded-lg px-2 py-1 text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 transition disabled:opacity-50"
                        >
                          {ecDeleting === ec.id ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Emergency Contact Modal */}
        {ecModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setEcModalOpen(false)}>
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold text-zinc-900">{ecEditTarget ? "Edit Emergency Contact" : "Add Emergency Contact"}</h3>
                <button onClick={() => setEcModalOpen(false)} className="rounded-lg p-1 hover:bg-zinc-100 text-zinc-400">✕</button>
              </div>
              {ecError && <div className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{ecError}</div>}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Full Name *</label>
                  <input
                    className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                    value={ecForm.name}
                    onChange={(e) => setEcForm({ ...ecForm, name: e.target.value })}
                    placeholder="Contact's full name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Relationship *</label>
                  <input
                    className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                    value={ecForm.relationship}
                    onChange={(e) => setEcForm({ ...ecForm, relationship: e.target.value })}
                    placeholder="e.g. Spouse, Parent, Sibling"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Primary Phone *</label>
                  <input
                    className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                    value={ecForm.phone}
                    onChange={(e) => setEcForm({ ...ecForm, phone: e.target.value })}
                    placeholder="+93 700 000 000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Secondary Phone</label>
                  <input
                    className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                    value={ecForm.phone2}
                    onChange={(e) => setEcForm({ ...ecForm, phone2: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Notes</label>
                  <textarea
                    className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm resize-none"
                    rows={2}
                    value={ecForm.notes}
                    onChange={(e) => setEcForm({ ...ecForm, notes: e.target.value })}
                    placeholder="Any additional information"
                  />
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button onClick={() => setEcModalOpen(false)} className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50">Cancel</button>
                <button
                  onClick={saveEc}
                  disabled={ecSaving}
                  className="rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {ecSaving ? "Saving…" : ecEditTarget ? "Save Changes" : "Add Contact"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
