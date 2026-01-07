import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import type { OrganizationBranding } from '@/hooks/useOrganizationBranding';
import { loadImageAsBase64 } from '@/hooks/useOrganizationBranding';
import i18n from '@/i18n';

const getDateLocale = () => i18n.language === 'en' ? enUS : ptBR;

// Default Brand Colors - Used when no organization branding is available
export const SBM_BLUE: [number, number, number] = [22, 85, 154]; // #16559A
export const DARK_GRAY: [number, number, number] = [51, 51, 51];
export const LIGHT_GRAY: [number, number, number] = [245, 247, 250];
export const MEDIUM_GRAY: [number, number, number] = [156, 163, 175];
export const BORDER_GRAY: [number, number, number] = [229, 231, 235];
export const SUCCESS_GREEN: [number, number, number] = [16, 185, 129];
export const WARNING_YELLOW: [number, number, number] = [245, 158, 11];
export const DANGER_RED: [number, number, number] = [239, 68, 68];

// Cache for logos by URL
const logoCache: Map<string, string> = new Map();

/**
 * Loads a logo from URL and converts to base64, with caching
 */
async function loadLogoToCache(url: string | null): Promise<string | null> {
  if (!url) return null;
  
  if (logoCache.has(url)) {
    return logoCache.get(url) || null;
  }

  const base64 = await loadImageAsBase64(url);
  if (base64) {
    logoCache.set(url, base64);
  }
  return base64;
}

/**
 * Preloads the organization logo for PDF generation
 */
export async function preloadLogo(branding?: OrganizationBranding): Promise<void> {
  if (branding?.logoWhiteUrl) {
    await loadLogoToCache(branding.logoWhiteUrl);
  }
}

export interface PDFHeaderOptions {
  branding?: OrganizationBranding;
}

/**
 * Adds standardized header to PDF with organization logo
 */
export async function addPDFHeader(
  doc: jsPDF, 
  title: string, 
  subtitle?: string,
  rightText?: string[],
  options?: PDFHeaderOptions
): Promise<number> {
  const pageWidth = doc.internal.pageSize.getWidth();
  const branding = options?.branding;
  const primaryColor = branding?.primaryColor || SBM_BLUE;
  
  // Header section with organization's primary color
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 32, 'F');
  
  // Try to add the organization logo
  let logoAdded = false;
  
  if (branding?.logoWhiteUrl) {
    const logoBase64 = await loadLogoToCache(branding.logoWhiteUrl);
    if (logoBase64) {
      try {
        // Detect image type from base64
        const imageType = logoBase64.includes('image/png') ? 'PNG' : 
                          logoBase64.includes('image/svg') ? 'SVG' : 'JPEG';
        doc.addImage(logoBase64, imageType, 14, 6, 32, 20);
        logoAdded = true;
      } catch (error) {
        console.error('Error adding organization logo to PDF:', error);
      }
    }
  }
  
  // Fallback to text logo with organization name
  if (!logoAdded) {
    addTextLogo(doc, branding?.name);
  }
  
  // Report title
  doc.setTextColor(255, 255, 255);
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
 * Fallback text logo when image fails - uses organization name
 */
function addTextLogo(doc: jsPDF, organizationName?: string) {
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  
  // Use organization name or default
  const name = organizationName || 'SafeShip';
  // Truncate if too long
  const displayName = name.length > 15 ? name.substring(0, 15) + '...' : name;
  doc.text(displayName, 14, 20);
}

/**
 * Synchronous version for backwards compatibility - uses cached logo
 * Note: For organization-specific logos, use the async addPDFHeader instead
 */
export function addPDFHeaderSync(
  doc: jsPDF, 
  title: string, 
  subtitle?: string,
  rightText?: string[],
  options?: PDFHeaderOptions
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const branding = options?.branding;
  const primaryColor = branding?.primaryColor || SBM_BLUE;
  
  // Header section with organization's primary color
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 32, 'F');
  
  // Try to use cached logo
  let logoAdded = false;
  if (branding?.logoWhiteUrl && logoCache.has(branding.logoWhiteUrl)) {
    const cachedLogo = logoCache.get(branding.logoWhiteUrl);
    if (cachedLogo) {
      try {
        const imageType = cachedLogo.includes('image/png') ? 'PNG' : 
                          cachedLogo.includes('image/svg') ? 'SVG' : 'JPEG';
        doc.addImage(cachedLogo, imageType, 14, 6, 32, 20);
        logoAdded = true;
      } catch (error) {
        // Fallback to text
      }
    }
  }
  
  if (!logoAdded) {
    addTextLogo(doc, branding?.name);
  }
  
  // Report title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, pageWidth / 2, 14, { align: 'center' });
  
  // Subtitle
  if (subtitle) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(subtitle, pageWidth / 2, 22, { align: 'center' });
  }
  
  // Right side text
  if (rightText && rightText.length > 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    rightText.forEach((text, index) => {
      doc.text(text, pageWidth - 14, 14 + (index * 7), { align: 'right' });
    });
  }
  
  return 40;
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
  
  const t = i18n.t;
  
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
    doc.text(`${t('pdfStyles.page')} ${i} ${t('pdfStyles.of')} ${pageCount}`, pageWidth - 14, pageHeight - 4, { align: 'right' });
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

/**
 * Adds digital signature section to PDF
 */
export function addSignatureSection(
  doc: jsPDF,
  yPos: number,
  signerName: string,
  signerPosition?: string,
  signatureData?: string | null
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  
  // Check if we need a new page
  if (yPos > pageHeight - 60) {
    doc.addPage();
    yPos = 20;
  }
  
  const signatureBoxWidth = 180;
  const signatureBoxX = (pageWidth - signatureBoxWidth) / 2;
  
  const t = i18n.t;
  const dateLocale = getDateLocale();
  
  // Section header
  yPos += 10;
  doc.setFillColor(...LIGHT_GRAY);
  doc.rect(margin, yPos, pageWidth - margin * 2, 8, 'F');
  doc.setFillColor(...SBM_BLUE);
  doc.rect(margin, yPos, 4, 8, 'F');
  
  doc.setTextColor(...DARK_GRAY);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(t('pdfStyles.responsibleSignature'), margin + 10, yPos + 5.5);
  
  yPos += 15;
  
  // Signature box
  doc.setDrawColor(...BORDER_GRAY);
  doc.setLineWidth(0.5);
  doc.rect(signatureBoxX, yPos, signatureBoxWidth, 35);
  
  // Add signature image if available
  if (signatureData) {
    try {
      doc.addImage(signatureData, 'PNG', signatureBoxX + 10, yPos + 2, 160, 25);
    } catch (error) {
      console.error('Error adding signature to PDF:', error);
      // Fallback: Show placeholder text
      doc.setTextColor(...MEDIUM_GRAY);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.text(t('pdfStyles.digitalSignatureNotAvailable'), signatureBoxX + signatureBoxWidth / 2, yPos + 18, { align: 'center' });
    }
  } else {
    // Placeholder for signature
    doc.setTextColor(...MEDIUM_GRAY);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text(t('pdfStyles.digitalSignature'), signatureBoxX + signatureBoxWidth / 2, yPos + 18, { align: 'center' });
  }
  
  yPos += 38;
  
  // Signature line
  doc.setDrawColor(...DARK_GRAY);
  doc.setLineWidth(0.3);
  doc.line(signatureBoxX + 20, yPos, signatureBoxX + signatureBoxWidth - 20, yPos);
  
  yPos += 5;
  
  // Signer name
  doc.setTextColor(...DARK_GRAY);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(signerName, signatureBoxX + signatureBoxWidth / 2, yPos, { align: 'center' });
  
  yPos += 5;
  
  // Signer position
  if (signerPosition) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MEDIUM_GRAY);
    doc.text(signerPosition, signatureBoxX + signatureBoxWidth / 2, yPos, { align: 'center' });
    yPos += 5;
  }
  
  // Date and time
  yPos += 3;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MEDIUM_GRAY);
  const dateStr = `${t('pdfStyles.documentGeneratedAt')}: ${format(new Date(), "dd/MM/yyyy HH:mm:ss", { locale: dateLocale })}`;
  doc.text(dateStr, signatureBoxX + signatureBoxWidth / 2, yPos, { align: 'center' });
  
  return yPos + 10;
}
