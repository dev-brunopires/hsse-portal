import type { EvvCategory, EvvFormType } from './catalog';

export interface EvvChecklistItemTemplate {
  id: string;
  text: string;
}

export interface EvvSubtopicTemplate {
  id: string;
  name: string;
  checklist: EvvChecklistItemTemplate[];
}

export interface EvvTopicTemplate {
  id: string;
  name: string;
  subtopics: EvvSubtopicTemplate[];
}

export interface EvvFormTemplate {
  formType: EvvFormType;
  topics: EvvTopicTemplate[];
}

const STORAGE_KEY = 'hsse-connect:evv-form-templates:v1';

const FORM_TYPES: EvvFormType[] = [
  'safeguard',
  'leaders_engagement',
  'workers_engagement',
  'tlo',
  'aar',
];

function createEmptyTemplates(): EvvFormTemplate[] {
  return FORM_TYPES.map((formType) => ({ formType, topics: [] }));
}

function normalizeTemplates(value: unknown): EvvFormTemplate[] {
  const source = Array.isArray(value) ? value : [];
  const byType = new Map<EvvFormType, EvvFormTemplate>();

  for (const template of source) {
    if (!template || typeof template !== 'object') continue;
    const item = template as Partial<EvvFormTemplate>;
    if (!item.formType || !FORM_TYPES.includes(item.formType)) continue;
    byType.set(item.formType, {
      formType: item.formType,
      topics: Array.isArray(item.topics) ? item.topics : [],
    });
  }

  return FORM_TYPES.map((formType) => byType.get(formType) ?? { formType, topics: [] });
}

export function loadEvvFormTemplates(): EvvFormTemplate[] {
  if (typeof window === 'undefined') return createEmptyTemplates();

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return createEmptyTemplates();

  try {
    return normalizeTemplates(JSON.parse(raw));
  } catch {
    return createEmptyTemplates();
  }
}

export function saveEvvFormTemplates(templates: EvvFormTemplate[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeTemplates(templates)));
  window.dispatchEvent(new CustomEvent('evv-templates-updated'));
}

export function resetEvvFormTemplates() {
  saveEvvFormTemplates(createEmptyTemplates());
}

export function getEvvFormTemplate(formType: EvvFormType): EvvFormTemplate {
  return loadEvvFormTemplates().find((template) => template.formType === formType) ?? { formType, topics: [] };
}

export function getEvvTemplateCounts(formType: EvvFormType) {
  const template = getEvvFormTemplate(formType);
  const topics = template.topics.length;
  const subtopics = template.topics.reduce((sum, topic) => sum + topic.subtopics.length, 0);
  const checklist = template.topics.reduce(
    (sum, topic) => sum + topic.subtopics.reduce((inner, subtopic) => inner + subtopic.checklist.length, 0),
    0,
  );
  return { topics, subtopics, checklist };
}

export function evvTemplateToCategories(formType: EvvFormType): EvvCategory[] {
  return getEvvFormTemplate(formType).topics
    .filter((topic) => topic.name.trim())
    .map((topic, topicIndex) => ({
      id: topic.id || `${formType}_topic_${topicIndex + 1}`,
      name: topic.name.trim(),
      questions: topic.subtopics.flatMap((subtopic, subtopicIndex) => (
        subtopic.checklist
          .filter((item) => item.text.trim())
          .map((item, itemIndex) => ({
            id: item.id || `${formType}_${topicIndex + 1}_${subtopicIndex + 1}_${itemIndex + 1}`,
            text: item.text.trim(),
            guidance: subtopic.name.trim(),
          }))
      )),
    }))
    .filter((topic) => topic.questions.length > 0);
}

export function newTemplateId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
