import type { TFunction } from 'i18next';
import type { EvvCategory, EvvQuestion } from './catalog';

type LocaleText = { pt: string; en: string };

const CATEGORY_TEXT: Record<string, LocaleText> = {
  breaking_containment: { pt: 'Quebra de Contencao', en: 'Breaking Containment' },
  bypassing_safety_controls: { pt: 'Bypass de Controles de Seguranca (LSR)', en: 'Bypassing Safety Controls (LSR)' },
  confined_space: { pt: 'Espaco Confinado (LSR)', en: 'Confined Space (LSR)' },
  driving: { pt: 'Conducao de Veiculos (LSR)', en: 'Driving (LSR)' },
  energy_deisolation: { pt: 'Desisolamento e Reenergizacao', en: 'Energy De-isolation and Re-energizing' },
  energy_isolation: { pt: 'Isolamento de Energia (LSR)', en: 'Energy Isolation (LSR)' },
  hot_work: { pt: 'Trabalho a Quente (LSR)', en: 'Hot Work (LSR)' },
  sg_8: { pt: 'Trabalho em Altura (LSR)', en: 'Working at Height (LSR)' },
  sg_9: { pt: 'Linha de Fogo (LSR)', en: 'Line of Fire (LSR)' },
  sg_10: { pt: 'Operacoes de Icamento (LSR)', en: 'Lifting Operations (LSR)' },
  sg_11: { pt: 'Gestao de Mudancas (LSR)', en: 'Management of Change (LSR)' },
  sg_12: { pt: 'Permissao de Trabalho (LSR)', en: 'Permit to Work (LSR)' },
  sg_13: { pt: 'Equipamento de Protecao Individual (LSR)', en: 'Personal Protective Equipment (LSR)' },
  sg_14: { pt: 'Organizacao, Limpeza / Acesso e Saida (LSR)', en: 'Housekeeping / Access and Egress (LSR)' },
  sg_15: { pt: 'Icamento Mecanico Abaixo do Gancho (LSR)', en: 'Mechanical Lifting Below the Hook (LSR)' },
  sg_16: { pt: 'Teste de Pressao (LSR)', en: 'Pressure Testing (LSR)' },
  sg_17: { pt: 'Escavacao (LSR)', en: 'Excavation (LSR)' },
  sg_18: { pt: 'Operacoes de Mergulho (LSR)', en: 'Diving Operations (LSR)' },
  sg_19: { pt: 'Operacoes Maritimas (LSR)', en: 'Marine Operations (LSR)' },
  leadership_presence: { pt: 'Presenca da lideranca', en: 'Leadership Presence' },
  control_verification: { pt: 'Verificacao de controles', en: 'Control Verification' },
  coaching_and_intervention: { pt: 'Orientacao e intervencao', en: 'Coaching and Intervention' },
  task_understanding: { pt: 'Entendimento da tarefa', en: 'Task Understanding' },
  control_understanding: { pt: 'Entendimento dos controles', en: 'Control Understanding' },
  speak_up: { pt: 'Falar abertamente e parar o trabalho', en: 'Speak Up and Stop Work' },
  learning_focus: { pt: 'Foco do aprendizado', en: 'Learning Focus' },
  field_reality: { pt: 'Realidade de campo', en: 'Field Reality' },
  learning_transfer: { pt: 'Transferencia de aprendizado', en: 'Learning Transfer' },
  plan_vs_actual: { pt: 'Planejado versus realizado', en: 'Plan versus Actual' },
  control_effectiveness: { pt: 'Efetividade dos controles', en: 'Control Effectiveness' },
  actions_and_lessons: { pt: 'Acoes e licoes aprendidas', en: 'Actions and Lessons Learned' },
};

const QUESTION_TEXT: Record<string, LocaleText> = {
  bc_1: {
    pt: 'Pacote de trabalho, permissao, plano de isolamento e controles de contingencia correspondem ao escopo da quebra de contencao',
    en: 'Work pack, permit, isolation plan and contingency controls match the breaking-containment scope',
  },
  bc_2: {
    pt: 'Conteudo da linha, pressao, drenos, respiros, contencao de derrames e controles ambientais foram verificados antes da abertura',
    en: 'Line contents, pressure, drains, vents, spill containment and environmental controls were verified before opening',
  },
  bsc_1: {
    pt: 'Autorizacao foi obtida antes de desabilitar ou sobrescrever controles de seguranca',
    en: 'Authorization was obtained before disabling or overriding safety controls',
  },
  cs_1: {
    pt: 'Fontes de energia foram isoladas e verificadas antes da entrada',
    en: 'Energy sources were isolated and verified before entry',
  },
  cs_2: {
    pt: 'Atmosfera foi testada e o monitoramento continuo esta implementado quando requerido',
    en: 'Atmosphere was tested and continuous monitoring is in place when required',
  },
  cs_3: {
    pt: 'Plano de resgate, vigia, comunicacao e equipamento respiratorio estao prontos quando requeridos',
    en: 'Rescue plan, standby person, communication and respiratory equipment are ready when required',
  },
  drv_1: {
    pt: 'Trajeto, veiculo, aptidao do motorista, uso de cinto e controles locais de direcao foram verificados',
    en: 'Route, vehicle, driver fitness, seatbelt use and local driving controls were verified',
  },
  edr_1: {
    pt: 'Area esta liberada, partes interessadas foram notificadas e autorizacao esta vigente antes da reenergizacao',
    en: 'Area is clear, stakeholders are notified and authorization is in place before re-energizing',
  },
  ei_1: {
    pt: 'Todas as fontes de energia foram identificadas, isoladas, bloqueadas/etiquetadas e testadas para energia zero',
    en: 'All energy sources were identified, isolated, locked/tagged and tested for zero energy',
  },
  hw_1: {
    pt: 'Uma Permissao de Trabalho a Quente valida esta disponivel no local',
    en: 'A valid Hot Work Permit is available at the worksite',
  },
  hw_2: {
    pt: 'Inflamaveis foram removidos ou isolados, teste de gas esta valido, vigia de fogo foi designado e equipamentos de combate a incendio estao prontos',
    en: 'Flammables were removed or isolated, gas test is valid, fire watch is assigned and firefighting equipment is ready',
  },
  le_presence_1: {
    pt: 'Lider esteve presente no local de trabalho e engajou a equipe antes ou durante a tarefa',
    en: 'Leader was present at the worksite and engaged the team before or during the task',
  },
  le_presence_2: {
    pt: 'Lider discutiu expectativas de HSSE, campanhas recentes ou aprendizados relevantes com a equipe',
    en: 'Leader discussed HSSE expectations, recent campaigns or relevant learnings with the team',
  },
  le_control_1: {
    pt: 'Lider verificou perigos, qualidade da PTW/JSA e controles criticos em campo',
    en: 'Leader verified hazards, PTW/JSA quality and critical controls in the field',
  },
  le_control_2: {
    pt: 'Lider verificou riscos de interface com contratada, cliente ou fornecedor quando aplicavel',
    en: 'Leader verified interface risks with contractor, client or vendor when applicable',
  },
  le_coach_1: {
    pt: 'Lider fez perguntas abertas e escutou sinais fracos, preocupacoes ou pressao de producao',
    en: 'Leader asked open questions and listened for weak signals, concerns or production pressure',
  },
  le_coach_2: {
    pt: 'Lider reconheceu comportamento seguro ou questionou comportamento inseguro com acompanhamento claro',
    en: 'Leader recognized safe behavior or challenged unsafe behavior with clear follow-up',
  },
  we_task_1: {
    pt: 'Trabalhadores conseguem explicar o escopo da tarefa e o que pode dar errado',
    en: 'Workers can explain the task scope and what could go wrong',
  },
  we_task_2: {
    pt: 'Trabalhadores entendem a JSA/toolbox talk e participaram ativamente dela',
    en: 'Workers understand the JSA/toolbox talk and actively participated in it',
  },
  we_control_1: {
    pt: 'Trabalhadores conseguem citar o controle critico ou salvaguarda que os protege do principal perigo',
    en: 'Workers can name the critical control or safeguard protecting them from the main hazard',
  },
  we_control_2: {
    pt: 'Trabalhadores seguem o metodo acordado e usam os equipamentos/EPIs requeridos',
    en: 'Workers follow the agreed method and use the required equipment/PPE',
  },
  we_stop_1: {
    pt: 'Trabalhadores entendem a autoridade para parar o trabalho e quando devem interromper a atividade',
    en: 'Workers understand Stop Work authority and when they must stop the activity',
  },
  we_stop_2: {
    pt: 'Trabalhadores se sentem confortaveis para levantar preocupacoes com a lideranca da SBM, contratada ou cliente',
    en: 'Workers feel comfortable raising concerns with SBM, contractor or client leadership',
  },
  tlo_focus_1: {
    pt: 'Tema da observacao, campanha, tendencia, evento recente ou achado de auditoria esta claro',
    en: 'The observation topic, campaign, trend, recent event or audit finding is clear',
  },
  tlo_focus_2: {
    pt: 'Comportamento ou controle esperado para o tema estava visivel no local de trabalho',
    en: 'Expected behavior or control for the topic was visible at the worksite',
  },
  tlo_field_1: {
    pt: 'Condicoes locais como SIMOPS, acesso, clima, equipe, ferramentas ou pressao de prazo apoiam a execucao segura',
    en: 'Local conditions such as SIMOPS, access, weather, crew, tools or schedule pressure support safe execution',
  },
  tlo_field_2: {
    pt: 'Nao ha desvio significativo entre o procedimento e como o trabalho e realmente executado',
    en: 'There is no significant gap between the procedure and how work is actually performed',
  },
  tlo_transfer_1: {
    pt: 'Aprendizado pode ser compartilhado com outras unidades, FPSOs, projetos ou setores',
    en: 'Learning can be shared with other units, FPSOs, projects or departments',
  },
  tlo_transfer_2: {
    pt: 'Acao recomendada esta clara: compartilhar aprendizado, orientar equipe, atualizar procedimento ou escalar risco',
    en: 'Recommended action is clear: share learning, coach the team, update procedure or escalate risk',
  },
  aar_plan_1: {
    pt: 'O que era esperado estava claro para todos os envolvidos',
    en: 'What was expected was clear to everyone involved',
  },
  aar_plan_2: {
    pt: 'A execucao real correspondeu ao plano sem desvios nao planejados significativos',
    en: 'Actual execution matched the plan without significant unplanned deviations',
  },
  aar_control_1: {
    pt: 'Controles de HSSE foram efetivos durante a atividade, evento, simulado, parada ou SIMOPS',
    en: 'HSSE controls were effective during the activity, event, drill, shutdown or SIMOPS',
  },
  aar_control_2: {
    pt: 'Roles, communication, handovers, tools, access and resources supported safe execution',
    en: 'Roles, communication, handovers, tools, access and resources supported safe execution',
  },
  aar_lesson_1: {
    pt: 'O que funcionou bem e o que nao saiu conforme planejado foram registrados com detalhe suficiente',
    en: 'What worked well and what did not go as planned were recorded with enough detail',
  },
  aar_lesson_2: {
    pt: 'Responsavel, prazo e necessidade de transferencia de aprendizado estao claros quando requeridos',
    en: 'Owner, due date and need for learning transfer are clear when required',
  },
};

const GUIDANCE_TEXT: Record<string, LocaleText> = {
  we_task_1: { pt: 'Pergunta sugerida: qual e o maior risco desta tarefa?', en: 'Suggested question: what is the greatest risk in this task?' },
  we_control_1: { pt: 'Pergunta sugerida: qual controle protege voce desse risco?', en: 'Suggested question: which control protects you from this risk?' },
  we_stop_1: { pt: 'Pergunta sugerida: quando voce pararia o trabalho?', en: 'Suggested question: when would you stop the work?' },
};

const GENERIC_DEFICIENCIES = {
  control: {
    pt: [
      'Procedimento, metodo de trabalho ou permissao nao corresponde ao trabalho executado',
      'Controle critico ausente, incompleto ou nao verificado no local',
      'Equipe nao consegue explicar o perigo, o controle ou a condicao para parar o trabalho',
      'Equipamento, barreira, ferramenta ou EPI requerido nao esta disponivel ou adequado',
      'Supervisao, passagem de servico ou interface com contratada esta fragil',
      'Outro desvio observado no local de trabalho',
    ],
    en: [
      'Procedure, work method or permit does not match the work being performed',
      'Critical control is missing, incomplete or not verified at the worksite',
      'Team cannot explain the hazard, control or Stop Work condition',
      'Required equipment, barrier, tool or PPE is not available or suitable',
      'Supervision, handover or contractor interface is weak',
      'Other deviation observed at the worksite',
    ],
  },
  engagement: {
    pt: [
      'Engajamento nao foi realizado no local de trabalho',
      'Discussao ficou generica e nao testou o entendimento',
      'Lideranca nao verificou os controles criticos em campo',
      'Preocupacoes da equipe ou sinais fracos nao foram explorados',
      'Acoes nao foram atribuidas de forma clara',
      'Outro desvio de engajamento da lideranca',
    ],
    en: [
      'Engagement was not performed at the worksite',
      'Discussion was generic and did not test understanding',
      'Leadership did not verify critical controls in the field',
      'Team concerns or weak signals were not explored',
      'Actions were not clearly assigned',
      'Other leadership engagement deviation',
    ],
  },
};

function locale(t: TFunction) {
  return String(t('common.language')).toLowerCase().includes('english') ? 'en' : 'pt';
}

function pick(text: LocaleText | undefined, fallback: string, t: TFunction) {
  return text?.[locale(t)] ?? fallback;
}

function genericDeficienciesForQuestion(questionId: string, t: TFunction) {
  if (questionId.startsWith('le_')) return GENERIC_DEFICIENCIES.engagement[locale(t)];
  return GENERIC_DEFICIENCIES.control[locale(t)];
}

export function evvCategoryName(category: EvvCategory, t: TFunction) {
  return pick(CATEGORY_TEXT[category.id], category.name, t);
}

export function evvQuestionText(question: EvvQuestion, t: TFunction) {
  if (question.id.startsWith('sg_')) {
    const categoryId = question.id.replace('_q1', '');
    const category = CATEGORY_TEXT[categoryId];
    return locale(t) === 'en'
      ? `Critical controls for ${category?.en.replace(' (LSR)', '') ?? 'the activity'} are implemented, understood and effective`
      : `Controles criticos para ${category?.pt.replace(' (LSR)', '') ?? 'a atividade'} estao implementados, compreendidos e efetivos`;
  }
  return pick(QUESTION_TEXT[question.id], question.text, t);
}

export function evvQuestionGuidance(question: EvvQuestion, t: TFunction) {
  if (!question.guidance) return undefined;
  return pick(GUIDANCE_TEXT[question.id], question.guidance, t);
}

export function evvDeficiencyText(question: EvvQuestion, deficiency: string, t: TFunction) {
  const index = question.deficiencies?.indexOf(deficiency) ?? -1;
  if (index < 0) return deficiency;
  const generic = genericDeficienciesForQuestion(question.id, t);
  return generic[index] ?? deficiency;
}
