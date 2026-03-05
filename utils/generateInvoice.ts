import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Transaction, InventoryItem, User } from "../types";

export interface CustomerInfo {
  name?: string;
  phone?: string;
}

export const generateInvoicePDF = async (
  transaction: Transaction,
  inventoryMap: Map<string, InventoryItem>,
  user: User | null,
  customerInfo?: CustomerInfo
) => {

  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 14;
  const CURRENCY = "Rs.";

  // ---------------- HEADER ----------------


  doc.setFillColor(31, 41, 55);
  doc.rect(0, 0, pageWidth, 16, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(user?.shop_name?.toUpperCase() || "ELECTRICALS", margin, 10);

  doc.setTextColor(31, 41, 55);

  // ---------------- INVOICE TITLE ----------------

  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE", margin, 36);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);

  doc.text(
    `Invoice Number: #${transaction.id.substring(0, 8).toUpperCase()}`,
    margin,
    43
  );

  doc.text(
    `Date of Issue: ${new Date(transaction.date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    })}`,
    margin,
    48
  );

  // ---------------- FROM / BILL TO ----------------

  const sectionY = 62;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("FROM:", margin, sectionY);

  doc.setFontSize(10);
  doc.text(user?.shop_name || "Electricals", margin, sectionY + 7);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(80);

  let offset = sectionY + 12;

  if (user?.email) {
    doc.text(user.email, margin, offset);
    offset += 5;
  }

  if (user?.phone) {
    doc.text(`Ph: ${user.phone}`, margin, offset);
  }

  // -------- BILL TO --------

  const col2X = pageWidth / 2 + 10;

  doc.setTextColor(31, 41, 55);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("BILL TO:", col2X, sectionY);

  doc.setFontSize(10);

  doc.setFont("helvetica", "bold");

  doc.text(
    customerInfo?.name ||
      transaction.customer_name ||
      "Walk-in Customer",
    col2X,
    sectionY + 7
  );

  doc.setFont("helvetica", "normal");
  doc.setTextColor(80);

  if (customerInfo?.phone || transaction.customer_phone) {
    doc.text(
      `Ph: ${customerInfo?.phone || transaction.customer_phone}`,
      col2X,
      sectionY + 12
    );
  }

  // ---------------- TABLE ----------------

  const tableColumns = [
    "#",
    "Item Description",
    "Qty",
    `Rate (${CURRENCY})`,
    `Amount (${CURRENCY})`,
  ];

  const tableRows: (string | number)[][] = [];

  let subtotal = 0;
  let totalGst = 0;

  const items = transaction.items.filter((i) => i.status !== "returned");

  items.forEach((item, index) => {
    const unitPrice = item.totalPrice / item.quantity;

    let rate = unitPrice;

    if (item.has_gst) {
      rate = unitPrice / 1.18;
    }

    const taxableAmount = rate * item.quantity;

    tableRows.push([
      index + 1,
      `${item.productName}${item.sale_type === "bundle" ? " (Bundle)" : ""}`,
      item.quantity,
      rate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    ]);

    subtotal += taxableAmount;

    if (item.has_gst) {
      totalGst += item.totalPrice - taxableAmount;
    }
  });

  autoTable(doc, {
    startY: 92,
    head: [tableColumns],
    body: tableRows,

    theme: "grid",

    headStyles: {
      fillColor: [31, 41, 55],
      textColor: 255,
      fontStyle: "bold",
      halign: "center",
    },

    columnStyles: {
      0: { halign: "center", cellWidth: 10 },
      2: { halign: "center", cellWidth: 20 },
      3: { halign: "right", cellWidth: 35 },
      4: { halign: "right", cellWidth: 35 },
    },

    styles: {
      fontSize: 9,
      cellPadding: 4,
    },

    alternateRowStyles: {
      fillColor: [250, 250, 250],
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY || 120;

  // ---------------- SUMMARY BOX ----------------
  const summaryWidth = 100;
  const summaryX = pageWidth - margin - summaryWidth;
  let summaryY = finalY + 12;

  const grandTotal = items.reduce((acc, i) => acc + i.totalPrice, 0);
  const boxHeight = totalGst > 0 ? 50 : 35;

  doc.setFillColor(245, 245, 245);
  doc.rect(summaryX - 5, summaryY - 6, summaryWidth + 5, boxHeight, "F");

  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.setFont("helvetica", "normal");

  doc.text("Subtotal", summaryX, summaryY);
  doc.text(
    `${CURRENCY} ${subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    pageWidth - margin,
    summaryY,
    { align: "right" }
  );

  if (totalGst > 0) {
    const cgst = totalGst / 2;
    const sgst = totalGst / 2;

    summaryY += 8;
    doc.text("CGST (9%)", summaryX, summaryY);
    doc.text(
      `${CURRENCY} ${cgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      pageWidth - margin,
      summaryY,
      { align: "right" }
    );

    summaryY += 8;
    doc.text("SGST (9%)", summaryX, summaryY);
    doc.text(
      `${CURRENCY} ${sgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      pageWidth - margin,
      summaryY,
      { align: "right" }
    );
  }

  summaryY += 12;
  doc.setDrawColor(200);
  doc.line(summaryX, summaryY - 5, pageWidth - margin, summaryY - 5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(31, 41, 55);

  doc.text("GRAND TOTAL", summaryX, summaryY + 2);
  doc.text(
    `${CURRENCY} ${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    pageWidth - margin,
    summaryY + 2,
    { align: "right" }
  );

  // ---------------- SIGNATURE ----------------

  if (user?.signature_url) {
    try {
      const response = await fetch(user.signature_url);
      const blob = await response.blob();

      const reader = new FileReader();

      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const sigX = pageWidth - margin - 45;
      const sigY = summaryY + 15;

      doc.addImage(base64, "PNG", sigX, sigY, 40, 12);

      doc.line(sigX, sigY + 15, sigX + 40, sigY + 15);

      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");

      doc.text(
        "Authorized Signature",
        sigX + 20,
        sigY + 20,
        { align: "center" }
      );
    } catch (e) {
      console.error("Signature load failed", e);
    }
  }

  // ---------------- FOOTER ----------------

  doc.setDrawColor(230);
  doc.line(margin, pageHeight - 20, pageWidth - margin, pageHeight - 20);

  doc.setFontSize(8);
  doc.setTextColor(150);

  doc.text(
    "Thank you for your business!",
    pageWidth / 2,
    pageHeight - 12,
    { align: "center" }
  );

  doc.text(
    "This is a computer-generated document.",
    pageWidth / 2,
    pageHeight - 8,
    { align: "center" }
  );

  // ---------------- SAVE PDF ----------------

  const blob = doc.output("blob");

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;

  link.download = `Invoice-${transaction.id
    .substring(0, 8)
    .toUpperCase()}.pdf`;

  document.body.appendChild(link);

  link.click();

  document.body.removeChild(link);

  URL.revokeObjectURL(url);
};