import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import {
  SBM_BLUE, DARK_GRAY, LIGHT_GRAY, MEDIUM_GRAY, BORDER_GRAY,
  SUCCESS_GREEN, WARNING_YELLOW, DANGER_RED,
  addPDFHeader, addPDFFooter, addSectionHeader, preloadLogo,
} from './pdfStyles';
import i18n from '@/i18n';
import type { OrganizationBranding } from '@/hooks/useOrganizationBranding';
import { getEvvCategories, type EvvFormType, type Rating } from '@/features/evv/catalog';
import type { EvvAnswers, EvvScope } from '@/features/evv/types';
import { evvCategoryName, evvDeficiencyText, evvQuestionText } from '@/features/evv/text';

const getDateLocale = () => (i18n.language === 'en' ? enUS : ptBR);

type PdfWithAutoTable = jsPDF & {
  lastAutoTable?: {
    finalY: number;
  };
};

function lastAutoTableY(doc: jsPDF, fallback: number) {
  return (doc as PdfWithAutoTable).lastAutoTable?.finalY ?? fallback;
}

export interface EvvPDFData {
  submission: {
    id?: string;
    client_id: string;
    form_type: EvvFormType;
    status: string;
    scope: EvvScope;
    answers: EvvAnswers;
    comments: string;
    submitted_at?: string;
    updated_at: string;
    signature_data?: string | null;
    signed_at?: string | null;
    reviewed_by_name?: string | null;
    reviewed_at?: string | null;
    review_notes?: string | null;
    review_status?: string | null;
  };
  author: {
    full_name: string;
    email?: string;
    position?: string | null;
    department?: string | null;
  };
  ship?: { name: string; code?: string | null } | null;
  branding?: OrganizationBranding;
}

const FORM_TITLE_KEY: Record<EvvFormType, string> = {
  safeguard: 'evv.forms.safeguard.title',
  leaders_engagement: 'evv.forms.leaders.title',
  workers_engagement: 'evv.forms.workers.title',
  tlo: 'evv.forms.tlo.title',
  aar: 'evv.forms.aar.title',
};

const RATING_COLOR: Record<Rating, [number, number, number]> = {
  effective: SUCCESS_GREEN,
  not_effective: DANGER_RED,
  not_assessed: MEDIUM_GRAY,
};

const ENVIRONMENT_LABEL: Record<string, string> = {
  fpso: 'FPSO',
  project: 'Projeto',
  office: 'Escritório',
  yard: 'Estaleiro',
};

const YES_NO_LABEL: Record<string, string> = {
  yes: 'Sim',
  no: 'Não',
  na: 'N/A',
};

const ORGANIZATION_LABEL: Record<string, string> = {
  sbm: 'SBM',
  contractor: 'Contratada',
  client: 'Cliente',
};

const ROLE_LABEL: Record<string, string> = {
  vendor: 'Fornecedor',
  technician: 'Técnico',
  supervisor: 'Supervisor',
};

function scopeLabel(value: string | null | undefined, labels: Record<string, string>) {
  if (!value) return '-';
  return labels[value] ?? value;
}

function translatedScopeLabel(value: string | null | undefined, labels: Record<string, string>) {
  if (!value) return '-';
  if (labels === ENVIRONMENT_LABEL) {
    if (value === 'fpso') return 'FPSO';
    return String(i18n.t(`evv.environment.${value}`));
  }
  if (labels === YES_NO_LABEL) {
    if (value === 'na') return 'N/A';
    return String(i18n.t(value === 'yes' ? 'common.yes' : 'common.no'));
  }
  if (labels === ORGANIZATION_LABEL) {
    if (value === 'sbm') return 'SBM';
    return String(i18n.t(`evv.scope.${value}`));
  }
  if (labels === ROLE_LABEL) {
    if (value === 'supervisor') return 'Supervisor';
    return String(i18n.t(`evv.scope.${value}`));
  }
  return scopeLabel(value, labels);
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '-';
  try {
    return format(new Date(iso), 'dd/MM/yyyy HH:mm', { locale: getDateLocale() });
  } catch {
    return '-';
  }
}

export async function generateEvvPDF(data: EvvPDFData, options?: { preview?: boolean }) {
  const t = i18n.t;
  const dateLocale = getDateLocale();
  await preloadLogo(data.branding);

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let yPos = 0;

  // === HEADER ===
  yPos = await addPDFHeader(
    doc,
    String(t(FORM_TITLE_KEY[data.submission.form_type] ?? 'evv.title')),
    undefined,
    [
      `ID: ${data.submission.id ?? data.submission.client_id.slice(0, 8)}`,
      `${t('generateInspectionPDF.issued')}: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: dateLocale })}`,
    ],
    { branding: data.branding },
  );
  yPos += 2;

  // === SCOPE BLOCK ===
  yPos = addSectionHeader(doc, yPos, t('evv.pdf.scopeSection'), SBM_BLUE, pageWidth - margin * 2);
  autoTable(doc, {
    startY: yPos,
    head: [],
    body: [
      [
        { content: `${t('evv.scope.environment')}:`, styles: { fontStyle: 'bold', textColor: MEDIUM_GRAY } },
        translatedScopeLabel(data.submission.scope.environment, ENVIRONMENT_LABEL),
        { content: `${t('evv.scope.area')}:`, styles: { fontStyle: 'bold', textColor: MEDIUM_GRAY } },
        data.submission.scope.area || '-',
      ],
      [
        { content: `${t('evv.scope.vessel')}:`, styles: { fontStyle: 'bold', textColor: MEDIUM_GRAY } },
        data.ship?.name || '-',
        { content: `${t('evv.scope.location')}:`, styles: { fontStyle: 'bold', textColor: MEDIUM_GRAY } },
        data.submission.scope.location || '-',
      ],
      [
        { content: `${t('evv.scope.visitDate')}:`, styles: { fontStyle: 'bold', textColor: MEDIUM_GRAY } },
        fmtDate(data.submission.scope.visit_datetime),
        { content: `${t('evv.scope.permitToWork')}:`, styles: { fontStyle: 'bold', textColor: MEDIUM_GRAY } },
        translatedScopeLabel(data.submission.scope.permit_to_work, YES_NO_LABEL),
      ],
      [
        { content: `${t('evv.scope.criticalActivity')}:`, styles: { fontStyle: 'bold', textColor: MEDIUM_GRAY } },
        translatedScopeLabel(data.submission.scope.critical_activity, YES_NO_LABEL),
        { content: `${t('evv.scope.permitToWorkNumber')}:`, styles: { fontStyle: 'bold', textColor: MEDIUM_GRAY } },
        data.submission.scope.permit_to_work === 'yes' ? data.submission.scope.permit_to_work_number || '-' : '-',
      ],
      [
        { content: `${t('evv.scope.criticalActivities')}:`, styles: { fontStyle: 'bold', textColor: MEDIUM_GRAY } },
        {
          content: data.submission.scope.critical_activities?.length
            ? data.submission.scope.critical_activities.join(', ')
            : String(t('evv.scope.criticalActivitiesPendingShort')),
          colSpan: 3,
        },
      ],
      [
        { content: `${t('evv.scope.yourOrg')}:`, styles: { fontStyle: 'bold', textColor: MEDIUM_GRAY } },
        data.submission.scope.your_organization || '-',
        { content: `${t('evv.scope.department')}:`, styles: { fontStyle: 'bold', textColor: MEDIUM_GRAY } },
        data.submission.scope.department || '-',
      ],
      [
        { content: `${t('evv.scope.observedOrg')}:`, styles: { fontStyle: 'bold', textColor: MEDIUM_GRAY } },
        translatedScopeLabel(data.submission.scope.observed_organization, ORGANIZATION_LABEL),
        { content: `${t('evv.scope.observedRole')}:`, styles: { fontStyle: 'bold', textColor: MEDIUM_GRAY } },
        translatedScopeLabel(data.submission.scope.observed_role, ROLE_LABEL),
      ],
      [
        { content: `${t('evv.scope.task')}:`, styles: { fontStyle: 'bold', textColor: MEDIUM_GRAY } },
        { content: data.submission.scope.task_description || '-', colSpan: 3 },
      ],
    ],
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: { top: 2, bottom: 2, left: 3, right: 3 }, textColor: DARK_GRAY },
    columnStyles: { 0: { cellWidth: 32 }, 1: { cellWidth: 58 }, 2: { cellWidth: 32 }, 3: { cellWidth: 58 } },
    margin: { left: margin },
  });
  yPos = lastAutoTableY(doc, yPos) + 8;

  // === AUTHOR ===
  yPos = addSectionHeader(doc, yPos, t('evv.pdf.authorSection'), SBM_BLUE, pageWidth - margin * 2);
  autoTable(doc, {
    startY: yPos,
    head: [],
    body: [
      [
        { content: t('evv.pdf.author') + ':', styles: { fontStyle: 'bold', textColor: MEDIUM_GRAY } },
        { content: data.author.full_name, styles: { fontStyle: 'bold', textColor: DARK_GRAY } },
        { content: t('evv.pdf.submittedAt') + ':', styles: { fontStyle: 'bold', textColor: MEDIUM_GRAY } },
        fmtDate(data.submission.submitted_at || data.submission.updated_at),
      ],
      [
        { content: t('evv.pdf.position') + ':', styles: { fontStyle: 'bold', textColor: MEDIUM_GRAY } },
        data.author.position || '-',
        { content: t('evv.pdf.department') + ':', styles: { fontStyle: 'bold', textColor: MEDIUM_GRAY } },
        data.author.department || '-',
      ],
    ],
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: { top: 2, bottom: 2, left: 3, right: 3 }, textColor: DARK_GRAY },
    columnStyles: { 0: { cellWidth: 28 }, 1: { cellWidth: 62 }, 2: { cellWidth: 28 }, 3: { cellWidth: 62 } },
    margin: { left: margin },
  });
  yPos = lastAutoTableY(doc, yPos) + 8;

  // === ANSWERS / OBSERVATIONS ===
  const rows: Array<Array<unknown>> = [];
  getEvvCategories(data.submission.form_type).forEach((cat) => {
    cat.questions.forEach((q) => {
      const a = data.submission.answers[q.id];
      if (!a || !a.rating) return; // skip unanswered
      const color = RATING_COLOR[a.rating];
      rows.push([
        evvCategoryName(cat, t).replace(' (LSR)', ''),
        evvQuestionText(q, t),
        {
          content: String(t(`evv.rating.${a.rating}`)),
          styles: { textColor: color, fontStyle: 'bold' as const, halign: 'center' as const },
        },
        a.deficiencies && a.deficiencies.length ? a.deficiencies.map((d) => `- ${evvDeficiencyText(q, d, t)}`).join('\n') : '-',
      ]);
    });
  });

  yPos = addSectionHeader(doc, yPos, t('evv.pdf.observationsSection'), SBM_BLUE, pageWidth - margin * 2);
  if (rows.length === 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...MEDIUM_GRAY);
    doc.text(t('evv.pdf.noObservations'), margin + 4, yPos + 6);
    yPos += 14;
  } else {
    autoTable(doc, {
      startY: yPos,
      head: [[
        t('evv.pdf.category'),
        t('evv.pdf.verification'),
        t('evv.pdf.rating'),
        t('evv.pdf.deficiencies'),
      ]],
      body: rows,
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 3, valign: 'top' },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 70 },
        2: { cellWidth: 22, halign: 'center' },
        3: { cellWidth: 'auto' },
      },
      headStyles: { fillColor: SBM_BLUE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      alternateRowStyles: { fillColor: [250, 251, 252] },
      margin: { left: margin },
    });
    yPos = lastAutoTableY(doc, yPos) + 8;
  }

  // === COMMENTS ===
  if (data.submission.comments?.trim()) {
    if (yPos > pageHeight - 40) { doc.addPage(); yPos = 20; }
    yPos = addSectionHeader(doc, yPos, t('evv.pdf.commentsSection'), SBM_BLUE, pageWidth - margin * 2);
    yPos += 2;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...DARK_GRAY);
    const lines = doc.splitTextToSize(data.submission.comments, pageWidth - margin * 2 - 8);
    doc.text(lines, margin + 4, yPos);
    yPos += lines.length * 4.5 + 8;
  }

  // === REVIEW ===
  if (data.submission.review_status || data.submission.review_notes) {
    if (yPos > pageHeight - 40) { doc.addPage(); yPos = 20; }
    yPos = addSectionHeader(doc, yPos, t('evv.pdf.reviewSection'), SBM_BLUE, pageWidth - margin * 2);
    const reviewColor =
      data.submission.review_status === 'approved' ? SUCCESS_GREEN :
      data.submission.review_status === 'rejected' ? DANGER_RED :
      WARNING_YELLOW;
    autoTable(doc, {
      startY: yPos,
      head: [],
      body: [
        [
          { content: t('evv.pdf.reviewStatus') + ':', styles: { fontStyle: 'bold', textColor: MEDIUM_GRAY } },
          {
            content: t(`evv.review.${data.submission.review_status ?? 'pending'}`),
            styles: { textColor: reviewColor, fontStyle: 'bold' },
          },
          { content: t('evv.pdf.reviewer') + ':', styles: { fontStyle: 'bold', textColor: MEDIUM_GRAY } },
          data.submission.reviewed_by_name || '-',
        ],
        [
          { content: t('evv.pdf.reviewedAt') + ':', styles: { fontStyle: 'bold', textColor: MEDIUM_GRAY } },
          fmtDate(data.submission.reviewed_at),
          { content: t('evv.pdf.reviewNotes') + ':', styles: { fontStyle: 'bold', textColor: MEDIUM_GRAY } },
          data.submission.review_notes || '-',
        ],
      ],
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: { top: 2, bottom: 2, left: 3, right: 3 }, textColor: DARK_GRAY },
      columnStyles: { 0: { cellWidth: 28 }, 1: { cellWidth: 62 }, 2: { cellWidth: 28 }, 3: { cellWidth: 62 } },
      margin: { left: margin },
    });
    yPos = lastAutoTableY(doc, yPos) + 8;
  }

  // === SIGNATURE ===
  if (yPos > pageHeight - 60) { doc.addPage(); yPos = 20; }
  yPos = addSectionHeader(doc, yPos, t('evv.pdf.signatureSection'), SBM_BLUE, pageWidth - margin * 2);
  yPos += 5;
  const sigBoxWidth = 70;
  const sigBoxHeight = 25;
  doc.setDrawColor(...BORDER_GRAY);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, yPos, sigBoxWidth, sigBoxHeight, 2, 2, 'FD');
  if (data.submission.signature_data) {
    try {
      doc.addImage(data.submission.signature_data, 'PNG', margin + 3, yPos + 2, sigBoxWidth - 6, sigBoxHeight - 5);
    } catch {
      doc.setFontSize(8); doc.setFont('helvetica', 'italic'); doc.setTextColor(...MEDIUM_GRAY);
      doc.text(t('generateInspectionPDF.digitalSignatureRegistered'), margin + 8, yPos + 14);
    }
  } else {
    doc.setFontSize(8); doc.setFont('helvetica', 'italic'); doc.setTextColor(...MEDIUM_GRAY);
    doc.text(t('generateInspectionPDF.awaitingSignature'), margin + 12, yPos + 14);
  }
  doc.setDrawColor(...DARK_GRAY);
  doc.line(margin, yPos + sigBoxHeight + 2, margin + sigBoxWidth, yPos + sigBoxHeight + 2);

  const detailsX = margin + sigBoxWidth + 15;
  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(...DARK_GRAY);
  doc.text(data.author.full_name, detailsX, yPos + 10);
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(...MEDIUM_GRAY);
  if (data.author.position) doc.text(data.author.position, detailsX, yPos + 17);
  if (data.author.department) doc.text(data.author.department, detailsX, yPos + 24);
  if (data.submission.signed_at) {
    doc.setTextColor(...SBM_BLUE);
    doc.text(`${t('generateInspectionPDF.signedAt')}: ${fmtDate(data.submission.signed_at)}`, detailsX, yPos + 31);
  }

  addPDFFooter(
    doc,
    data.branding?.name || t('generateInspectionPDF.footerCompany'),
    `eV&V: ${data.submission.id ?? data.submission.client_id.slice(0, 8)}`,
  );

  const fileName = `eVV_${data.submission.form_type}_${format(new Date(data.submission.submitted_at || data.submission.updated_at), 'yyyyMMdd_HHmm')}.pdf`;
  if (options?.preview) {
    const blob = doc.output('blob');
    window.open(URL.createObjectURL(blob), '_blank');
  } else {
    doc.save(fileName);
  }
  return fileName;
}
