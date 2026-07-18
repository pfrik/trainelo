import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Account creation is disabled during the private build phase — login only.
type Mode = "login" | "forgot";

export default function Auth() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error("Please fill in all fields"); return; }
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast.error(error.message.includes("Invalid login") ? "Invalid email or password" : error.message);
    } else {
      navigate("/dashboard");
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast.error("Enter your email address"); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password reset email sent");
      setMode("login");
    }
  };

  const handleGoogleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) toast.error(error.message);
  };

  const inputClass =
    "w-full bg-[#0f172a] border border-[#334155] rounded-lg px-4 py-3.5 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-[#22C55E] focus:ring-1 focus:ring-[#22C55E] transition-all duration-300";
  const labelClass =
    "text-slate-400 text-[11px] font-bold uppercase tracking-wider";

  return (
    <div className="font-sans bg-[#0B0E11] text-white min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden selection:bg-[#22C55E] selection:text-[#0B0E11]">
      {/* Background */}
      <div className="fixed inset-0 z-0">
        <img
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          src="/login-bg.jpg"
        />
        <div className="absolute inset-0 bg-[#0B0E11]/80 backdrop-blur-[6px]"></div>
      </div>

      {/* Card */}
      <main className="relative z-10 w-full max-w-[420px] bg-[#1E293B] rounded-xl shadow-2xl overflow-hidden border border-white/10" style={{ boxShadow: "0 25px 50px -12px rgba(0,0,0,0.7)" }}>
        <div className="p-10 pb-8">
          {/* Logo */}
          <div className="text-center mb-10">
            <h1 className="text-4xl font-bold tracking-tight text-white mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Trainelo
            </h1>
            <p className="text-slate-400 text-sm tracking-wide">
              {mode === "login" && "Welcome back. Continue your journey."}
              {mode === "forgot" && "Reset your password."}
            </p>
          </div>

          {/* Login Form */}
          {mode === "login" && (
            <form onSubmit={handleLogin} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label className={labelClass} htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className={inputClass}
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <label className={labelClass} htmlFor="password">Password</label>
                  <button
                    type="button"
                    onClick={() => setMode("forgot")}
                    className="text-xs font-medium text-[#22C55E] hover:text-[#16A34A] transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    className={`${inputClass} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showPassword ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-4 w-full h-12 flex items-center justify-center rounded-lg bg-[#22C55E] hover:bg-[#16A34A] text-[#0B0E11] text-base font-bold transition-all active:scale-[0.98] shadow-lg shadow-[#22C55E]/20 disabled:opacity-50"
                style={{ boxShadow: "0 0 15px rgba(34,197,94,0.4)" }}
              >
                {loading ? (
                  <span className="animate-spin material-symbols-outlined text-lg" style={{ fontVariationSettings: '"FILL" 1' }}>progress_activity</span>
                ) : (
                  "Log In"
                )}
              </button>

              {/* Divider */}
              <div className="relative flex items-center py-2 mt-2">
                <div className="flex-grow border-t border-[#334155]"></div>
                <span className="flex-shrink-0 mx-4 text-[10px] text-gray-500 font-semibold uppercase tracking-widest">Or</span>
                <div className="flex-grow border-t border-[#334155]"></div>
              </div>

              {/* Google */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="w-full flex items-center justify-center gap-3 h-11 rounded-lg border border-[#334155] bg-[#334155]/50 hover:bg-[#334155] hover:border-gray-500 transition-all duration-300"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                <span className="text-sm font-semibold text-white">Sign in with Google</span>
              </button>
            </form>
          )}

          {/* Forgot Password Form */}
          {mode === "forgot" && (
            <form onSubmit={handleForgotPassword} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label className={labelClass} htmlFor="reset-email">Email</label>
                <input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className={inputClass}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-4 w-full h-12 flex items-center justify-center rounded-lg bg-[#22C55E] hover:bg-[#16A34A] text-[#0B0E11] text-base font-bold transition-all active:scale-[0.98] shadow-lg shadow-[#22C55E]/20 disabled:opacity-50"
                style={{ boxShadow: "0 0 15px rgba(34,197,94,0.4)" }}
              >
                {loading ? (
                  <span className="animate-spin material-symbols-outlined text-lg" style={{ fontVariationSettings: '"FILL" 1' }}>progress_activity</span>
                ) : (
                  "Send Reset Link"
                )}
              </button>

              <button
                type="button"
                onClick={() => setMode("login")}
                className="text-sm text-slate-400 hover:text-white transition-colors"
              >
                Back to login
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="bg-[#16202e] p-5 text-center border-t border-[#334155]">
          <span className="text-slate-400 text-sm">
            Private beta — access is invitation only.
          </span>
        </div>
      </main>

      {/* Copyright */}
      <div className="relative z-10 mt-8 text-center">
        <p className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-medium">
          &copy; 2026 TRAINELO. ALL RIGHTS RESERVED.
        </p>
      </div>
    </div>
  );
}
