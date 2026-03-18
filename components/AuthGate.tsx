"use client";

import { safeStorage } from "@/lib/storage";
import { useEffect, useState } from "react";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const savedPassword = safeStorage.getItem("traddy_password");
        if (!savedPassword) {
          setIsAuthenticated(false);
          setLoading(false);
          return;
        }

        const res = await fetch("/api/auth/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: savedPassword }),
        });

        const data = await res.json();
        if (data.success) {
          setIsAuthenticated(true);
          setPassword(savedPassword);
        } else {
          setIsAuthenticated(false);
          safeStorage.removeItem("traddy_password");
        }
      } catch (e) {
        console.error("AuthGate initialization error:", e);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch("/api/auth/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (data.success) {
        setIsAuthenticated(true);
        safeStorage.setItem("traddy_password", password);
        window.location.reload(); // Reload to trigger SWR fetch
      } else {
        setError(data.message || "Invalid password");
      }
    } catch {
      setError("An error occurred. Please try again.");
    }
  };

  if (loading) return null;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
        <div className="absolute top-0 inset-x-0 h-96 bg-linear-to-b from-emerald-500/10 to-transparent pointer-events-none" />

        <div className="w-full max-w-md bg-[#0f0f13] border border-white/5 rounded-2xl shadow-2xl p-8 backdrop-blur-xl relative overflow-hidden group">
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-linear-to-r from-transparent via-emerald-500/30 to-transparent" />

          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-linear-to-r from-white to-neutral-400 mb-2">
              Traddy Scanner
            </h1>
            <p className="text-neutral-500 text-sm font-medium">
              Enter password to access the platform
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <input
                type="password"
                placeholder="Enter password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-mono"
                required
              />
              {error && (
                <p className="mt-2 text-red-500 text-xs font-medium animate-shake">
                  {error}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-neutral-950 font-bold py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] active:scale-[0.98]"
            >
              Verify Access
            </button>
          </form>

          <p className="mt-8 text-center text-neutral-600 text-[10px] uppercase tracking-widest font-bold">
            Secure Encryption Enabled
          </p>
        </div>

        <style jsx global>{`
          @keyframes shake {
            0%,
            100% {
              transform: translateX(0);
            }
            10%,
            30%,
            50%,
            70%,
            90% {
              transform: translateX(-2px);
            }
            20%,
            40%,
            60%,
            80% {
              transform: translateX(2px);
            }
          }
          .animate-shake {
            animation: shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
          }
        `}</style>
      </div>
    );
  }

  return <>{children}</>;
}
