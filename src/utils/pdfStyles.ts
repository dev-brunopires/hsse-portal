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

// Cache for the logo base64
let logoBase64Cache: string | null = null;

/**
 * Loads the SBM white logo and converts to base64
 */
async function loadLogoBase64(): Promise<string | null> {
  if (logoBase64Cache) {
    return logoBase64Cache;
  }

  try {
    // Import the logo dynamically
    const logoModule = await import('@/assets/sbm-logo-white.png');
    const logoUrl = logoModule.default;
    
    // Fetch and convert to base64
    const response = await fetch(logoUrl);
    const blob = await response.blob();
    
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        logoBase64Cache = reader.result as string;
        resolve(logoBase64Cache);
      };
      reader.onerror = () => {
        console.error('Error reading logo file');
        resolve(null);
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error loading logo:', error);
    return null;
  }
}

/**
 * Preloads the logo for PDF generation
 */
export async function preloadLogo(): Promise<void> {
  await loadLogoBase64();
}

/**
 * Adds standardized SBM header to PDF with logo
 */
export async function addPDFHeader(
  doc: jsPDF, 
  title: string, 
  subtitle?: string,
  rightText?: string[]
): Promise<number> {
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Blue header section (no orange bar at top)
  doc.setFillColor(...SBM_BLUE);
  doc.rect(0, 0, pageWidth, 32, 'F');
  
  // Try to add the actual logo image
  const logoBase64 = await loadLogoBase64();
  
  if (logoBase64) {
    // Add the actual logo image
    try {
      doc.addImage(logoBase64, 'PNG', 14, 8, 40, 16);
    } catch (error) {
      console.error('Error adding logo to PDF:', error);
      // Fallback to text
      addTextLogo(doc);
    }
  } else {
    // Fallback to text if logo fails to load
    addTextLogo(doc);
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
 * Fallback text logo when image fails
 */
function addTextLogo(doc: jsPDF) {
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('SBM', 14, 16);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('OFFSHORE', 14, 23);
}

/**
 * Synchronous version for backwards compatibility - uses cached logo
 */
export function addPDFHeaderSync(
  doc: jsPDF, 
  title: string, 
  subtitle?: string,
  rightText?: string[]
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Blue header section
  doc.setFillColor(...SBM_BLUE);
  doc.rect(0, 0, pageWidth, 32, 'F');
  
  // Use cached logo if available
  if (logoBase64Cache) {
    try {
      doc.addImage(logoBase64Cache, 'PNG', 14, 8, 40, 16);
    } catch (error) {
      addTextLogo(doc);
    }
  } else {
    addTextLogo(doc);
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
