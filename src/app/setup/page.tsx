"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { apiFetch } from "../../lib/clientApi";

export default function SetupPage() {
  const router = useRouter();
  const [name, setName] = useState("Admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await apiFetch<{ setupNeeded: boolean }>("/api/setup");
      if (!res.setupNeeded) router.push("/login");
    })().catch(() => {});
  }, [router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      await apiFetch("/api/setup", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });
      setSuccess("Admin created. You can login now.");
      setTimeout(() => router.push("/login"), 800);
    } catch (err: any) {
      setError(err?.message ?? "Setup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <Card title="Initial Setup">
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-800">Admin name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-800">Admin email</label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="admin@company.com" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-800">Password</label>
            <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Min 6 characters" />
          </div>
          {error ? <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
          {success ? <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div> : null}
          <Button disabled={loading} type="submit" className="w-full">
            {loading ? "Creating..." : "Create admin"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
