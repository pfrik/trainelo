import React, { useState } from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';
import type { SubjectiveCheckIn, WeeklyTrainingData } from '@/types/dashboard.types';

// Helper Component for Sidebar Items
interface NavItemProps {
  icon: string;
  text: string;
  active?: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ icon, text, active = false }) => (
  <a
    href="#"
    className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all group ${
      active
        ? "bg-primary text-white shadow-lg shadow-green-500/20"
        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-surface"
    }`}
  >
    <span className={`material-symbols-outlined ${!active && "group-hover:text-primary transition-colors"}`}>
      {icon}
    </span>
    <span className="font-medium">{text}</span>
  </a>
);

const Dashboard: React.FC = () => {
  const { data, loading } = useDashboardData();
  const [mood, setMood] = useState<SubjectiveCheckIn['mood'] | null>(null);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-700"></div>
      </div>
    );
  }

  const { user, todayStats, currentGoal, aiRecommendation, weeklyTraining } = data;

  // Transform weekly training data to match the UI format
  const weekSchedule = weeklyTraining.map((day: WeeklyTrainingData) => {
    let status: 'completed' | 'today' | 'rest' | 'upcoming' = 'upcoming';

    if (day.isCompleted) status = 'completed';
    else if (new Date().toDateString() === day.date.toDateString()) status = 'today';
    else if (day.isRest) status = 'rest';

    const workoutTypeMap: Record<string, string> = {
      'easy': 'Recovery Run',
      'tempo': 'Tempo',
      'intervals': 'Intervals',
      'strength': 'Strength',
      'long': 'Long Run',
      'rest': 'Rest'
    };

    return {
      day: day.weekLabel.slice(0, 3),
      date: day.date.getDate().toString(),
      type: workoutTypeMap[day.workoutType || 'rest'] || 'Workout',
      detail: day.isRest ? 'Rest' : `${day.minutes || 0} mins`,
      status
    };
  });

  // Get today's workout info
  const todayWorkout = weekSchedule.find(day => day.status === 'today');
  const recommendedWorkout = aiRecommendation.recommendedPlan;

  // Format current date
  const currentDate = new Date();
  const dateOptions: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'short', day: 'numeric' };
  const formattedDate = currentDate.toLocaleDateString('en-US', dateOptions);

  // Calculate recovery score from HRV and sleep data
  const recoveryScore = Math.round(
    ((todayStats.hrv.value / todayStats.hrv.dailyAverage) * 50) +
    ((todayStats.sleep.duration / 8) * 50)
  );

  return (
    <div className="dark h-screen flex overflow-hidden bg-light-base dark:bg-dark-base text-slate-800 dark:text-slate-200 font-sans antialiased transition-colors duration-200">

      {/* Sidebar */}
      <aside className="w-64 bg-light-surface dark:bg-dark-base border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between flex-shrink-0 z-20">
        <div className="p-6">
          {/* User Profile */}
          <div className="flex items-center space-x-3 mb-8">
            <div className="relative">
              <div className="w-12 h-12 rounded-full bg-slate-200 border-2 border-primary overflow-hidden">
                {user.profilePicture ? (
                  <img
                    alt={user.name}
                    className="w-full h-full object-cover"
                    src={user.profilePicture}
                  />
                ) : (
                  <img
                    alt={user.name}
                    className="w-full h-full object-cover"
                    src="https://i.pravatar.cc/150?img=9"
                  />
                )}
              </div>
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-light-surface dark:border-dark-base rounded-full"></div>
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">{user.name} Morgan</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Pro Plan Member</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="space-y-2">
            <NavItem icon="dashboard" text="Dashboard" active={true} />
            <NavItem icon="fitness_center" text="Training Log" />
            <NavItem icon="insights" text="Analytics" />
            <NavItem icon="battery_charging_full" text="Recovery" />
          </nav>
        </div>

        <div className="p-6 border-t border-slate-200 dark:border-slate-800">
          <a className="flex items-center space-x-3 text-slate-600 dark:text-slate-400 hover:text-primary dark:hover:text-primary transition-colors" href="#">
            <span className="material-symbols-outlined">settings</span>
            <span className="font-medium">Settings</span>
          </a>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-light-base dark:bg-dark-base relative">
        <div className="max-w-7xl mx-auto px-8 py-8">

          {/* Header */}
          <header className="flex justify-between items-end mb-8">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-1">Welcome back, {user.name}</h1>
              <div className="flex items-center text-sm text-slate-500 dark:text-slate-400 space-x-2">
                <span>{formattedDate}</span>
                <span className="w-1 h-1 rounded-full bg-slate-400"></span>
                <span>London</span>
                <span className="w-1 h-1 rounded-full bg-slate-400"></span>
                <div className="flex items-center">
                  <span className="material-symbols-outlined text-yellow-500 text-base mr-1">wb_sunny</span>
                  <span>18°C</span>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full flex items-center gap-2">
                <span className="text-xs font-bold text-blue-400 uppercase tracking-wide">Goal Context</span>
                <span className="text-xs text-blue-100">{currentGoal.name} - {currentGoal.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ({currentGoal.daysRemaining} days remaining)</span>
              </div>
              <button className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-surface rounded-full transition-colors relative">
                <span className="material-symbols-outlined">notifications</span>
                {data.notifications && data.notifications > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-light-base dark:border-dark-base"></span>
                )}
              </button>
              <button className="px-4 py-2 bg-slate-200 dark:bg-dark-surface text-slate-700 dark:text-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-300 dark:hover:bg-dark-surface-lighter transition-colors border border-transparent dark:border-slate-700">
                Edit Profile
              </button>
            </div>
          </header>

          {/* Morning Check-in */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 dark:from-dark-surface dark:to-dark-surface rounded-2xl p-6 mb-8 relative overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center relative z-10 gap-6">
              <div className="max-w-xl">
                <div className="flex items-center space-x-3 mb-2">
                  <span className="bg-green-500/20 text-green-400 text-xs font-bold px-2 py-1 rounded uppercase tracking-wider border border-green-500/20">Required</span>
                  <h2 className="text-lg font-bold text-white">Morning Check-in</h2>
                </div>
                <p className="text-slate-300 text-sm leading-relaxed">
                  How are you feeling right now? Your input helps calibrate today's recommended intensity and recovery scores.
                </p>
              </div>
              <div className="w-full xl:w-auto">
                <div className="grid grid-cols-5 gap-2 sm:gap-3">
                  {[
                    { icon: 'battery_alert', label: 'Drained' as const, color: 'red' },
                    { icon: 'sentiment_dissatisfied', label: 'Tired' as const, color: 'orange' },
                    { icon: 'sentiment_neutral', label: 'Okay' as const, color: 'yellow' },
                    { icon: 'sentiment_satisfied', label: 'Good' as const, color: 'emerald' },
                    { icon: 'sentiment_very_satisfied', label: 'Great' as const, color: 'green' },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={() => setMood(item.label.toLowerCase() as SubjectiveCheckIn['mood'])}
                      className={`flex flex-col items-center justify-center p-2 sm:p-3 rounded-xl bg-slate-800/50 hover:bg-${item.color}-500/20 border border-slate-700 hover:border-${item.color}-500 transition-all group active:scale-95 ${mood === item.label.toLowerCase() ? `border-${item.color}-500 bg-${item.color}-500/20` : ''}`}
                    >
                      <span className={`material-symbols-outlined text-${item.color}-400 mb-1 group-hover:scale-110 transition-transform text-2xl`}>{item.icon}</span>
                      <span className="text-[10px] sm:text-xs font-medium text-slate-300 group-hover:text-white">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-6">

            {/* Left Column (8/12) */}
            <div className="col-span-12 lg:col-span-8 space-y-6">

              {/* Hero Card: Today's Focus */}
              <div className="bg-slate-900 dark:bg-dark-surface rounded-2xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-700/50 group relative">
                <div className="relative z-10 p-8 flex flex-col justify-between h-full min-h-[380px]">
                  <div className="flex items-center gap-3 mb-6">
                    <span className="bg-primary text-slate-900 text-xs font-black px-3 py-1.5 rounded uppercase tracking-wide">Today's Focus</span>
                    <span className="bg-slate-700/50 backdrop-blur-md text-slate-200 text-xs font-bold px-3 py-1.5 rounded border border-slate-600/50 uppercase tracking-wide">
                      {recommendedWorkout.type === 'recovery' ? 'Recovery' : 'High Intensity'}
                    </span>
                  </div>
                  <div className="mb-4">
                    <h2 className="text-4xl md:text-5xl font-black text-white leading-tight tracking-tight">
                      {recommendedWorkout.name}
                    </h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-6 mb-8 text-slate-300">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-xl font-bold">timer</span>
                      <span className="text-lg font-medium text-white">{recommendedWorkout.totalDuration} mins</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-xl font-bold">monitor_heart</span>
                      <span className="text-lg font-medium text-white">
                        {recommendedWorkout.segments.find(s => s.type === 'main')?.sets?.[0]?.intensity || 'Zone 2'}
                      </span>
                    </div>
                  </div>
                  <div className="max-w-2xl mb-8">
                    <p className="text-slate-300 text-base leading-relaxed">
                      Your readiness score is <strong className="text-white">{recoveryScore}/100</strong>. {aiRecommendation.reason}
                    </p>
                  </div>
                  <div className="w-full border-t border-white/10 my-4"></div>
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 mt-auto">
                    <button className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-primary hover:bg-primary-hover text-slate-900 px-8 py-3.5 rounded-lg font-bold transition-all shadow-lg shadow-green-500/20 whitespace-nowrap text-base">
                      <span className="material-symbols-outlined filled">play_arrow</span>
                      <span>Start Workout</span>
                    </button>
                    <button className="group flex items-center space-x-2 px-4 py-2 rounded-lg bg-transparent border border-white/20 hover:border-white/40 transition-all text-slate-300 hover:text-white">
                      <span className="material-symbols-outlined text-lg">schedule</span>
                      <span className="text-sm font-medium">Short on time?</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Weekly Schedule */}
              <div className="bg-light-surface dark:bg-dark-surface rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700/50">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white">This Week's Training</h3>
                  <div className="bg-slate-100 dark:bg-dark-surface-lighter p-1 rounded-lg flex text-slate-500 dark:text-slate-400">
                    <button className="p-1 rounded bg-white dark:bg-dark-surface shadow-sm text-primary dark:text-primary"><span className="material-symbols-outlined text-sm">calendar_view_week</span></button>
                    <button className="p-1 rounded hover:text-slate-700 dark:hover:text-slate-200"><span className="material-symbols-outlined text-sm">list</span></button>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {weekSchedule.map((day, index) => {
                     if (day.status === 'today') {
                        return (
                            <div key={index} className="flex flex-col gap-2 group cursor-pointer">
                                <div className="text-xs text-primary font-bold text-center uppercase">{day.day}</div>
                                <div className="w-full bg-primary/10 border border-primary rounded-lg p-2 min-h-[90px] flex flex-col justify-between relative overflow-hidden shadow-sm">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>
                                    <span className="text-xs font-bold text-slate-900 dark:text-white pl-2">{day.date}</span>
                                    <div className="flex flex-col gap-1 pl-2">
                                        <span className="text-[11px] leading-tight font-bold text-primary-hover dark:text-primary">{day.type}</span>
                                        <span className="text-[10px] leading-tight text-slate-600 dark:text-slate-300 font-medium">{day.detail}</span>
                                    </div>
                                </div>
                            </div>
                        )
                     }
                     if (day.status === 'rest') {
                        return (
                            <div key={index} className="flex flex-col gap-2 group cursor-pointer">
                                <div className="text-xs text-slate-500 font-medium text-center uppercase">{day.day}</div>
                                <div className="w-full bg-slate-50 dark:bg-dark-surface-lighter rounded-lg p-2 min-h-[90px] flex flex-col justify-between border border-dashed border-slate-300 dark:border-slate-600">
                                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500">{day.date}</span>
                                    <div className="flex items-center justify-center h-full">
                                        <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide font-medium">Rest</span>
                                    </div>
                                </div>
                            </div>
                        )
                     }
                     return (
                        <div key={index} className={`flex flex-col gap-2 group cursor-pointer ${day.status === 'completed' ? 'opacity-60' : ''}`}>
                            <div className="text-xs text-slate-500 font-medium text-center uppercase">{day.day}</div>
                            <div className="w-full bg-slate-50 dark:bg-dark-surface-lighter border border-slate-200 dark:border-slate-700 rounded-lg p-2 min-h-[90px] flex flex-col justify-between hover:border-slate-400 transition-colors relative">
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{day.date}</span>
                                <div className="flex flex-col gap-1">
                                    <span className="text-[11px] leading-tight font-semibold text-slate-700 dark:text-slate-300">{day.type}</span>
                                    <span className="text-[10px] leading-tight text-slate-500">{day.detail}</span>
                                </div>
                                {day.status === 'completed' && (
                                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="material-symbols-outlined text-green-500 text-[16px]">check_circle</span>
                                    </div>
                                )}
                            </div>
                        </div>
                     )
                  })}
                </div>
              </div>
            </div>

            {/* Right Column (4/12) */}
            <div className="col-span-12 lg:col-span-4 space-y-6">

              {/* Recovery Score */}
              <div className="bg-light-surface dark:bg-dark-surface rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700/50 relative overflow-hidden">
                <div className="flex justify-between items-start mb-6 relative z-10">
                  <div>
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white">Recovery Score</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {recoveryScore >= 80 ? 'Primed to perform' : recoveryScore >= 60 ? 'Good to go' : 'Take it easy'}
                    </p>
                  </div>
                  <span className={`${recoveryScore >= 80 ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-orange-500/10 text-orange-600 dark:text-orange-400'} text-xs font-bold px-2 py-1 rounded flex items-center`}>
                    <span className="material-symbols-outlined text-sm mr-0.5">
                      {recoveryScore >= 80 ? 'trending_up' : 'trending_flat'}
                    </span> {recoveryScore >= 80 ? '+5%' : '0%'}
                  </span>
                </div>

                {/* Circular Chart */}
                <div className="relative w-48 h-48 mx-auto mb-8">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                        className="text-slate-100 dark:text-dark-surface-lighter"
                        cx="96" cy="96" fill="transparent" r="80" stroke="currentColor" strokeWidth="12"
                    ></circle>
                    <circle
                        className="text-primary transition-[stroke-dashoffset] duration-350 ease-in-out"
                        cx="96" cy="96" fill="transparent" r="80" stroke="currentColor"
                        strokeDasharray="502"
                        strokeDashoffset={502 - (502 * recoveryScore / 100)}
                        strokeLinecap="round"
                        strokeWidth="12"
                    ></circle>
                  </svg>
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                    <span className="block text-4xl font-black text-slate-900 dark:text-white">{recoveryScore}%</span>
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-1">Ready</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 dark:bg-dark-surface-lighter p-4 rounded-xl">
                    <div className="flex items-center space-x-2 mb-2 text-slate-500 dark:text-slate-400">
                      <span className="material-symbols-outlined text-sm text-rose-500">favorite</span>
                      <span className="text-xs font-bold uppercase">HRV</span>
                    </div>
                    <p className="text-xl font-bold text-slate-900 dark:text-white">{todayStats.hrv.value} <span className="text-sm font-normal text-slate-500">ms</span></p>
                  </div>
                  <div className="bg-slate-50 dark:bg-dark-surface-lighter p-4 rounded-xl">
                    <div className="flex items-center space-x-2 mb-2 text-slate-500 dark:text-slate-400">
                      <span className="material-symbols-outlined text-sm text-indigo-400">dark_mode</span>
                      <span className="text-xs font-bold uppercase">Sleep</span>
                    </div>
                    <p className="text-xl font-bold text-slate-900 dark:text-white">{todayStats.sleep.duration}h {Math.round((todayStats.sleep.duration % 1) * 60)}m</p>
                  </div>
                </div>
              </div>

              {/* Action List */}
              <div className="bg-light-surface dark:bg-dark-surface rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700/50">
                <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-6">Action List</h3>
                <div className="space-y-4">
                  {[
                      { title: "Post-workout Stretch", detail: "15 mins • Mobility focus", icon: "accessibility_new" },
                      { title: "Hydration Goal", detail: "1.2L / 3.0L consumed", icon: "water_drop" },
                      { title: "Log Nutrition", detail: "Lunch pending", icon: "restaurant" }
                  ].map((action, i) => (
                    <div key={i} className="group flex items-center justify-between p-3 -mx-3 rounded-xl hover:bg-slate-50 dark:hover:bg-dark-surface-lighter transition-colors cursor-pointer">
                        <div className="flex items-center space-x-4">
                        <div className="w-6 h-6 rounded border-2 border-slate-300 dark:border-slate-500 group-hover:border-primary transition-colors flex items-center justify-center">
                        </div>
                        <div>
                            <h4 className="font-semibold text-slate-900 dark:text-white text-sm">{action.title}</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{action.detail}</p>
                        </div>
                        </div>
                        <span className="material-symbols-outlined text-slate-400 dark:text-slate-600">{action.icon}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;