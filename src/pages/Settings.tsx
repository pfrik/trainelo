import { useState, useEffect } from "react";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const inputClass =
  "w-full bg-dark-surface-lighter border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors";
const labelClass =
  "block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2";

export default function Settings() {
  const { profile, loading, updateProfile } = useProfile();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  // Profile form
  const [name, setName] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");
  const [weeklyHours, setWeeklyHours] = useState("");
  const [injuryNotes, setInjuryNotes] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Email change
  const [newEmail, setNewEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  // Password change
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name ?? "");
      setExperienceLevel(profile.experience_level ?? "");
      setWeeklyHours(profile.weekly_hours_available?.toString() ?? "");
      setInjuryNotes(profile.injury_notes ?? "");
    }
  }, [profile]);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    const success = await updateProfile({
      name: name.trim() || null,
      experience_level: experienceLevel || null,
      weekly_hours_available: weeklyHours ? Number(weeklyHours) : null,
      injury_notes: injuryNotes.trim() || null,
    });
    setSavingProfile(false);
    if (success) toast.success("Profile saved");
    else toast.error("Failed to save profile");
  };

  const handleChangeEmail = async () => {
    if (!newEmail.trim()) return;
    setSavingEmail(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    setSavingEmail(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Confirmation email sent to your new address");
      setNewEmail("");
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password updated");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="dark min-h-screen bg-dark-base flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="dark min-h-screen bg-dark-base text-slate-200 font-sans antialiased">
      <div className="max-w-2xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-2xl font-extrabold text-white">Settings</h1>
            <p className="text-sm text-slate-400 mt-1">{user?.email}</p>
          </div>
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-dark-surface border border-slate-700 text-slate-300 hover:bg-dark-surface-lighter transition-colors text-sm font-medium"
          >
            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: '"FILL" 1' }}>arrow_back</span>
            Dashboard
          </button>
        </div>

        {/* Profile Section */}
        <section className="bg-dark-surface rounded-2xl border border-slate-700/50 p-6 mb-6">
          <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: '"FILL" 1' }}>person</span>
            Profile
          </h2>

          <div className="space-y-5">
            <div>
              <label className={labelClass}>Display Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>Experience Level</label>
              <select value={experienceLevel} onChange={(e) => setExperienceLevel(e.target.value)} className={`${inputClass} appearance-none`}>
                <option value="">Select level</option>
                <option value="beginner">Beginner (0-1 years)</option>
                <option value="intermediate">Intermediate (1-3 years)</option>
                <option value="advanced">Advanced (3-7 years)</option>
                <option value="elite">Elite (7+ years)</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Weekly Training Hours Available</label>
              <input type="number" value={weeklyHours} onChange={(e) => setWeeklyHours(e.target.value)} placeholder="e.g. 8" min="0" max="40" className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>Injury Notes</label>
              <textarea value={injuryNotes} onChange={(e) => setInjuryNotes(e.target.value)} placeholder="Any current injuries or limitations..." rows={3} className={`${inputClass} resize-none`} />
            </div>
          </div>

          <button onClick={handleSaveProfile} disabled={savingProfile} className={`mt-6 w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${savingProfile ? "bg-primary/50 text-slate-900 cursor-not-allowed" : "bg-primary hover:bg-primary-hover text-slate-900"}`}>
            {savingProfile ? (
              <><span className="animate-spin material-symbols-outlined text-lg" style={{ fontVariationSettings: '"FILL" 1' }}>progress_activity</span>Saving...</>
            ) : (
              <><span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: '"FILL" 1' }}>check</span>Save Changes</>
            )}
          </button>
        </section>

        {/* Account Section */}
        <section className="bg-dark-surface rounded-2xl border border-slate-700/50 p-6 mb-6">
          <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-slate-400" style={{ fontVariationSettings: '"FILL" 1' }}>manage_accounts</span>
            Account
          </h2>

          <div className="space-y-6">
            {/* Change Email */}
            <div>
              <label className={labelClass}>Change Email</label>
              <p className="text-xs text-slate-500 mb-2">Current: {user?.email}</p>
              <div className="flex gap-3">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="New email address"
                  className={`${inputClass} flex-1`}
                />
                <button
                  onClick={handleChangeEmail}
                  disabled={savingEmail || !newEmail.trim()}
                  className={`flex items-center gap-2 px-5 py-3 rounded-lg font-semibold text-sm transition-all flex-shrink-0 ${
                    savingEmail || !newEmail.trim()
                      ? "bg-slate-700 text-slate-500 cursor-not-allowed"
                      : "bg-slate-700 hover:bg-slate-600 text-white"
                  }`}
                >
                  {savingEmail ? "Sending..." : "Update"}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1.5">A confirmation link will be sent to your new email.</p>
            </div>

            {/* Change Password */}
            <div className="border-t border-slate-700/50 pt-6">
              <label className={labelClass}>Change Password</label>
              <div className="space-y-3">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password (min. 6 characters)"
                  className={inputClass}
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className={inputClass}
                />
                <button
                  onClick={handleChangePassword}
                  disabled={savingPassword || !newPassword}
                  className={`flex items-center gap-2 px-5 py-3 rounded-lg font-semibold text-sm transition-all ${
                    savingPassword || !newPassword
                      ? "bg-slate-700 text-slate-500 cursor-not-allowed"
                      : "bg-slate-700 hover:bg-slate-600 text-white"
                  }`}
                >
                  {savingPassword ? "Updating..." : "Update Password"}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Sign Out */}
        <section className="bg-dark-surface rounded-2xl border border-slate-700/50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-white">Sign Out</div>
              <div className="text-xs text-slate-400">Sign out of your account</div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors text-sm font-medium"
            >
              <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: '"FILL" 1' }}>logout</span>
              Sign Out
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
