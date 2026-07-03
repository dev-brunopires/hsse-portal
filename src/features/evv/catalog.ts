// eV&V form catalogs based on the All Safe functional specification.
// The app stores answers as generic ratings, while each form owns its own questions.

export type Rating = 'effective' | 'not_effective' | 'not_assessed';

export interface EvvQuestion {
  id: string;
  text: string;
  guidance?: string;
  deficiencies?: string[]; // shown when rating === 'not_effective'
}

export interface EvvCategory {
  id: string;
  name: string;
  isLSR?: boolean;
  questions: EvvQuestion[];
}

export type EvvFormType =
  | 'safeguard'
  | 'leaders_engagement'
  | 'workers_engagement'
  | 'tlo'
  | 'aar';

export const EVV_FORMS: { id: EvvFormType; titleKey: string; descKey: string }[] = [
  { id: 'safeguard', titleKey: 'evv.forms.safeguard.title', descKey: 'evv.forms.safeguard.desc' },
  { id: 'leaders_engagement', titleKey: 'evv.forms.leaders.title', descKey: 'evv.forms.leaders.desc' },
  { id: 'workers_engagement', titleKey: 'evv.forms.workers.title', descKey: 'evv.forms.workers.desc' },
  { id: 'tlo', titleKey: 'evv.forms.tlo.title', descKey: 'evv.forms.tlo.desc' },
  { id: 'aar', titleKey: 'evv.forms.aar.title', descKey: 'evv.forms.aar.desc' },
];

const CONTROL_DEFICIENCIES = [
  'Procedure, method statement, or permit does not match the work being performed',
  'Critical control is missing, incomplete, or not verified at the worksite',
  'Team cannot explain the hazard, control, or stop-work condition',
  'Required equipment, barrier, tool, or PPE is not available or fit for use',
  'Supervision, handover, or contractor interface is weak',
  'Other gap observed at the worksite',
];

const ENGAGEMENT_DEFICIENCIES = [
  'Engagement was not performed at the worksite',
  'Discussion stayed generic and did not test understanding',
  'Leader did not verify critical controls in the field',
  'Team concerns or weak signals were not explored',
  'Actions were not assigned clearly',
  'Other leadership engagement gap',
];

const WORKER_DEFICIENCIES = [
  'Worker could not explain the task scope or main hazard',
  'Critical control or safeguard was not understood',
  'Stop-work authority was unclear or not reinforced',
  'Toolbox talk or JSA was not understood by the team',
  'Contractor/vendor expectations were not aligned with SBM requirements',
  'Other worker engagement gap',
];

const LEARNING_DEFICIENCIES = [
  'Expected behavior or control was not observed',
  'Local condition is driving deviation from the expected practice',
  'Procedure does not reflect field reality',
  'Learning is not being captured or shared',
  'Action is needed before the topic can be considered effective',
  'Other learning gap',
];

const AAR_DEFICIENCIES = [
  'Outcome differed from the plan or expectation',
  'HSSE controls were only partially effective',
  'Roles, communication, or handover were unclear',
  'Tools, resources, permits, or access were inadequate',
  'Contractor/client interface created friction or risk',
  'Lesson learned requires follow-up action',
];

const SAFEGUARD_CATEGORIES: EvvCategory[] = [
  {
    id: 'breaking_containment',
    name: 'Breaking Containment',
    isLSR: true,
    questions: [
      {
        id: 'bc_1',
        text: 'Work pack, permit, isolation plan, and contingency controls match the containment break scope',
        deficiencies: CONTROL_DEFICIENCIES,
      },
      {
        id: 'bc_2',
        text: 'Line contents, pressure, drains, vents, spill containment, and environmental controls were verified before opening',
        deficiencies: CONTROL_DEFICIENCIES,
      },
    ],
  },
  {
    id: 'bypassing_safety_controls',
    name: 'Bypassing Safety Controls (LSR)',
    isLSR: true,
    questions: [
      {
        id: 'bsc_1',
        text: 'Authorization is obtained before disabling or overriding safety controls',
        deficiencies: [
          'No formal authorization for bypass or override',
          'Compensatory measures are not defined or not in place',
          'Bypass is not tracked in the management system',
          'Restoration of controls is not verified after work',
        ],
      },
    ],
  },
  {
    id: 'confined_space',
    name: 'Confined Space (LSR)',
    isLSR: true,
    questions: [
      {
        id: 'cs_1',
        text: 'Energy sources are isolated and verified before entry',
        deficiencies: [
          'Energy isolation not verified before entry',
          'Lock-out / tag-out not applied as required',
          'Stored energy not dissipated',
          'Isolation plan not signed off by authorized person',
        ],
      },
      {
        id: 'cs_2',
        text: 'Atmosphere has been tested and continuous monitoring is in place where required',
        deficiencies: [
          'Pre-entry gas test not performed',
          'Continuous monitoring not in place during work',
          'Gas detector not calibrated or out of service',
          'Action levels and evacuation criteria not communicated',
        ],
      },
      {
        id: 'cs_3',
        text: 'Rescue plan, standby person, communications, and breathing apparatus are ready when required',
        deficiencies: CONTROL_DEFICIENCIES,
      },
    ],
  },
  {
    id: 'driving',
    name: 'Driving (LSR)',
    isLSR: true,
    questions: [
      {
        id: 'drv_1',
        text: 'Journey, vehicle, driver fitness, seat belt use, and local driving controls are verified',
        deficiencies: CONTROL_DEFICIENCIES,
      },
    ],
  },
  {
    id: 'energy_deisolation',
    name: 'Energy de-isolation and re-energizing',
    isLSR: true,
    questions: [
      {
        id: 'edr_1',
        text: 'Area is clear, stakeholders are notified, and authorization is in place before re-energizing',
        deficiencies: CONTROL_DEFICIENCIES,
      },
    ],
  },
  {
    id: 'energy_isolation',
    name: 'Energy Isolation (LSR)',
    isLSR: true,
    questions: [
      {
        id: 'ei_1',
        text: 'All energy sources are identified, isolated, locked/tagged, and tested for zero energy',
        deficiencies: CONTROL_DEFICIENCIES,
      },
    ],
  },
  {
    id: 'hot_work',
    name: 'Hot Work (LSR)',
    isLSR: true,
    questions: [
      {
        id: 'hw_1',
        text: 'A valid Hot Work permit is in place at the work location',
        deficiencies: [
          'No valid Hot Work permit at the location',
          'Permit scope does not cover the actual task',
          'Permit conditions not communicated to workers',
        ],
      },
      {
        id: 'hw_2',
        text: 'Flammables are removed or isolated, gas testing is valid, fire watch is assigned, and firefighting equipment is ready',
        deficiencies: [
          'Flammable and combustible materials have not been identified, isolated, or removed',
          'A trained Fire Watch is not designated or not at the work location',
          'Firefighting equipment is not inspected, functional, or available',
          'Hot Work authorization has not been completed per requirements',
        ],
      },
    ],
  },
  ...[
    'Working at Height',
    'Line of Fire',
    'Lifting Operations',
    'Management of Change',
    'Permit to Work',
    'Personal Protective Equipment',
    'Housekeeping / Access and Egress',
    'Mechanical Lifting Below the Hook',
    'Pressure Testing',
    'Excavation',
    'Diving Operations',
    'Marine Operations',
  ].map<EvvCategory>((name, i) => ({
    id: `sg_${i + 8}`,
    name: `${name} (LSR)`,
    isLSR: true,
    questions: [
      {
        id: `sg_${i + 8}_q1`,
        text: `Critical controls for ${name} are in place, understood, and effective`,
        deficiencies: CONTROL_DEFICIENCIES,
      },
    ],
  })),
];

const LEADERS_CATEGORIES: EvvCategory[] = [
  {
    id: 'leadership_presence',
    name: 'Leadership presence',
    questions: [
      {
        id: 'le_presence_1',
        text: 'Leader was present at the worksite and engaged with the team before or during the task',
        deficiencies: ENGAGEMENT_DEFICIENCIES,
      },
      {
        id: 'le_presence_2',
        text: 'Leader discussed HSSE expectations, recent campaigns, or relevant learnings with the team',
        deficiencies: ENGAGEMENT_DEFICIENCIES,
      },
    ],
  },
  {
    id: 'control_verification',
    name: 'Control verification',
    questions: [
      {
        id: 'le_control_1',
        text: 'Leader verified hazards, PTW/JSA quality, and critical controls in the field',
        deficiencies: ENGAGEMENT_DEFICIENCIES,
      },
      {
        id: 'le_control_2',
        text: 'Leader checked contractor/client/vendor interface risks where applicable',
        deficiencies: ENGAGEMENT_DEFICIENCIES,
      },
    ],
  },
  {
    id: 'coaching_and_intervention',
    name: 'Coaching and intervention',
    questions: [
      {
        id: 'le_coach_1',
        text: 'Leader asked open questions and listened for weak signals, concerns, or production pressure',
        deficiencies: ENGAGEMENT_DEFICIENCIES,
      },
      {
        id: 'le_coach_2',
        text: 'Leader recognized safe behavior or challenged unsafe behavior with clear follow-up',
        deficiencies: ENGAGEMENT_DEFICIENCIES,
      },
    ],
  },
];

const WORKERS_CATEGORIES: EvvCategory[] = [
  {
    id: 'task_understanding',
    name: 'Task understanding',
    questions: [
      {
        id: 'we_task_1',
        text: 'Workers can explain the task scope and what could go wrong',
        guidance: 'Suggested prompt: What is the highest risk in this task?',
        deficiencies: WORKER_DEFICIENCIES,
      },
      {
        id: 'we_task_2',
        text: 'Workers understand the JSA/toolbox talk and actively participated in it',
        deficiencies: WORKER_DEFICIENCIES,
      },
    ],
  },
  {
    id: 'control_understanding',
    name: 'Control understanding',
    questions: [
      {
        id: 'we_control_1',
        text: 'Workers can name the critical control or safeguard protecting them from the main hazard',
        guidance: 'Suggested prompt: What control protects you from that risk?',
        deficiencies: WORKER_DEFICIENCIES,
      },
      {
        id: 'we_control_2',
        text: 'Workers are following the agreed method and using the required equipment/PPE',
        deficiencies: WORKER_DEFICIENCIES,
      },
    ],
  },
  {
    id: 'speak_up',
    name: 'Speak up and stop work',
    questions: [
      {
        id: 'we_stop_1',
        text: 'Workers understand stop-work authority and when they should stop the job',
        guidance: 'Suggested prompt: When would you stop the job?',
        deficiencies: WORKER_DEFICIENCIES,
      },
      {
        id: 'we_stop_2',
        text: 'Workers feel comfortable raising concerns with SBM, contractor, or client leadership',
        deficiencies: WORKER_DEFICIENCIES,
      },
    ],
  },
];

const TLO_CATEGORIES: EvvCategory[] = [
  {
    id: 'learning_focus',
    name: 'Learning focus',
    questions: [
      {
        id: 'tlo_focus_1',
        text: 'Observation topic, campaign, trend, recent event, or audit finding is clear',
        deficiencies: LEARNING_DEFICIENCIES,
      },
      {
        id: 'tlo_focus_2',
        text: 'Expected behavior or control for the topic was visible at the worksite',
        deficiencies: LEARNING_DEFICIENCIES,
      },
    ],
  },
  {
    id: 'field_reality',
    name: 'Field reality',
    questions: [
      {
        id: 'tlo_field_1',
        text: 'Local conditions such as SIMOPS, access, weather, staffing, tools, or schedule pressure support safe execution',
        deficiencies: LEARNING_DEFICIENCIES,
      },
      {
        id: 'tlo_field_2',
        text: 'There is no significant gap between procedure and how the work is actually performed',
        deficiencies: LEARNING_DEFICIENCIES,
      },
    ],
  },
  {
    id: 'learning_transfer',
    name: 'Learning transfer',
    questions: [
      {
        id: 'tlo_transfer_1',
        text: 'Learning can be shared with other sites, FPSOs, projects, or departments',
        deficiencies: LEARNING_DEFICIENCIES,
      },
      {
        id: 'tlo_transfer_2',
        text: 'Recommended action is clear: share learning, coach team, update procedure, or escalate risk',
        deficiencies: LEARNING_DEFICIENCIES,
      },
    ],
  },
];

const AAR_CATEGORIES: EvvCategory[] = [
  {
    id: 'plan_vs_actual',
    name: 'Plan versus actual',
    questions: [
      {
        id: 'aar_plan_1',
        text: 'What was expected to happen was clear to everyone involved',
        deficiencies: AAR_DEFICIENCIES,
      },
      {
        id: 'aar_plan_2',
        text: 'Actual execution matched the plan without significant unplanned deviation',
        deficiencies: AAR_DEFICIENCIES,
      },
    ],
  },
  {
    id: 'control_effectiveness',
    name: 'Control effectiveness',
    questions: [
      {
        id: 'aar_control_1',
        text: 'HSSE controls were effective during the activity, event, drill, shutdown, or SIMOPS',
        deficiencies: AAR_DEFICIENCIES,
      },
      {
        id: 'aar_control_2',
        text: 'Roles, communication, handovers, tools, access, and resources supported safe delivery',
        deficiencies: AAR_DEFICIENCIES,
      },
    ],
  },
  {
    id: 'actions_and_lessons',
    name: 'Actions and lessons',
    questions: [
      {
        id: 'aar_lesson_1',
        text: 'What went well and what did not go as planned were captured with enough detail',
        deficiencies: AAR_DEFICIENCIES,
      },
      {
        id: 'aar_lesson_2',
        text: 'Follow-up action owner, due date, and learning transfer need are clear where required',
        deficiencies: AAR_DEFICIENCIES,
      },
    ],
  },
];

export const EVV_FORM_CATALOGS: Record<EvvFormType, EvvCategory[]> = {
  safeguard: SAFEGUARD_CATEGORIES,
  leaders_engagement: LEADERS_CATEGORIES,
  workers_engagement: WORKERS_CATEGORIES,
  tlo: TLO_CATEGORIES,
  aar: AAR_CATEGORIES,
};

export const EVV_CATEGORIES = SAFEGUARD_CATEGORIES;

export function getEvvCategories(formType: EvvFormType): EvvCategory[] {
  return EVV_FORM_CATALOGS[formType] ?? SAFEGUARD_CATEGORIES;
}
