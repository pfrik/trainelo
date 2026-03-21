/**
 * Static workout template library.
 * No database — templates are versioned in code for V1.
 */

// ============================================================================
// Types
// ============================================================================

export interface WorkoutSet {
  duration_display: string;
  intensity_label: string;
  description: string;
}

export interface WorkoutSegment {
  type: "warmup" | "main" | "cooldown";
  duration_minutes: number;
  description: string;
  target_intensity: number | null;
  sets: WorkoutSet[];
}

export interface WorkoutTemplate {
  template_ref: string;
  label: string;
  type: "easy" | "recovery" | "tempo" | "long" | "interval" | "strength" | "mobility";
  total_duration_minutes: number;
  segments: WorkoutSegment[];
  target_km: number | null;
  description: string;
  rpe_target: number;
}

// ============================================================================
// Template Definitions
// ============================================================================

export const TEMPLATES: WorkoutTemplate[] = [
  {
    template_ref: "easy-run-30min",
    label: "Easy Run (30 min)",
    type: "easy",
    total_duration_minutes: 30,
    segments: [
      {
        type: "warmup",
        duration_minutes: 5,
        description: "Walk to easy jog, dynamic stretches",
        target_intensity: 40,
        sets: [],
      },
      {
        type: "main",
        duration_minutes: 20,
        description: "Easy conversational pace",
        target_intensity: 55,
        sets: [
          {
            duration_display: "20 min",
            intensity_label: "Zone 2",
            description: "Steady easy pace — you should be able to hold a conversation",
          },
        ],
      },
      {
        type: "cooldown",
        duration_minutes: 5,
        description: "Slow jog to walk, static stretches",
        target_intensity: 30,
        sets: [],
      },
    ],
    target_km: 4.5,
    description: "Easy aerobic run to build base fitness without accumulating fatigue.",
    rpe_target: 4,
  },
  {
    template_ref: "recovery-jog-20min",
    label: "Recovery Jog (20 min)",
    type: "recovery",
    total_duration_minutes: 20,
    segments: [
      {
        type: "warmup",
        duration_minutes: 5,
        description: "Brisk walk",
        target_intensity: 30,
        sets: [],
      },
      {
        type: "main",
        duration_minutes: 10,
        description: "Very easy shuffle/jog",
        target_intensity: 40,
        sets: [
          {
            duration_display: "10 min",
            intensity_label: "Zone 1",
            description: "Very easy — slower than you think; this is active recovery",
          },
        ],
      },
      {
        type: "cooldown",
        duration_minutes: 5,
        description: "Walk, gentle stretching",
        target_intensity: 25,
        sets: [],
      },
    ],
    target_km: 2.5,
    description: "Light active recovery to promote blood flow without adding training stress.",
    rpe_target: 2,
  },
  {
    template_ref: "tempo-run-45min",
    label: "Tempo Run (45 min)",
    type: "tempo",
    total_duration_minutes: 45,
    segments: [
      {
        type: "warmup",
        duration_minutes: 10,
        description: "Easy jog building to moderate pace",
        target_intensity: 50,
        sets: [],
      },
      {
        type: "main",
        duration_minutes: 25,
        description: "Sustained tempo effort",
        target_intensity: 75,
        sets: [
          {
            duration_display: "25 min",
            intensity_label: "Zone 3-4",
            description: "Comfortably hard — you can speak in short phrases but not full sentences",
          },
        ],
      },
      {
        type: "cooldown",
        duration_minutes: 10,
        description: "Easy jog, static stretches",
        target_intensity: 40,
        sets: [],
      },
    ],
    target_km: 7.5,
    description: "Sustained threshold effort to improve lactate clearance and race pace.",
    rpe_target: 7,
  },
  {
    template_ref: "long-run-90min",
    label: "Long Run (90 min)",
    type: "long",
    total_duration_minutes: 90,
    segments: [
      {
        type: "warmup",
        duration_minutes: 10,
        description: "Easy pace, gradual ramp-up",
        target_intensity: 45,
        sets: [],
      },
      {
        type: "main",
        duration_minutes: 70,
        description: "Steady aerobic effort",
        target_intensity: 60,
        sets: [
          {
            duration_display: "70 min",
            intensity_label: "Zone 2",
            description: "Steady, relaxed pace — focus on time on feet over speed",
          },
        ],
      },
      {
        type: "cooldown",
        duration_minutes: 10,
        description: "Slow jog to walk, full-body stretching",
        target_intensity: 35,
        sets: [],
      },
    ],
    target_km: 15,
    description: "Endurance-building long run to improve aerobic capacity and mental resilience.",
    rpe_target: 5,
  },
  {
    template_ref: "interval-8x400",
    label: "Intervals (8x400m)",
    type: "interval",
    total_duration_minutes: 50,
    segments: [
      {
        type: "warmup",
        duration_minutes: 10,
        description: "Easy jog, dynamic drills, 2-3 strides",
        target_intensity: 50,
        sets: [],
      },
      {
        type: "main",
        duration_minutes: 30,
        description: "8x400m with 200m recovery jog",
        target_intensity: 85,
        sets: [
          {
            duration_display: "8 x 400m",
            intensity_label: "Zone 5",
            description: "Hard but controlled — aim for consistent lap times across all reps",
          },
          {
            duration_display: "200m jog",
            intensity_label: "Recovery",
            description: "Slow jog between reps, breathe and reset",
          },
        ],
      },
      {
        type: "cooldown",
        duration_minutes: 10,
        description: "Easy jog, static stretches",
        target_intensity: 40,
        sets: [],
      },
    ],
    target_km: 8,
    description: "Speed intervals to develop VO2max and running economy.",
    rpe_target: 8,
  },
  {
    template_ref: "strength-lower-45min",
    label: "Lower Body Strength (45 min)",
    type: "strength",
    total_duration_minutes: 45,
    segments: [
      {
        type: "warmup",
        duration_minutes: 8,
        description: "Foam rolling, activation drills, bodyweight squats",
        target_intensity: 35,
        sets: [],
      },
      {
        type: "main",
        duration_minutes: 30,
        description: "Lower body compound movements",
        target_intensity: 70,
        sets: [
          {
            duration_display: "3 x 10",
            intensity_label: "Moderate",
            description: "Squats — controlled tempo, full depth",
          },
          {
            duration_display: "3 x 10/side",
            intensity_label: "Moderate",
            description: "Bulgarian split squats",
          },
          {
            duration_display: "3 x 12",
            intensity_label: "Moderate",
            description: "Romanian deadlifts",
          },
          {
            duration_display: "3 x 15",
            intensity_label: "Light",
            description: "Calf raises",
          },
        ],
      },
      {
        type: "cooldown",
        duration_minutes: 7,
        description: "Static stretching, hip flexor and hamstring focus",
        target_intensity: 20,
        sets: [],
      },
    ],
    target_km: null,
    description: "Strength session targeting legs, glutes, and core for injury prevention and power.",
    rpe_target: 6,
  },
  {
    template_ref: "mobility-20min",
    label: "Mobility & Stretching (20 min)",
    type: "mobility",
    total_duration_minutes: 20,
    segments: [
      {
        type: "warmup",
        duration_minutes: 3,
        description: "Light walking or marching in place",
        target_intensity: 20,
        sets: [],
      },
      {
        type: "main",
        duration_minutes: 15,
        description: "Full-body mobility flow",
        target_intensity: 25,
        sets: [
          {
            duration_display: "15 min",
            intensity_label: "Very light",
            description: "Hip circles, thoracic rotations, hamstring slides, ankle mobility, cat-cow",
          },
        ],
      },
      {
        type: "cooldown",
        duration_minutes: 2,
        description: "Deep breathing, relaxation",
        target_intensity: 10,
        sets: [],
      },
    ],
    target_km: null,
    description: "Gentle mobility work to maintain range of motion and aid recovery.",
    rpe_target: 2,
  },
];
