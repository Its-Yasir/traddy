"use client";

import { useState } from "react";
import Link from "next/link";

export default function AdminPage() {
  const [masterPassword, setMasterPassword] = useState("");
  const [newSimplePassword, setNewSimplePassword] = useState("");
  const [status, setStatus] = useState<{
    type: "success" | "error" | "none";
    message: string;
  }>({
    type: "none",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatus({ type: "none", message: "" });

    try {
      const res = await fetch("/api/auth/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ masterPassword, newSimplePassword }),
      });

      const data = await res.json();

      if (data.success) {
        setStatus({ type: "success", message: data.message });
        setMasterPassword("");
        setNewSimplePassword("");
      } else {
        setStatus({
          type: "error",
          message: data.message || "Failed to update password",
        });
      }
    } catch {
      setStatus({
        type: "error",
        message: "An error occurred. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-4">
      {/* Background Glow */}
      <div className="absolute top-0 inset-x-0 h-96 bg-linear-to-b from-indigo-500/10 to-transparent pointer-events-none" />

      <main className="w-full max-w-lg relative z-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-neutral-500 hover:text-white transition-colors text-sm font-medium mb-8 group"
        >
          <svg
            className="w-4 h-4 transition-transform group-hover:-translate-x-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Dashboard
        </Link>

        <div className="bg-[#0f0f13] border border-white/5 rounded-3xl shadow-2xl p-8 backdrop-blur-xl relative overflow-hidden">
          {/* Header */}
          <div className="mb-10">
            <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-linear-to-r from-white to-neutral-400">
              Admin Control Panel
            </h1>
            <p className="text-neutral-500 mt-2 text-sm font-medium">
              Update platform access security
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2 px-1">
                  Master Password
                </label>
                <input
                  type="password"
                  placeholder="Required to authorize changes"
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-neutral-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2 px-1">
                  New Simple Password
                </label>
                <input
                  type="password"
                  placeholder="Set new public entry password"
                  value={newSimplePassword}
                  onChange={(e) => setNewSimplePassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-neutral-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                  required
                />
              </div>
            </div>

            {status.type !== "none" && (
              <div
                className={`p-4 rounded-2xl text-sm font-medium animate-in fade-in slide-in-from-top-2 ${
                  status.type === "success"
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-red-500/10 text-red-400 border border-red-500/20"
                }`}
              >
                {status.message}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-linear-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-bold py-4 rounded-2xl transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)] disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {isSubmitting ? (
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                ) : (
                  <>
                    Update Access Password
                    <svg
                      className="w-5 h-5 transition-transform group-hover:translate-x-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M14 5l7 7m0 0l-7 7m7-7H3"
                      />
                    </svg>
                  </>
                )}
              </span>
            </button>
          </form>

          <div className="mt-10 pt-6 border-t border-white/5 flex items-center justify-between text-[10px] text-neutral-600 font-bold uppercase tracking-widest">
            <span>Security Layer v2.0</span>
            <span>Admin Auth Required</span>
          </div>
        </div>
      </main>
    </div>
  );
}
