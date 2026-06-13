import { useState, useCallback } from 'react';
import { useTodayRecommendation } from '@/hooks/useTodayRecommendation';
import { CalendarWidget } from '@/components/dashboard/CalendarWidget';
import { PmcChart } from '@/components/dashboard/PmcChart';
import { useProfile } from '@/hooks/useProfile';
import { useLocation } from '@/hooks/useLocation';
import { useAuth } from '@/contexts/AuthContext';
import { MorningCheckinFlow, type CheckinPayload } from '@/components/checkin/MorningCheckinFlow';
import { GarminSyncCard } from '@/components/garmin/GarminSyncCard';
import type { ReasonCode, EvidenceSummary } from '@/lib/core/contracts';
import { AppSidebar } from '@/components/navigation/AppSidebar';
import { EvidencePanel } from '@/components/dashboard/EvidencePanel';
import { WorkoutDetail } from '@/components/dashboard/WorkoutDetail';
import { getCautionStyles, formatReasonCode, sanitizeRationale } from '@/components/dashboard/dashboardUtils';

export default function Dashboard() {
  const { displayName, loading: profileLoading } = useProfile();
  const locationCity = useLocation();
  const {
    data: recommendation,
    loading: recLoading,
    error: recError,
    refetch: recRefetch,
    submitChoice,
    submittingCandidateId,
    choiceError,
  } = useTodayRecommendation();
  const { session } = useAuth();
  const [evidenceExpanded, setEvidenceExpanded] = useState(false);
  const [choiceState, setChoiceState] = useState<{
    status: "idle" | "submitted";
    candidateId?: string;
    action?: "accept" | "reject";
  }>({ status: "idle" });

  // Check-in submission handler — posts to /api/user-flags, then refetches recommendation
  const handleCheckinSubmit = useCallback(async (payload: CheckinPayload) => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }

    const response = await fetch("/api/user-flags", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    // Refetch recommendation so calibrated session updates immediately
    recRefetch();
  }, [session?.access_token, recRefetch]);

  // Derive top prescribed candidate
  const topCandidate = recommendation?.candidates?.[0] ?? null;
  const evidence = recommendation?.evidence ?? null;

  // Derive wearable readiness for check-in component
  const wearableReadiness = (() => {
    if (!evidence?.fatigue_score && !evidence?.fitness_score) return null;
    const fatigue = evidence?.fatigue_score ?? 0;
    const readiness = evidence?.fitness_score ?? 50;
    if (fatigue >= 75 || readiness < 40) return "red" as const;
    if (fatigue >= 50 || readiness < 65) return "yellow" as const;
    return "green" as const;
  })();

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-dark-base">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const userName = displayName;
  const today = new Date();
  const dateString = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  });

  const isSubmitting = submittingCandidateId !== null;

  return (
    <div className="dark h-screen flex overflow-hidden bg-light-base dark:bg-dark-base text-slate-800 dark:text-slate-200 font-sans antialiased transition-colors duration-200">

      <AppSidebar />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-light-base dark:bg-dark-base relative">
        <div className="max-w-7xl mx-auto px-8 py-8">

          {/* Header */}
          <header className="flex justify-between items-end mb-8">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-1">Welcome back, {userName}</h1>
              <div className="flex items-center text-sm text-slate-500 dark:text-slate-400 space-x-2">
                <span>{dateString}</span>
                {locationCity && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-slate-400"></span>
                    <span>{locationCity}</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-surface rounded-full transition-colors">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: '"FILL" 1' }}>notifications</span>
              </button>
            </div>
          </header>

          {/* Morning Check-in */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 dark:from-dark-surface dark:to-dark-surface rounded-2xl p-6 mb-8 relative overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>
            <div className="relative z-10">
              <div className="flex items-center space-x-3 mb-2">
                {recommendation?.evidence?.checkin_mood ? (
                  <span className="bg-green-500/20 text-green-400 text-xs font-bold px-2 py-1 rounded uppercase tracking-wider border border-green-500/20 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: '"FILL" 1' }}>check_circle</span>
                    Completed
                  </span>
                ) : (
                  <span className="bg-green-500/20 text-green-400 text-xs font-bold px-2 py-1 rounded uppercase tracking-wider border border-green-500/20">Required</span>
                )}
                <h2 className="text-lg font-bold text-white">Morning Check-in</h2>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed mb-4">
                {recommendation?.evidence?.checkin_mood
                  ? "Your check-in is calibrating today's recommendation."
                  : "How are you feeling right now? Your input helps calibrate today's recommended intensity and recovery scores."}
              </p>
              <MorningCheckinFlow
                onSubmit={handleCheckinSubmit}
                wearableReadiness={wearableReadiness}
                existingMood={recommendation?.evidence?.checkin_mood ?? null}
              />
            </div>
          </div>

          <div className="grid grid-cols-12 gap-6">

            {/* Left Column (8/12) */}
            <div className="col-span-12 lg:col-span-8 space-y-6">

                {/* Anomaly Warning Banner */}
              {/* Anomaly Resolved Banner */}
              {evidence && (!evidence.anomaly_caution_level || evidence.anomaly_caution_level === "none") && evidence.anomaly_resolved_today && evidence.anomaly_resolved_today.length > 0 && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 flex items-center gap-3">
                  <span className="material-symbols-outlined text-green-400 text-xl" style={{ fontVariationSettings: '"FILL" 1' }}>check_circle</span>
                  <div>
                    <span className="text-sm font-bold text-green-400">Signals normalized</span>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {evidence.anomaly_resolved_today.map((c) => formatReasonCode(c as ReasonCode)).join(", ")} resolved — your body is recovering.
                    </p>
                  </div>
                </div>
              )}

              {evidence && evidence.anomaly_caution_level && evidence.anomaly_caution_level !== "none" && (() => {
                const severity = evidence.anomaly_caution_level;
                const styles = getCautionStyles(severity);
                const restrictions = evidence.anomaly_restrictions || [];
                const anomalyReasons = (recommendation?.candidates[0]?.reason_codes || []).filter(
                  (c) => c.startsWith("ANOMALY_")
                );
                return (
                  <div className={`${styles.bg} ${styles.border} border rounded-xl p-4 flex items-start gap-3`}>
                    <span className={`material-symbols-outlined ${styles.text} text-xl mt-0.5`} style={{ fontVariationSettings: '"FILL" 1' }}>
                      {severity === "high" ? "emergency" : "warning"}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-sm font-bold ${styles.text} uppercase`}>{severity} caution</span>
                        {evidence.anomaly_streak_days != null && evidence.anomaly_streak_days >= 2 && (
                          <span className="bg-red-500/20 text-red-400 text-xs font-bold px-2 py-0.5 rounded border border-red-500/30">
                            Day {evidence.anomaly_streak_days}
                          </span>
                        )}
                      </div>
                      {evidence.anomaly_escalation_note && (
                        <p className="text-sm text-slate-300 mb-2">{evidence.anomaly_escalation_note}</p>
                      )}
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {anomalyReasons.map((code) => (
                          <span key={code} className={`${styles.bg} ${styles.text} text-xs font-semibold px-2 py-0.5 rounded`}>
                            {formatReasonCode(code as ReasonCode)}
                          </span>
                        ))}
                      </div>
                      {restrictions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {restrictions.includes("cap_intensity") && (
                            <span className="bg-slate-700/50 text-slate-300 text-xs px-2 py-0.5 rounded flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: '"FILL" 1' }}>speed</span>
                              Intensity capped
                            </span>
                          )}
                          {restrictions.includes("suggest_rest") && (
                            <span className="bg-slate-700/50 text-slate-300 text-xs px-2 py-0.5 rounded flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: '"FILL" 1' }}>hotel</span>
                              Rest suggested
                            </span>
                          )}
                          {restrictions.includes("require_checkin") && (
                            <span className="bg-slate-700/50 text-slate-300 text-xs px-2 py-0.5 rounded flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: '"FILL" 1' }}>edit_note</span>
                              Check-in required
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

            {/* Hero Card: Today's Focus — single prescribed session */}
              <div className="bg-slate-900 dark:bg-dark-surface rounded-2xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-700/50 group relative">
                <div className="relative z-10 p-8">
                  <div className="flex items-center gap-3 mb-6 flex-wrap">
                    <span className="bg-primary text-slate-900 text-xs font-black px-3 py-1.5 rounded uppercase tracking-wide">Today's Focus</span>
                    {recommendation?.llm_used && (
                      <span className="bg-blue-500/20 text-blue-300 text-xs font-bold px-2 py-1 rounded border border-blue-500/30 uppercase tracking-wide">AI Enhanced</span>
                    )}
                    {recommendation?.evidence?.goal_title && (
                      <span className="bg-orange-500/20 text-orange-300 text-xs font-bold px-2 py-1 rounded border border-orange-500/30">
                        {recommendation.evidence.training_phase && (
                          <span className="capitalize">{recommendation.evidence.training_phase}</span>
                        )}
                        {recommendation.evidence.plan_week_number && recommendation.evidence.goal_title && (
                          <span> · Wk {recommendation.evidence.plan_week_number}</span>
                        )}
                        {recommendation.evidence.days_until_race != null && recommendation.evidence.days_until_race <= 30 && (
                          <span> · {recommendation.evidence.days_until_race}d to race</span>
                        )}
                      </span>
                    )}
                  </div>

                  {/* Loading State */}
                  {recLoading && (
                    <div className="flex flex-col items-center justify-center py-16">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-4"></div>
                      <p className="text-slate-400">Loading recommendation...</p>
                    </div>
                  )}

                  {/* Error State */}
                  {recError && !recLoading && (
                    <div className="flex flex-col items-center justify-center py-16">
                      <span className="material-symbols-outlined text-red-400 text-4xl mb-4" style={{ fontVariationSettings: '"FILL" 1' }}>error</span>
                      <p className="text-slate-300 mb-4">Failed to load recommendation</p>
                      <p className="text-sm text-slate-500 mb-4">{recError}</p>
                      <button
                        onClick={() => recRefetch()}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                      >
                        Try Again
                      </button>
                    </div>
                  )}

                  {/* Empty State */}
                  {!recLoading && !recError && !topCandidate && (
                    <div className="flex flex-col items-center justify-center py-16">
                      <span className="material-symbols-outlined text-slate-500 text-4xl mb-4" style={{ fontVariationSettings: '"FILL" 1' }}>calendar_today</span>
                      <p className="text-slate-300">No recommendation available for today</p>
                    </div>
                  )}

                  {/* Single Prescribed Session */}
                  {!recLoading && !recError && topCandidate && recommendation && (
                    <div className="space-y-4">
                      <div className={`rounded-xl p-5 bg-gradient-to-r from-slate-800 to-slate-800/50 border border-primary/30 ${choiceState.status === "submitted" && choiceState.candidateId === topCandidate.candidate_id ? "ring-2 ring-primary" : ""}`}>
                        {/* Labels & caution */}
                        <div className="flex items-center gap-2 mb-2">
                          {recommendation.evidence?.workout_completed_today ? (
                            <span className="bg-green-500/20 text-green-400 text-xs font-bold px-2 py-0.5 rounded uppercase flex items-center gap-1">
                              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: '"FILL" 1' }}>check_circle</span>
                              Completed
                            </span>
                          ) : (
                            <span className="bg-primary/20 text-primary text-xs font-bold px-2 py-0.5 rounded uppercase">Prescribed</span>
                          )}
                          {topCandidate.caution_level !== "none" && (() => {
                            const cautionStyles = getCautionStyles(topCandidate.caution_level);
                            return (
                              <span className={`${cautionStyles.bg} ${cautionStyles.text} ${cautionStyles.border} border text-xs font-bold px-2 py-0.5 rounded uppercase`}>
                                {topCandidate.caution_level} caution
                              </span>
                            );
                          })()}
                        </div>

                        {/* Workout label + rationale */}
                        <h3 className="text-xl font-bold text-white mb-2">{topCandidate.label}</h3>
                        <p className="text-slate-300 text-sm leading-relaxed">{sanitizeRationale(topCandidate.rationale)}</p>

                        {/* Reason codes (top 3) */}
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {topCandidate.reason_codes.slice(0, 3).map((code) => (
                            <span
                              key={code}
                              className="bg-slate-700/50 text-slate-400 text-xs px-2 py-0.5 rounded"
                            >
                              {formatReasonCode(code)}
                            </span>
                          ))}
                        </div>

                        {/* Workout segments */}
                        {topCandidate.workout && <WorkoutDetail workout={topCandidate.workout} />}

                        {/* Actions */}
                        <div className="flex items-center gap-3 mt-5">
                          {recommendation.evidence?.workout_completed_today ? (
                            <div className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-lg text-green-400" style={{ fontVariationSettings: '"FILL" 1' }}>check_circle</span>
                              <span className="text-sm font-medium text-green-400">Workout logged</span>
                            </div>
                          ) : choiceState.status === "idle" ? (
                            <>
                              {/* Primary: Confirm session */}
                              <button
                                onClick={async () => {
                                  const success = await submitChoice(topCandidate.candidate_id, "accept");
                                  if (success) setChoiceState({ status: "submitted", candidateId: topCandidate.candidate_id, action: "accept" });
                                }}
                                disabled={isSubmitting}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold transition-all bg-primary hover:bg-primary-hover text-slate-900 ${
                                  isSubmitting ? "opacity-50 cursor-not-allowed" : ""
                                }`}
                              >
                                {submittingCandidateId === topCandidate.candidate_id ? (
                                  <>
                                    <span className="animate-spin material-symbols-outlined text-lg" style={{ fontVariationSettings: '"FILL" 1' }}>progress_activity</span>
                                    <span>Confirming...</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: '"FILL" 1' }}>check_circle</span>
                                    <span>Confirm session</span>
                                  </>
                                )}
                              </button>

                              {/* Secondary: Can't do this */}
                              <button
                                onClick={async () => {
                                  const success = await submitChoice(topCandidate.candidate_id, "reject");
                                  if (success) setChoiceState({ status: "submitted", candidateId: topCandidate.candidate_id, action: "reject" });
                                }}
                                disabled={isSubmitting}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold transition-all bg-slate-700 hover:bg-slate-600 text-slate-300 ${
                                  isSubmitting ? "opacity-50 cursor-not-allowed" : ""
                                }`}
                              >
                                {submittingCandidateId === topCandidate.candidate_id && choiceState.status === "idle" ? null : (
                                  <>
                                    <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: '"FILL" 1' }}>close</span>
                                    <span>Can't do this</span>
                                  </>
                                )}
                              </button>
                            </>
                          ) : choiceState.candidateId === topCandidate.candidate_id ? (
                            <div className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-lg text-green-400" style={{ fontVariationSettings: '"FILL" 1' }}>
                                {choiceState.action === "accept" ? "check_circle" : "info"}
                              </span>
                              <span className={`text-sm font-medium ${choiceState.action === "accept" ? "text-green-400" : "text-slate-400"}`}>
                                {choiceState.action === "accept" ? "Session confirmed" : "Noted — take care today"}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 opacity-50">
                              <span className="material-symbols-outlined text-lg text-slate-500" style={{ fontVariationSettings: '"FILL" 1' }}>check_circle</span>
                              <span className="text-sm font-medium text-slate-500">Confirm session</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Alternative Candidates */}
                      {recommendation.candidates.length > 1 && (
                        <div className="mt-4">
                          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Other options</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {recommendation.candidates.slice(1).map((alt) => {
                              const isChosen = choiceState.status === "submitted" && choiceState.candidateId === alt.candidate_id;
                              return (
                                <div
                                  key={alt.candidate_id}
                                  className={`bg-slate-800/50 rounded-lg p-4 border transition-all ${
                                    isChosen ? "border-primary ring-2 ring-primary" : "border-slate-700/50"
                                  }`}
                                >
                                  {/* Caution badge */}
                                  {alt.caution_level !== "none" && (() => {
                                    const s = getCautionStyles(alt.caution_level);
                                    return (
                                      <span className={`${s.bg} ${s.text} ${s.border} border text-xs font-bold px-2 py-0.5 rounded uppercase inline-block mb-2`}>
                                        {alt.caution_level}
                                      </span>
                                    );
                                  })()}

                                  {/* Label */}
                                  <h5 className="text-sm font-bold text-white mb-1">{alt.label}</h5>

                                  {/* Rationale (2-line clamp) */}
                                  <p className="text-xs text-slate-400 leading-relaxed mb-3 line-clamp-2">{sanitizeRationale(alt.rationale)}</p>

                                  {/* Action / confirmation */}
                                  {isChosen ? (
                                    <div className="flex items-center gap-1.5">
                                      <span className="material-symbols-outlined text-green-400 text-base" style={{ fontVariationSettings: '"FILL" 1' }}>check_circle</span>
                                      <span className="text-xs font-medium text-green-400">Selected</span>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={async () => {
                                        const success = await submitChoice(alt.candidate_id, "accept");
                                        if (success) setChoiceState({ status: "submitted", candidateId: alt.candidate_id, action: "accept" });
                                      }}
                                      disabled={choiceState.status === "submitted" || isSubmitting}
                                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all bg-slate-700 hover:bg-slate-600 text-slate-300 ${
                                        choiceState.status === "submitted" || isSubmitting ? "opacity-50 cursor-not-allowed" : ""
                                      }`}
                                    >
                                      <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: '"FILL" 1' }}>swap_horiz</span>
                                      <span>Choose this</span>
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Choice error */}
                      {choiceError && (
                        <div className="text-sm text-red-400">{choiceError}</div>
                      )}

                      {/* Evidence Panel */}
                      <EvidencePanel
                        evidence={recommendation.evidence}
                        generatedAt={recommendation.generated_at}
                        lastGarminSync={recommendation.evidence.last_garmin_sync_at ?? null}
                        expanded={evidenceExpanded}
                        onToggle={() => setEvidenceExpanded(!evidenceExpanded)}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Weekly Schedule */}
              <CalendarWidget />

              {/* Performance Management Chart */}
              <div className="bg-light-surface dark:bg-dark-surface rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700/50">
                <PmcChart
                  raceDate={evidence?.days_until_race != null
                    ? new Date(Date.now() + evidence.days_until_race * 86400000).toISOString().slice(0, 10)
                    : null}
                  raceName={evidence?.goal_title ?? null}
                />
              </div>
            </div>

            {/* Right Column (4/12) */}
            <div className="col-span-12 lg:col-span-4 space-y-6">

              {/* Garmin Sync Status */}
              <GarminSyncCard />

              {/* Recovery Score — driven by real API evidence */}
              {(() => {
                const readiness = evidence
                  ? (evidence.signal_contribution?.final_score ?? Math.round(100 - (evidence.fatigue_score ?? 50)))
                  : null;
                const confidence = evidence ? Math.round(evidence.confidence * 100) : null;
                const circumference = 2 * Math.PI * 80; // ~502
                const offset = readiness != null
                  ? circumference * (1 - readiness / 100)
                  : circumference * 0.5;
                const readinessColor = readiness == null ? "text-slate-500"
                  : readiness >= 70 ? "text-primary"
                  : readiness >= 40 ? "text-amber-400"
                  : "text-red-400";

                return (
                  <div className="bg-light-surface dark:bg-dark-surface rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700/50 relative overflow-hidden">
                    <div className="flex justify-between items-start mb-6 relative z-10">
                      <div>
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white">Recovery Score</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {readiness == null ? "Waiting for data" : readiness >= 70 ? "Primed to perform" : readiness >= 40 ? "Moderate recovery" : "Recovery needed"}
                        </p>
                      </div>
                      {confidence != null && (
                        <span className="bg-slate-100 dark:bg-dark-surface-lighter text-slate-500 dark:text-slate-400 text-xs font-bold px-2 py-1 rounded">
                          {confidence}% conf
                        </span>
                      )}
                    </div>

                    {/* Circular Chart */}
                    <div className="relative w-48 h-48 mx-auto mb-8">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle
                          className="text-slate-100 dark:text-dark-surface-lighter"
                          cx="96" cy="96" fill="transparent" r="80" stroke="currentColor" strokeWidth="12"
                        ></circle>
                        <circle
                          className={`${readinessColor} transition-[stroke-dashoffset] duration-350 ease-in-out`}
                          cx="96" cy="96" fill="transparent" r="80" stroke="currentColor"
                          strokeDasharray={String(circumference)}
                          strokeDashoffset={String(offset)}
                          strokeLinecap="round"
                          strokeWidth="12"
                        ></circle>
                      </svg>
                      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                        <span className="block text-4xl font-black text-slate-900 dark:text-white">
                          {readiness != null ? `${readiness}%` : "--"}
                        </span>
                        <span className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-1">Ready</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-50 dark:bg-dark-surface-lighter p-4 rounded-xl">
                        <div className="flex items-center space-x-2 mb-2 text-slate-500 dark:text-slate-400">
                          <span className="material-symbols-outlined text-sm text-rose-500" style={{ fontVariationSettings: '"FILL" 1' }}>favorite</span>
                          <span className="text-xs font-bold uppercase">Fatigue</span>
                        </div>
                        <p className="text-xl font-bold text-slate-900 dark:text-white">
                          {evidence?.fatigue_score != null ? evidence.fatigue_score : "--"}
                          <span className="text-sm font-normal text-slate-500">/100</span>
                        </p>
                      </div>
                      <div className="bg-slate-50 dark:bg-dark-surface-lighter p-4 rounded-xl">
                        <div className="flex items-center space-x-2 mb-2 text-slate-500 dark:text-slate-400">
                          <span className="material-symbols-outlined text-sm text-indigo-400" style={{ fontVariationSettings: '"FILL" 1' }}>dark_mode</span>
                          <span className="text-xs font-bold uppercase">Sleep</span>
                        </div>
                        <p className="text-xl font-bold text-slate-900 dark:text-white">
                          {evidence?.sleep_quality != null ? evidence.sleep_quality : "--"}
                          <span className="text-sm font-normal text-slate-500">/100</span>
                        </p>
                      </div>
                    </div>

                    {/* EWMA fitness/form if available */}
                    {evidence?.ewma_fitness_score != null && (
                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div className="bg-slate-50 dark:bg-dark-surface-lighter p-4 rounded-xl">
                          <div className="flex items-center space-x-2 mb-2 text-slate-500 dark:text-slate-400">
                            <span className="material-symbols-outlined text-sm text-green-500" style={{ fontVariationSettings: '"FILL" 1' }}>fitness_center</span>
                            <span className="text-xs font-bold uppercase">Fitness</span>
                          </div>
                          <p className="text-xl font-bold text-slate-900 dark:text-white">
                            {evidence.ewma_fitness_score}
                            <span className="text-sm font-normal text-slate-500">/100</span>
                          </p>
                        </div>
                        <div className="bg-slate-50 dark:bg-dark-surface-lighter p-4 rounded-xl">
                          <div className="flex items-center space-x-2 mb-2 text-slate-500 dark:text-slate-400">
                            <span className="material-symbols-outlined text-sm text-blue-400" style={{ fontVariationSettings: '"FILL" 1' }}>balance</span>
                            <span className="text-xs font-bold uppercase">Form</span>
                          </div>
                          <p className="text-xl font-bold text-slate-900 dark:text-white">
                            {evidence.ewma_form_score != null ? (evidence.ewma_form_score > 0 ? "+" : "") + evidence.ewma_form_score : "--"}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}


            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
