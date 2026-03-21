import { useState, useEffect } from "react";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function Settings() {
  const { profile, loading, updateProfile } = useProfile();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");
  const [weeklyHours, setWeeklyHours] = useState("");
  const [injuryNotes, setInjuryNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Populate form when profile loads
  useEffect(() => {
    if (profile) {
      setName(profile.name ?? "");
      setExperienceLevel(profile.experience_level ?? "");
      setWeeklyHours(profile.weekly_hours_available?.toString() ?? "");
      setInjuryNotes(profile.injury_notes ?? "");
    }
  }, [profile]);

  const handleSave = async () => {
    setSaving(true);
    const success = await updateProfile({
      name: name.trim() || null,
      experience_level: experienceLevel || null,
      weekly_hours_available: weeklyHours ? Number(weeklyHours) : null,
      injury_notes: injuryNotes.trim() || null,
    });
    setSaving(false);

    if (success) {
      toast.success("Settings saved");
    } else {
      toast.error("Failed to save settings");
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
            {/* Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                Display Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full bg-dark-surface-lighter border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              />
            </div>

            {/* Experience Level */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                Experience Level
              </label>
              <select
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(e.target.value)}
                className="w-full bg-dark-surface-lighter border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors appearance-none"
              >
                <option value="">Select level</option>
                <option value="beginner">Beginner (0-1 years)</option>
                <option value="intermediate">Intermediate (1-3 years)</option>
                <option value="advanced">Advanced (3-7 years)</option>
                <option value="elite">Elite (7+ years)</option>
              </select>
            </div>

            {/* Weekly Hours */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                Weekly Training Hours Available
              </label>
              <input
                type="number"
                value={weeklyHours}
                onChange={(e) => setWeeklyHours(e.target.value)}
                placeholder="e.g. 8"
                min="0"
                max="40"
                className="w-full bg-dark-surface-lighter border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              />
            </div>

            {/* Injury Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                Injury Notes
              </label>
              <textarea
                value={injuryNotes}
                onChange={(e) => setInjuryNotes(e.target.value)}
                placeholder="Any current injuries or limitations..."
                rows={3}
                className="w-full bg-dark-surface-lighter border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors resize-none"
              />
            </div>
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving}
            className={`mt-6 w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
              saving
                ? "bg-primary/50 text-slate-900 cursor-not-allowed"
                : "bg-primary hover:bg-primary-hover text-slate-900"
            }`}
          >
            {saving ? (
              <>
                <span className="animate-spin material-symbols-outlined text-lg" style={{ fontVariationSettings: '"FILL" 1' }}>progress_activity</span>
                Saving...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: '"FILL" 1' }}>check</span>
                Save Changes
              </>
            )}
          </button>
        </section>

        {/* Account Section */}
        <section className="bg-dark-surface rounded-2xl border border-slate-700/50 p-6">
          <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-slate-400" style={{ fontVariationSettings: '"FILL" 1' }}>manage_accounts</span>
            Account
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-slate-700/50">
              <div>
                <div className="text-sm font-medium text-white">Email</div>
                <div className="text-xs text-slate-400">{user?.email}</div>
              </div>
            </div>

            <div className="flex items-center justify-between py-3">
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
          </div>
        </section>
      </div>
    </div>
  );
}
