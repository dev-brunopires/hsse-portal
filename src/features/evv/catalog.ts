// eV&V form catalogs based on the All Safe functional specification.
// The app stores answers as generic ratings, while each form owns its own questions.
import { evvTemplateToCategories } from './templates';

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
  'Procedimento, método de trabalho ou permissão não corresponde ao trabalho executado',
  'Controle crítico ausente, incompleto ou não verificado no local',
  'Equipe não consegue explicar o perigo, o controle ou a condição para parar o trabalho',
  'Equipamento, barreira, ferramenta ou EPI requerido não está disponível ou adequado',
  'Supervisão, passagem de serviço ou interface com contratada está frágil',
  'Outro desvio observado no local de trabalho',
];

const ENGAGEMENT_DEFICIENCIES = [
  'Engajamento não foi realizado no local de trabalho',
  'Discussão ficou genérica e não testou o entendimento',
  'Liderança não verificou os controles críticos em campo',
  'Preocupações da equipe ou sinais fracos não foram explorados',
  'Ações não foram atribuídas de forma clara',
  'Outro desvio de engajamento da liderança',
];

const WORKER_DEFICIENCIES = [
  'Trabalhador não conseguiu explicar o escopo da tarefa ou o principal perigo',
  'Controle crítico ou salvaguarda não foi compreendido',
  'Autoridade para parar o trabalho não estava clara ou não foi reforçada',
  'DDS, toolbox talk ou JSA não foi compreendido pela equipe',
  'Expectativas para contratada/fornecedor não estavam alinhadas aos requisitos SBM',
  'Outro desvio de engajamento dos trabalhadores',
];

const LEARNING_DEFICIENCIES = [
  'Comportamento ou controle esperado não foi observado',
  'Condição local está levando a desvio da prática esperada',
  'Procedimento não reflete a realidade de campo',
  'Aprendizado não está sendo capturado ou compartilhado',
  'Ação é necessária antes de considerar o tema efetivo',
  'Outro desvio de aprendizado',
];

const AAR_DEFICIENCIES = [
  'Resultado foi diferente do plano ou da expectativa',
  'Controles de HSSE foram apenas parcialmente efetivos',
  'Papéis, comunicação ou passagem de serviço não estavam claros',
  'Ferramentas, recursos, permissões ou acessos estavam inadequados',
  'Interface com contratada/cliente gerou atrito ou risco',
  'Lição aprendida requer ação de acompanhamento',
];

const SAFEGUARD_CATEGORIES: EvvCategory[] = [
  {
    id: 'breaking_containment',
    name: 'Quebra de Contenção',
    isLSR: true,
    questions: [
      {
        id: 'bc_1',
        text: 'Pacote de trabalho, permissão, plano de isolamento e controles de contingência correspondem ao escopo da quebra de contenção',
        deficiencies: CONTROL_DEFICIENCIES,
      },
      {
        id: 'bc_2',
        text: 'Conteúdo da linha, pressão, drenos, respiros, contenção de derrames e controles ambientais foram verificados antes da abertura',
        deficiencies: CONTROL_DEFICIENCIES,
      },
    ],
  },
  {
    id: 'bypassing_safety_controls',
    name: 'Bypass de Controles de Segurança (LSR)',
    isLSR: true,
    questions: [
      {
        id: 'bsc_1',
        text: 'Autorização foi obtida antes de desabilitar ou sobrescrever controles de segurança',
        deficiencies: [
          'Sem autorização formal para bypass ou override',
          'Medidas compensatórias não definidas ou não implementadas',
          'Bypass não está registrado no sistema de gestão',
          'Restauração dos controles não foi verificada após o trabalho',
        ],
      },
    ],
  },
  {
    id: 'confined_space',
    name: 'Espaço Confinado (LSR)',
    isLSR: true,
    questions: [
      {
        id: 'cs_1',
        text: 'Fontes de energia foram isoladas e verificadas antes da entrada',
        deficiencies: [
          'Isolamento de energia não verificado antes da entrada',
          'Bloqueio e etiquetagem não aplicados conforme requerido',
          'Energia armazenada não dissipada',
          'Plano de isolamento não aprovado por pessoa autorizada',
        ],
      },
      {
        id: 'cs_2',
        text: 'Atmosfera foi testada e o monitoramento contínuo está implementado quando requerido',
        deficiencies: [
          'Teste de gás pré-entrada não realizado',
          'Monitoramento contínuo não implementado durante o trabalho',
          'Detector de gás sem calibração ou fora de serviço',
          'Níveis de ação e critérios de evacuação não comunicados',
        ],
      },
      {
        id: 'cs_3',
        text: 'Plano de resgate, vigia, comunicação e equipamento respiratório estão prontos quando requeridos',
        deficiencies: CONTROL_DEFICIENCIES,
      },
    ],
  },
  {
    id: 'driving',
    name: 'Condução de Veículos (LSR)',
    isLSR: true,
    questions: [
      {
        id: 'drv_1',
        text: 'Trajeto, veículo, aptidão do motorista, uso de cinto e controles locais de direção foram verificados',
        deficiencies: CONTROL_DEFICIENCIES,
      },
    ],
  },
  {
    id: 'energy_deisolation',
    name: 'Desisolamento e Reenergização',
    isLSR: true,
    questions: [
      {
        id: 'edr_1',
        text: 'Área está liberada, partes interessadas foram notificadas e autorização está vigente antes da reenergização',
        deficiencies: CONTROL_DEFICIENCIES,
      },
    ],
  },
  {
    id: 'energy_isolation',
    name: 'Isolamento de Energia (LSR)',
    isLSR: true,
    questions: [
      {
        id: 'ei_1',
        text: 'Todas as fontes de energia foram identificadas, isoladas, bloqueadas/etiquetadas e testadas para energia zero',
        deficiencies: CONTROL_DEFICIENCIES,
      },
    ],
  },
  {
    id: 'hot_work',
    name: 'Trabalho a Quente (LSR)',
    isLSR: true,
    questions: [
      {
        id: 'hw_1',
        text: 'Uma Permissão de Trabalho a Quente válida está disponível no local',
        deficiencies: [
          'Sem Permissão de Trabalho a Quente válida no local',
          'Escopo da permissão não cobre a tarefa real',
          'Condições da permissão não foram comunicadas aos trabalhadores',
        ],
      },
      {
        id: 'hw_2',
        text: 'Inflamáveis foram removidos ou isolados, teste de gás está válido, vigia de fogo foi designado e equipamentos de combate a incêndio estão prontos',
        deficiencies: [
          'Materiais inflamáveis e combustíveis não foram identificados, isolados ou removidos',
          'Vigia de fogo treinado não foi designado ou não está no local',
          'Equipamento de combate a incêndio não está inspecionado, funcional ou disponível',
          'Autorização de Trabalho a Quente não foi concluída conforme os requisitos',
        ],
      },
    ],
  },
  ...[
    'Trabalho em Altura',
    'Linha de Fogo',
    'Operações de Içamento',
    'Gestão de Mudanças',
    'Permissão de Trabalho',
    'Equipamento de Proteção Individual',
    'Organização, Limpeza / Acesso e Saída',
    'Içamento Mecânico Abaixo do Gancho',
    'Teste de Pressão',
    'Escavação',
    'Operações de Mergulho',
    'Operações Marítimas',
  ].map<EvvCategory>((name, i) => ({
    id: `sg_${i + 8}`,
    name: `${name} (LSR)`,
    isLSR: true,
    questions: [
      {
        id: `sg_${i + 8}_q1`,
        text: `Controles críticos para ${name} estão implementados, compreendidos e efetivos`,
        deficiencies: CONTROL_DEFICIENCIES,
      },
    ],
  })),
];

const LEADERS_CATEGORIES: EvvCategory[] = [
  {
    id: 'leadership_presence',
    name: 'Presença da liderança',
    questions: [
      {
        id: 'le_presence_1',
        text: 'Líder esteve presente no local de trabalho e engajou a equipe antes ou durante a tarefa',
        deficiencies: ENGAGEMENT_DEFICIENCIES,
      },
      {
        id: 'le_presence_2',
        text: 'Líder discutiu expectativas de HSSE, campanhas recentes ou aprendizados relevantes com a equipe',
        deficiencies: ENGAGEMENT_DEFICIENCIES,
      },
    ],
  },
  {
    id: 'control_verification',
    name: 'Verificação de controles',
    questions: [
      {
        id: 'le_control_1',
        text: 'Líder verificou perigos, qualidade da PTW/JSA e controles críticos em campo',
        deficiencies: ENGAGEMENT_DEFICIENCIES,
      },
      {
        id: 'le_control_2',
        text: 'Líder verificou riscos de interface com contratada, cliente ou fornecedor quando aplicável',
        deficiencies: ENGAGEMENT_DEFICIENCIES,
      },
    ],
  },
  {
    id: 'coaching_and_intervention',
    name: 'Orientação e intervenção',
    questions: [
      {
        id: 'le_coach_1',
        text: 'Líder fez perguntas abertas e escutou sinais fracos, preocupações ou pressão de produção',
        deficiencies: ENGAGEMENT_DEFICIENCIES,
      },
      {
        id: 'le_coach_2',
        text: 'Líder reconheceu comportamento seguro ou questionou comportamento inseguro com acompanhamento claro',
        deficiencies: ENGAGEMENT_DEFICIENCIES,
      },
    ],
  },
];

const WORKERS_CATEGORIES: EvvCategory[] = [
  {
    id: 'task_understanding',
    name: 'Entendimento da tarefa',
    questions: [
      {
        id: 'we_task_1',
        text: 'Trabalhadores conseguem explicar o escopo da tarefa e o que pode dar errado',
        guidance: 'Pergunta sugerida: qual é o maior risco desta tarefa?',
        deficiencies: WORKER_DEFICIENCIES,
      },
      {
        id: 'we_task_2',
        text: 'Trabalhadores entendem a JSA/toolbox talk e participaram ativamente dela',
        deficiencies: WORKER_DEFICIENCIES,
      },
    ],
  },
  {
    id: 'control_understanding',
    name: 'Entendimento dos controles',
    questions: [
      {
        id: 'we_control_1',
        text: 'Trabalhadores conseguem citar o controle crítico ou salvaguarda que os protege do principal perigo',
        guidance: 'Pergunta sugerida: qual controle protege você desse risco?',
        deficiencies: WORKER_DEFICIENCIES,
      },
      {
        id: 'we_control_2',
        text: 'Trabalhadores seguem o método acordado e usam os equipamentos/EPIs requeridos',
        deficiencies: WORKER_DEFICIENCIES,
      },
    ],
  },
  {
    id: 'speak_up',
    name: 'Falar abertamente e parar o trabalho',
    questions: [
      {
        id: 'we_stop_1',
        text: 'Trabalhadores entendem a autoridade para parar o trabalho e quando devem interromper a atividade',
        guidance: 'Pergunta sugerida: quando você pararia o trabalho?',
        deficiencies: WORKER_DEFICIENCIES,
      },
      {
        id: 'we_stop_2',
        text: 'Trabalhadores se sentem confortáveis para levantar preocupações com a liderança da SBM, contratada ou cliente',
        deficiencies: WORKER_DEFICIENCIES,
      },
    ],
  },
];

const TLO_CATEGORIES: EvvCategory[] = [
  {
    id: 'learning_focus',
    name: 'Foco do aprendizado',
    questions: [
      {
        id: 'tlo_focus_1',
        text: 'Tema da observação, campanha, tendência, evento recente ou achado de auditoria está claro',
        deficiencies: LEARNING_DEFICIENCIES,
      },
      {
        id: 'tlo_focus_2',
        text: 'Comportamento ou controle esperado para o tema estava visível no local de trabalho',
        deficiencies: LEARNING_DEFICIENCIES,
      },
    ],
  },
  {
    id: 'field_reality',
    name: 'Realidade de campo',
    questions: [
      {
        id: 'tlo_field_1',
        text: 'Condições locais como SIMOPS, acesso, clima, equipe, ferramentas ou pressão de prazo apoiam a execução segura',
        deficiencies: LEARNING_DEFICIENCIES,
      },
      {
        id: 'tlo_field_2',
        text: 'Não há desvio significativo entre o procedimento e como o trabalho é realmente executado',
        deficiencies: LEARNING_DEFICIENCIES,
      },
    ],
  },
  {
    id: 'learning_transfer',
    name: 'Transferência de aprendizado',
    questions: [
      {
        id: 'tlo_transfer_1',
        text: 'Aprendizado pode ser compartilhado com outras unidades, FPSOs, projetos ou setores',
        deficiencies: LEARNING_DEFICIENCIES,
      },
      {
        id: 'tlo_transfer_2',
        text: 'Ação recomendada está clara: compartilhar aprendizado, orientar equipe, atualizar procedimento ou escalar risco',
        deficiencies: LEARNING_DEFICIENCIES,
      },
    ],
  },
];

const AAR_CATEGORIES: EvvCategory[] = [
  {
    id: 'plan_vs_actual',
    name: 'Planejado versus realizado',
    questions: [
      {
        id: 'aar_plan_1',
        text: 'O que era esperado estava claro para todos os envolvidos',
        deficiencies: AAR_DEFICIENCIES,
      },
      {
        id: 'aar_plan_2',
        text: 'A execução real correspondeu ao plano sem desvios não planejados significativos',
        deficiencies: AAR_DEFICIENCIES,
      },
    ],
  },
  {
    id: 'control_effectiveness',
    name: 'Efetividade dos controles',
    questions: [
      {
        id: 'aar_control_1',
        text: 'Controles de HSSE foram efetivos durante a atividade, evento, simulado, parada ou SIMOPS',
        deficiencies: AAR_DEFICIENCIES,
      },
      {
        id: 'aar_control_2',
        text: 'Papéis, comunicação, passagens de serviço, ferramentas, acessos e recursos apoiaram a execução segura',
        deficiencies: AAR_DEFICIENCIES,
      },
    ],
  },
  {
    id: 'actions_and_lessons',
    name: 'Ações e lições aprendidas',
    questions: [
      {
        id: 'aar_lesson_1',
        text: 'O que funcionou bem e o que não saiu conforme planejado foram registrados com detalhe suficiente',
        deficiencies: AAR_DEFICIENCIES,
      },
      {
        id: 'aar_lesson_2',
        text: 'Responsável, prazo e necessidade de transferência de aprendizado estão claros quando requeridos',
        deficiencies: AAR_DEFICIENCIES,
      },
    ],
  },
];

export const EVV_FORM_CATALOGS: Record<EvvFormType, EvvCategory[]> = {
  safeguard: [],
  leaders_engagement: [],
  workers_engagement: [],
  tlo: [],
  aar: [],
};

export const EVV_CATEGORIES: EvvCategory[] = [];

export function getEvvCategories(formType: EvvFormType): EvvCategory[] {
  return evvTemplateToCategories(formType);
}
