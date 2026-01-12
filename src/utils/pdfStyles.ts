import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import type { OrganizationBranding } from '@/hooks/useOrganizationBranding';
import { loadImageAsBase64 } from '@/hooks/useOrganizationBranding';
import i18n from '@/i18n';

const getDateLocale = () => i18n.language === 'en' ? enUS : ptBR;

// Default Brand Colors - Used when no organization branding is available
export const PRIMARY_BLUE: [number, number, number] = [22, 85, 154]; // #16559A
// Alias for backwards compatibility - keeping old name to avoid breaking imports
export const SBM_BLUE = PRIMARY_BLUE;
export const BRAND_BLUE = PRIMARY_BLUE;
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
  const logoUrl = branding?.logoWhiteUrl || branding?.logoUrl;
  if (logoUrl) {
    await loadLogoToCache(logoUrl);
  }
}

export interface PDFHeaderOptions {
  branding?: OrganizationBranding;
}

/**
 * Adds standardized header to PDF with organization logo
 * Features a modern design with rounded rectangle on left and logo on right
 * Design: Steel blue rounded rectangle on left, dark navy on right with logo
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
  const headerHeight = 32;
  
  // Fixed steel blue color for the left rectangle: #004080
  const steelBlue: [number, number, number] = [0, 64, 128];
  
  // Fill entire header with primary color first (dark navy - background)
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');
  
  // Draw the steel blue rounded rectangle on the left
  // Width covers about 55% of the page, with rounded corners on the right side
  const leftRectWidth = pageWidth * 0.52;
  const cornerRadius = 16; // ~50px equivalent in PDF units (mm)
  
  doc.setFillColor(...steelBlue);
  
  // Draw rounded rectangle - jsPDF roundedRect(x, y, width, height, radiusX, radiusY, style)
  // We need to simulate a pill shape that only rounds on the right
  // First draw a regular rectangle for most of the shape
  doc.rect(0, 0, leftRectWidth - cornerRadius, headerHeight, 'F');
  
  // Then draw a rounded rectangle that overlaps to create the rounded right edge
  doc.roundedRect(
    leftRectWidth - cornerRadius * 2, // Start before the corner
    0, 
    cornerRadius * 2, 
    headerHeight, 
    cornerRadius, 
    cornerRadius, 
    'F'
  );
  
  // Report title - positioned on the left side (in the steel blue section)
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 10, 12);
  
  // Subtitle info - below title on left
  if (rightText && rightText.length > 0) {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    rightText.forEach((text, index) => {
      doc.text(text, 10, 19 + (index * 5));
    });
  } else if (subtitle) {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(subtitle, 10, 19);
  }
  
  // Try to add the organization logo on the RIGHT side (in the dark section)
  let logoAdded = false;
  
  const logoUrl = branding?.logoWhiteUrl || branding?.logoUrl;
  if (logoUrl) {
    const logoBase64 = await loadLogoToCache(logoUrl);
    if (logoBase64) {
      try {
        // Detect image type from base64
        const imageType = logoBase64.includes('image/png') ? 'PNG' : 
                          logoBase64.includes('image/svg') ? 'SVG' : 'JPEG';
        // Position logo on the right side, vertically centered
        const logoWidth = 32;
        const logoHeight = 16;
        const logoX = pageWidth - logoWidth - 8;
        const logoY = (headerHeight - logoHeight) / 2;
        doc.addImage(logoBase64, imageType, logoX, logoY, logoWidth, logoHeight);
        logoAdded = true;
      } catch (error) {
        console.error('Error adding organization logo to PDF:', error);
      }
    }
  }
  
  // Fallback to text logo with organization name (on the right)
  if (!logoAdded) {
    addTextLogoRight(doc, pageWidth, headerHeight, branding?.name);
  }
  
  return 40; // Return the Y position after header
}

/**
 * Fallback text logo when image fails - uses organization name (positioned on right)
 */
function addTextLogoRight(doc: jsPDF, pageWidth: number, headerHeight: number, organizationName?: string) {
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  
  // Use organization name or default
  const name = organizationName || 'SafeShip';
  // Truncate if too long
  const displayName = name.length > 18 ? name.substring(0, 18) + '...' : name;
  doc.text(displayName, pageWidth - 14, headerHeight / 2 + 3, { align: 'right' });
}

/**
 * Fallback text logo when image fails - uses organization name (legacy left position)
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
 * Features the same modern design with rounded rectangle on left
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
  const headerHeight = 32;
  
  // Fixed steel blue color for the left rectangle: #004080
  const steelBlue: [number, number, number] = [0, 64, 128];
  
  // Fill entire header with primary color first (dark navy - background)
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');
  
  // Draw the steel blue rounded rectangle on the left
  const leftRectWidth = pageWidth * 0.52;
  const cornerRadius = 16;
  
  doc.setFillColor(...steelBlue);
  
  // Draw rectangle for most of the shape
  doc.rect(0, 0, leftRectWidth - cornerRadius, headerHeight, 'F');
  
  // Draw rounded rectangle that overlaps to create the rounded right edge
  doc.roundedRect(
    leftRectWidth - cornerRadius * 2,
    0, 
    cornerRadius * 2, 
    headerHeight, 
    cornerRadius, 
    cornerRadius, 
    'F'
  );
  
  // Report title - positioned on the left side (in the steel blue section)
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 10, 12);
  
  // Subtitle info - below title on left
  if (rightText && rightText.length > 0) {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    rightText.forEach((text, index) => {
      doc.text(text, 10, 19 + (index * 5));
    });
  } else if (subtitle) {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(subtitle, 10, 19);
  }
  
  // Try to use cached logo on the RIGHT side
  let logoAdded = false;
  const logoUrl = branding?.logoWhiteUrl || branding?.logoUrl;
  if (logoUrl && logoCache.has(logoUrl)) {
    const cachedLogo = logoCache.get(logoUrl);
    if (cachedLogo) {
      try {
        const imageType = cachedLogo.includes('image/png') ? 'PNG' : 
                          cachedLogo.includes('image/svg') ? 'SVG' : 'JPEG';
        // Position logo on the right side, vertically centered
        const logoWidth = 32;
        const logoHeight = 16;
        const logoX = pageWidth - logoWidth - 8;
        const logoY = (headerHeight - logoHeight) / 2;
        doc.addImage(cachedLogo, imageType, logoX, logoY, logoWidth, logoHeight);
        logoAdded = true;
      } catch (error) {
        // Fallback to text
      }
    }
  }
  
  if (!logoAdded) {
    addTextLogoRight(doc, pageWidth, headerHeight, branding?.name);
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
  if (yPos > pageHeight - 50) {
    doc.addPage();
    yPos = 20;
  }
  
  // Compact signature box - 1/3 of page width for clean layout
  const signatureBoxWidth = 70;
  const signatureBoxHeight = 25;
  const signatureBoxX = (pageWidth - signatureBoxWidth) / 2;
  
  const t = i18n.t;
  const dateLocale = getDateLocale();
  
  // Section header
  yPos += 8;
  doc.setFillColor(...LIGHT_GRAY);
  doc.rect(margin, yPos, pageWidth - margin * 2, 7, 'F');
  doc.setFillColor(...SBM_BLUE);
  doc.rect(margin, yPos, 3, 7, 'F');
  
  doc.setTextColor(...DARK_GRAY);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(t('pdfStyles.responsibleSignature'), margin + 8, yPos + 4.5);
  
  yPos += 12;
  
  // Signature box - smaller
  doc.setDrawColor(...BORDER_GRAY);
  doc.setLineWidth(0.4);
  doc.rect(signatureBoxX, yPos, signatureBoxWidth, signatureBoxHeight);
  
  // Add signature image if available
  if (signatureData) {
    try {
      // Scaled signature to fit smaller box
      doc.addImage(signatureData, 'PNG', signatureBoxX + 5, yPos + 2, signatureBoxWidth - 10, signatureBoxHeight - 6);
    } catch (error) {
      console.error('Error adding signature to PDF:', error);
      doc.setTextColor(...MEDIUM_GRAY);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.text(t('pdfStyles.digitalSignatureNotAvailable'), signatureBoxX + signatureBoxWidth / 2, yPos + signatureBoxHeight / 2 + 2, { align: 'center' });
    }
  } else {
    doc.setTextColor(...MEDIUM_GRAY);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text(t('pdfStyles.digitalSignature'), signatureBoxX + signatureBoxWidth / 2, yPos + signatureBoxHeight / 2 + 2, { align: 'center' });
  }
  
  yPos += signatureBoxHeight + 3;
  
  // Signature line - shorter
  doc.setDrawColor(...DARK_GRAY);
  doc.setLineWidth(0.2);
  doc.line(signatureBoxX + 10, yPos, signatureBoxX + signatureBoxWidth - 10, yPos);
  
  yPos += 4;
  
  // Signer name
  doc.setTextColor(...DARK_GRAY);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(signerName, signatureBoxX + signatureBoxWidth / 2, yPos, { align: 'center' });
  
  yPos += 4;
  
  // Signer position
  if (signerPosition) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MEDIUM_GRAY);
    doc.text(signerPosition, signatureBoxX + signatureBoxWidth / 2, yPos, { align: 'center' });
    yPos += 4;
  }
  
  // Date and time
  yPos += 2;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MEDIUM_GRAY);
  const dateStr = `${t('pdfStyles.documentGeneratedAt')}: ${format(new Date(), "dd/MM/yyyy HH:mm:ss", { locale: dateLocale })}`;
  doc.text(dateStr, signatureBoxX + signatureBoxWidth / 2, yPos, { align: 'center' });
  
  return yPos + 8;
}
