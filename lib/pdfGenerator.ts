import jsPDF from "jspdf";
import type { QuoteWithItems } from "./quotes";

export function generateQuotePDF(quote: QuoteWithItems): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPosition = margin;

  // Helper function to add a new page if needed
  const checkPageBreak = (requiredHeight: number) => {
    if (yPosition + requiredHeight > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      yPosition = margin;
    }
  };

  // Header
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("Rental Quote", margin, yPosition);
  yPosition += 10;

  doc.setFontSize(16);
  doc.setFont("helvetica", "normal");
  doc.text(quote.name, margin, yPosition);
  yPosition += 15;

  // Quote Details
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Quote Details", margin, yPosition);
  yPosition += 8;

  doc.setFont("helvetica", "normal");
  const startDate = new Date(quote.start_date);
  const endDate = new Date(quote.end_date);
  const numberOfDays = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  const formatDate = (date: Date) => {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  };

  doc.text(`Rental Period: ${formatDate(startDate)} - ${formatDate(endDate)}`, margin, yPosition);
  yPosition += 6;
  doc.text(`Duration: ${numberOfDays} day${numberOfDays !== 1 ? "s" : ""}`, margin, yPosition);
  yPosition += 6;
  doc.text(`Status: ${quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}`, margin, yPosition);
  yPosition += 6;
  doc.text(`Created: ${formatDate(new Date(quote.created_at))}`, margin, yPosition);
  yPosition += 15;

  // Items Table Header
  checkPageBreak(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Items", margin, yPosition);
  yPosition += 8;

  // Table Headers
  const tableHeaders = ["Item", "Qty", "Unit Price", "Days", "Subtotal"];
  const colWidths = [70, 20, 30, 25, 35];
  let xPosition = margin;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  tableHeaders.forEach((header, index) => {
    doc.text(header, xPosition, yPosition);
    xPosition += colWidths[index];
  });
  yPosition += 6;

  // Draw line under headers
  doc.setLineWidth(0.5);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 8;

  // Items Rows
  doc.setFont("helvetica", "normal");
  quote.items.forEach((item) => {
    checkPageBreak(15);

    const subtotal = item.quantity * item.unit_price_snapshot * numberOfDays;
    xPosition = margin;

    // Item Name (may need to wrap if too long)
    const itemName = item.item_name || "Item";
    doc.text(itemName.substring(0, 30), xPosition, yPosition);
    xPosition += colWidths[0];

    // Quantity
    doc.text(item.quantity.toString(), xPosition, yPosition);
    xPosition += colWidths[1];

    // Unit Price
    doc.text(`$${item.unit_price_snapshot.toFixed(2)}`, xPosition, yPosition);
    xPosition += colWidths[2];

    // Days
    doc.text(numberOfDays.toString(), xPosition, yPosition);
    xPosition += colWidths[3];

    // Subtotal
    doc.text(`$${subtotal.toFixed(2)}`, xPosition, yPosition);
    yPosition += 8;
  });

  yPosition += 5;

  // Total
  checkPageBreak(15);
  const totalAmount = quote.items.reduce((sum, item) => {
    return sum + item.quantity * item.unit_price_snapshot * numberOfDays;
  }, 0);

  doc.setLineWidth(0.5);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Total:", pageWidth - margin - 50, yPosition);
  doc.text(`$${totalAmount.toFixed(2)}`, pageWidth - margin, yPosition, {
    align: "right",
  });

  // Footer
  // Get number of pages - getNumberOfPages() exists in jsPDF v3 but @types/jspdf doesn't include it
  // Access via type assertion since the method exists at runtime
  const totalPages: number = (doc as any).getNumberOfPages?.() ?? 1;
  
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" },
    );
  }

  // Save the PDF
  const fileName = `Quote_${quote.name.replace(/[^a-z0-9]/gi, "_")}_${formatDate(new Date())}.pdf`;
  doc.save(fileName);
}

