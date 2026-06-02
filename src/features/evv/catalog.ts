// eV&V catalog of categories and questions (based on All Safe spec).
// Three required LSR categories are fully populated; remaining 14 are scaffolded.

export type Rating = 'effective' | 'not_effective' | 'not_assessed';

export interface EvvQuestion {
  id: string;
  text: string;
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

const GENERIC_DEFICIENCIES = [
  'Procedure not followed as designed',
  'Insufficient training or competence',
  'Equipment not available or not functional',
  'Supervision or oversight gap',
  'Communication breakdown between teams',
];

export const EVV_CATEGORIES: EvvCategory[] = [
  {
    id: 'confined_space',
    name: 'Confined Space (LSR)',
    isLSR: true,
    questions: [
      {
        id: 'cs_1',
        text: 'Confirm energy sources are isolated',
        deficiencies: [
          'Energy isolation not verified before entry',
          'Lock-out / tag-out not applied as required',
          'Stored energy (pressure, mechanical, electrical) not dissipated',
          'Isolation plan not signed off by authorized person',
        ],
      },
      {
        id: 'cs_2',
        text: 'Confirm the atmosphere has been tested and is monitored',
        deficiencies: [
          'Pre-entry gas test not performed',
          'Continuous monitoring not in place during work',
          'Gas detector not calibrated or out of service',
          'Action levels and evacuation criteria not communicated',
        ],
      },
      {
        id: 'cs_3',
        text: 'Verify workers check and use a breathing apparatus when required',
        deficiencies: [
          'Breathing apparatus not available at the work site',
          'Workers not trained on the breathing apparatus in use',
          'Pre-use inspection of BA not performed',
          'Rescue plan and standby person not in place',
        ],
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
          'No formal authorization for bypass / override',
          'Compensatory measures not defined or not in place',
          'Bypass not tracked in the management system',
          'Restoration of controls not verified after work',
        ],
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
        text: 'Before starting any hot work: Workers confirm flammable material has been removed or isolated, Workers obtain authorization',
        deficiencies: [
          'Potential flammable and combustible materials have not been identified, isolated and removed as appropriate',
          'A trained Fire Watch has not been designated and/or is not at the work location',
          'Firefighting equipment is not inspected, fully functional, and/or is not available if needed',
          'Work authorization for Hot Work has not been completed per Company requirements',
        ],
      },
    ],
  },
  ...['Working at Height', 'Line of Fire', 'Driving Safety', 'Lifting Operations',
      'Energy Isolation (LOTO)', 'Management of Change', 'Permit to Work',
      'Personal Protective Equipment', 'Housekeeping', 'Mechanical Lifting Below the Hook',
      'Pressure Testing', 'Excavation', 'Diving Operations', 'Marine Operations']
    .map<EvvCategory>((name, i) => ({
      id: `cat_${i + 4}`,
      name: `${name} (LSR)`,
      isLSR: true,
      questions: [
        {
          id: `cat_${i + 4}_q1`,
          text: `Critical controls for ${name} are in place and effective`,
          deficiencies: GENERIC_DEFICIENCIES,
        },
      ],
    })),
];
