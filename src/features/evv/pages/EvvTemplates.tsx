import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardList, FileCog, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { EVV_FORMS, type EvvFormType } from '../catalog';
import {
  type EvvChecklistItemTemplate,
  type EvvFormTemplate,
  type EvvSubtopicTemplate,
  type EvvTopicTemplate,
  loadEvvFormTemplates,
  newTemplateId,
  resetEvvFormTemplates,
  saveEvvFormTemplates,
} from '../templates';

export default function EvvTemplates() {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<EvvFormTemplate[]>(() => loadEvvFormTemplates());
  const [selectedForm, setSelectedForm] = useState<EvvFormType>('safeguard');

  const currentTemplate = useMemo(
    () => templates.find((template) => template.formType === selectedForm) ?? { formType: selectedForm, topics: [] },
    [selectedForm, templates],
  );

  function updateCurrentTemplate(patch: (template: EvvFormTemplate) => EvvFormTemplate) {
    setTemplates((prev) => prev.map((template) => (
      template.formType === selectedForm ? patch(template) : template
    )));
  }

  function addTopic() {
    updateCurrentTemplate((template) => ({
      ...template,
      topics: [
        ...template.topics,
        {
          id: newTemplateId('topic'),
          name: '',
          subtopics: [],
        },
      ],
    }));
  }

  function updateTopic(topicId: string, patch: Partial<EvvTopicTemplate>) {
    updateCurrentTemplate((template) => ({
      ...template,
      topics: template.topics.map((topic) => (
        topic.id === topicId ? { ...topic, ...patch } : topic
      )),
    }));
  }

  function removeTopic(topicId: string) {
    updateCurrentTemplate((template) => ({
      ...template,
      topics: template.topics.filter((topic) => topic.id !== topicId),
    }));
  }

  function addSubtopic(topicId: string) {
    updateCurrentTemplate((template) => ({
      ...template,
      topics: template.topics.map((topic) => (
        topic.id === topicId
          ? {
              ...topic,
              subtopics: [
                ...topic.subtopics,
                { id: newTemplateId('subtopic'), name: '', checklist: [] },
              ],
            }
          : topic
      )),
    }));
  }

  function updateSubtopic(topicId: string, subtopicId: string, patch: Partial<EvvSubtopicTemplate>) {
    updateCurrentTemplate((template) => ({
      ...template,
      topics: template.topics.map((topic) => (
        topic.id === topicId
          ? {
              ...topic,
              subtopics: topic.subtopics.map((subtopic) => (
                subtopic.id === subtopicId ? { ...subtopic, ...patch } : subtopic
              )),
            }
          : topic
      )),
    }));
  }

  function removeSubtopic(topicId: string, subtopicId: string) {
    updateCurrentTemplate((template) => ({
      ...template,
      topics: template.topics.map((topic) => (
        topic.id === topicId
          ? { ...topic, subtopics: topic.subtopics.filter((subtopic) => subtopic.id !== subtopicId) }
          : topic
      )),
    }));
  }

  function addChecklistItem(topicId: string, subtopicId: string) {
    updateCurrentTemplate((template) => ({
      ...template,
      topics: template.topics.map((topic) => (
        topic.id === topicId
          ? {
              ...topic,
              subtopics: topic.subtopics.map((subtopic) => (
                subtopic.id === subtopicId
                  ? {
                      ...subtopic,
                      checklist: [
                        ...subtopic.checklist,
                        { id: newTemplateId('check'), text: '' },
                      ],
                    }
                  : subtopic
              )),
            }
          : topic
      )),
    }));
  }

  function updateChecklistItem(
    topicId: string,
    subtopicId: string,
    itemId: string,
    patch: Partial<EvvChecklistItemTemplate>,
  ) {
    updateCurrentTemplate((template) => ({
      ...template,
      topics: template.topics.map((topic) => (
        topic.id === topicId
          ? {
              ...topic,
              subtopics: topic.subtopics.map((subtopic) => (
                subtopic.id === subtopicId
                  ? {
                      ...subtopic,
                      checklist: subtopic.checklist.map((item) => (
                        item.id === itemId ? { ...item, ...patch } : item
                      )),
                    }
                  : subtopic
              )),
            }
          : topic
      )),
    }));
  }

  function removeChecklistItem(topicId: string, subtopicId: string, itemId: string) {
    updateCurrentTemplate((template) => ({
      ...template,
      topics: template.topics.map((topic) => (
        topic.id === topicId
          ? {
              ...topic,
              subtopics: topic.subtopics.map((subtopic) => (
                subtopic.id === subtopicId
                  ? { ...subtopic, checklist: subtopic.checklist.filter((item) => item.id !== itemId) }
                  : subtopic
              )),
            }
          : topic
      )),
    }));
  }

  function handleSave() {
    saveEvvFormTemplates(templates);
    toast.success(t('evv.templates.saved'));
  }

  function handleResetAll() {
    resetEvvFormTemplates();
    setTemplates(loadEvvFormTemplates());
    toast.success(t('evv.templates.resetDone'));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FileCog}
        title={t('evv.templates.title')}
        description={t('evv.templates.subtitle')}
        actions={(
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleResetAll}>
              <RotateCcw className="h-4 w-4" />
              {t('evv.templates.resetAll')}
            </Button>
            <Button onClick={handleSave}>
              <Save className="h-4 w-4" />
              {t('common.save')}
            </Button>
          </div>
        )}
      />

      <Card>
        <CardContent className="grid gap-4 p-4 md:grid-cols-[320px_1fr]">
          <div className="space-y-2">
            <Label>{t('evv.templates.form')}</Label>
            <Select value={selectedForm} onValueChange={(value) => setSelectedForm(value as EvvFormType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVV_FORMS.map((form) => (
                  <SelectItem key={form.id} value={form.id}>
                    {t(form.titleKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-md border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">
            {t('evv.templates.instructions')}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={addTopic}>
          <Plus className="h-4 w-4" />
          {t('evv.templates.addTopic')}
        </Button>
      </div>

      {currentTemplate.topics.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center text-muted-foreground">
            <ClipboardList className="h-10 w-10" />
            <p>{t('evv.templates.empty')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {currentTemplate.topics.map((topic, topicIndex) => (
            <Card key={topic.id}>
              <CardHeader>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                  <div className="flex-1 space-y-2">
                    <Label>{t('evv.templates.topic')} {topicIndex + 1}</Label>
                    <Input
                      value={topic.name}
                      onChange={(event) => updateTopic(topic.id, { name: event.target.value })}
                      placeholder={t('evv.templates.topicPlaceholder')}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => addSubtopic(topic.id)}>
                      <Plus className="h-4 w-4" />
                      {t('evv.templates.addSubtopic')}
                    </Button>
                    <Button variant="ghost" className="text-destructive" onClick={() => removeTopic(topic.id)}>
                      <Trash2 className="h-4 w-4" />
                      {t('common.delete')}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {topic.subtopics.length === 0 ? (
                  <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    {t('evv.templates.noSubtopics')}
                  </div>
                ) : (
                  topic.subtopics.map((subtopic, subtopicIndex) => (
                    <div key={subtopic.id} className="rounded-md border p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                        <div className="flex-1 space-y-2">
                          <Label>{t('evv.templates.subtopic')} {subtopicIndex + 1}</Label>
                          <Input
                            value={subtopic.name}
                            onChange={(event) => updateSubtopic(topic.id, subtopic.id, { name: event.target.value })}
                            placeholder={t('evv.templates.subtopicPlaceholder')}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" onClick={() => addChecklistItem(topic.id, subtopic.id)}>
                            <Plus className="h-4 w-4" />
                            {t('evv.templates.addChecklistItem')}
                          </Button>
                          <Button variant="ghost" className="text-destructive" onClick={() => removeSubtopic(topic.id, subtopic.id)}>
                            <Trash2 className="h-4 w-4" />
                            {t('common.delete')}
                          </Button>
                        </div>
                      </div>

                      <Separator className="my-4" />

                      <div className="space-y-3">
                        {subtopic.checklist.length === 0 ? (
                          <p className="text-sm text-muted-foreground">{t('evv.templates.noChecklist')}</p>
                        ) : (
                          subtopic.checklist.map((item, itemIndex) => (
                            <div key={item.id} className="flex gap-2">
                              <Input
                                value={item.text}
                                onChange={(event) => updateChecklistItem(topic.id, subtopic.id, item.id, { text: event.target.value })}
                                placeholder={`${t('evv.templates.checklistItem')} ${itemIndex + 1}`}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="shrink-0 text-destructive"
                                onClick={() => removeChecklistItem(topic.id, subtopic.id, item.id)}
                                aria-label={t('common.delete')}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
