import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// SBM Brand Colors - Standardized
export const SBM_BLUE: [number, number, number] = [22, 85, 154]; // #16559A
export const DARK_GRAY: [number, number, number] = [51, 51, 51];
export const LIGHT_GRAY: [number, number, number] = [245, 247, 250];
export const MEDIUM_GRAY: [number, number, number] = [156, 163, 175];
export const BORDER_GRAY: [number, number, number] = [229, 231, 235];
export const SUCCESS_GREEN: [number, number, number] = [16, 185, 129];
export const WARNING_YELLOW: [number, number, number] = [245, 158, 11];
export const DANGER_RED: [number, number, number] = [239, 68, 68];

// White logo as base64 (simple SBM text representation for PDF)
const SBM_LOGO_WIDTH = 35;
const SBM_LOGO_HEIGHT = 12;

/**
 * Adds standardized SBM header to PDF
 */
export function addPDFHeader(
  doc: jsPDF, 
  title: string, 
  subtitle?: string,
  rightText?: string[]
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Blue header section (no orange bar at top)
  doc.setFillColor(...SBM_BLUE);
  doc.rect(0, 0, pageWidth, 32, 'F');
  
  // Company name (white text to simulate white logo)
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('SBM', 14, 16);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('OFFSHORE', 14, 23);
  
  // Report title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, pageWidth / 2, 14, { align: 'center' });
  
  // Subtitle (date)
  if (subtitle) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(subtitle, pageWidth / 2, 22, { align: 'center' });
  }
  
  // Right side text (filters, document info)
  if (rightText && rightText.length > 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    rightText.forEach((text, index) => {
      doc.text(text, pageWidth - 14, 14 + (index * 7), { align: 'right' });
    });
  }
  
  return 40; // Return the Y position after header
}

/**
 * Adds standardized SBM footer to all pages
 */
export function addPDFFooter(
  doc: jsPDF,
  leftText: string,
  centerText: string
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageCount = doc.getNumberOfPages();
  
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    // Footer blue accent (1/4 of original size - was 8px, now 2px)
    doc.setFillColor(...SBM_BLUE);
    doc.rect(0, pageHeight - 10, pageWidth, 2, 'F');
    
    // Footer text
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MEDIUM_GRAY);
    doc.text(leftText, 14, pageHeight - 4);
    doc.text(centerText, pageWidth / 2, pageHeight - 4, { align: 'center' });
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - 14, pageHeight - 4, { align: 'right' });
  }
}

/**
 * Creates a section header with accent bar
 */
export function addSectionHeader(
  doc: jsPDF,
  yPos: number,
  title: string,
  accentColor: [number, number, number] = SBM_BLUE,
  fullWidth?: number
) {
  const margin = 14;
  const width = fullWidth || (doc.internal.pageSize.getWidth() - margin * 2);
  
  doc.setFillColor(...accentColor);
  doc.rect(margin, yPos, 4, 8, 'F');
  doc.setFillColor(...LIGHT_GRAY);
  doc.rect(margin + 4, yPos, width - 4, 8, 'F');
  
  doc.setTextColor(...DARK_GRAY);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(title, margin + 10, yPos + 5.5);
  
  return yPos + 10;
}
