import Image from "next/image";
import { AppShell } from "../components/AppShell";
import { prisma } from "../lib/prisma";
import { redirect } from "next/navigation";

export default async function Home() {
  const existingAdmins = await prisma.user.count({ where: { role: "admin" } });
  const setupNeeded = existingAdmins === 0;

  if (!setupNeeded) {
    redirect("/login");
  }

  return (
    <AppShell>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-zinc-900">Online Attendance System</h1>
          <p className="mt-2 text-sm text-zinc-600">
            GPS + Daily QR required for both check-in and check-out.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {setupNeeded ? (
              <a
                href="/setup"
                className="rounded-2xl border border-zinc-200 p-5 hover:bg-zinc-50"
              >
                <div className="font-medium text-zinc-900">Initial Setup</div>
                <div className="mt-1 text-sm text-zinc-600">Create the first admin user.</div>
              </a>
            ) : null}
            <a
              href="/login"
              className="rounded-2xl border border-zinc-200 p-5 hover:bg-zinc-50"
            >
              <div className="font-medium text-zinc-900">Login</div>
              <div className="mt-1 text-sm text-zinc-600">Sign in to use the system.</div>
            </a>
            <a
              href="/employee"
              className="rounded-2xl border border-zinc-200 p-5 hover:bg-zinc-50"
            >
              <div className="font-medium text-zinc-900">Employee</div>
              <div className="mt-1 text-sm text-zinc-600">Check in/out with GPS + QR.</div>
            </a>
            <a
              href="/admin/offices"
              className="rounded-2xl border border-zinc-200 p-5 hover:bg-zinc-50"
            >
              <div className="font-medium text-zinc-900">Admin</div>
              <div className="mt-1 text-sm text-zinc-600">Create office + daily QR.</div>
            </a>
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
          <div className="text-sm font-medium text-zinc-900">Recommended flow</div>
          <div className="mt-3 space-y-2 text-sm text-zinc-700">
            {setupNeeded ? <div>1) Open /setup</div> : null}
            <div>{setupNeeded ? "2" : "1"}) Login</div>
            <div>{setupNeeded ? "3" : "2"}) Admin: create office location</div>
            <div>{setupNeeded ? "4" : "3"}) Admin: generate daily QR</div>
            <div>{setupNeeded ? "5" : "4"}) Employee: GPS + QR → check in/out</div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
