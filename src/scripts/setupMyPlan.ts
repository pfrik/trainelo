import { createTexelGoal, generateTrainingPlan } from '@/lib/training';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

async function setupMyTrainingPlan() {
  console.log('🏃 Setting up Texel 60km Training Plan...\n');

  try {
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('❌ Error: You must be logged in to run this script');
      console.log('Please ensure you are authenticated with Supabase first.');
      return;
    }

    console.log(`✅ Authenticated as: ${user.email}\n`);

    // Step 1: Create the Texel goal
    console.log('1️⃣ Creating Texel 60km goal...');
    const goal = await createTexelGoal(user.id);
    console.log(`✅ Goal created: "${goal.title}"`);
    console.log(`   Target date: ${format(new Date(goal.target_date), 'MMMM d, yyyy')}`);
    console.log(`   Target time: ${Math.floor(goal.target_value / 60)}h ${goal.target_value % 60}min\n`);

    // Step 2: Generate the training plan
    console.log('2️⃣ Generating 13-week training plan...');
    const raceDate = new Date(goal.target_date);
    const trainingWeeks = await generateTrainingPlan(goal.id, user.id, raceDate);
    console.log(`✅ Training plan generated with ${trainingWeeks.length} weeks\n`);

    // Step 3: Display the first week of workouts
    console.log('3️⃣ First Week of Training:\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const firstWeek = trainingWeeks[0];
    console.log(`Week 1: ${firstWeek.phase.toUpperCase()} PHASE`);
    console.log(`Total Volume: ${firstWeek.weeklyVolume}km\n`);

    firstWeek.workouts.forEach((workout, index) => {
      const dayOfWeek = format(workout.plannedDate, 'EEEE, MMM d');
      console.log(`${dayOfWeek}:`);
      console.log(`  📍 ${workout.title}`);
      console.log(`  📏 Distance: ${workout.distanceKm}km`);
      console.log(`  ⏱️  Duration: ${workout.durationMinutes}min`);
      console.log(`  💪 Intensity: ${workout.intensityLevel}/10`);
      console.log(`  📝 ${workout.notes}`);
      console.log('');
    });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n✅ Training plan setup complete!');
    console.log('\nYour 13-week journey to Texel 60km begins on:');
    console.log(`📅 ${format(firstWeek.workouts[0].plannedDate, 'MMMM d, yyyy')}\n`);

    // Show a summary of all phases
    console.log('📊 Training Phase Summary:');
    const phaseSummary = trainingWeeks.reduce((acc, week) => {
      const phase = week.phase;
      if (!acc[phase]) {
        acc[phase] = { weeks: [], totalVolume: 0 };
      }
      acc[phase].weeks.push(week.weekNumber);
      acc[phase].totalVolume += week.weeklyVolume;
      return acc;
    }, {} as Record<string, { weeks: number[], totalVolume: number }>);

    Object.entries(phaseSummary).forEach(([phase, data]) => {
      console.log(`   ${phase.toUpperCase()}: Weeks ${data.weeks.join(', ')} (${data.totalVolume}km total)`);
    });

  } catch (error) {
    console.error('❌ Error setting up training plan:', error);
    if (error instanceof Error) {
      console.error('Details:', error.message);
    }
  }
}

// Add instructions for running the script
console.log('═══════════════════════════════════════════════════════════════');
console.log('  TEXEL 60KM TRAINING PLAN SETUP');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('This script will:');
console.log('1. Create your Texel 60km goal for March 29, 2026');
console.log('2. Generate a 13-week periodized training plan');
console.log('3. Show you the first week of workouts\n');

console.log('⚠️  NOTE: You must be logged in to Supabase to run this script.\n');

// Check if we're in a browser environment
if (typeof window !== 'undefined') {
  // In browser - add a function to window for easy execution
  (window as any).setupMyTrainingPlan = setupMyTrainingPlan;

  console.log('To run this script from the browser console:');
  console.log('👉 setupMyTrainingPlan()');
} else {
  // In Node.js environment - run immediately
  setupMyTrainingPlan();
}

export { setupMyTrainingPlan };