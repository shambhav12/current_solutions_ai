import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Transaction, InventoryItem, User } from '../types';

export interface CustomerInfo {
    name?: string;
    phone?: string;
}
const RUPEE = "\u20B9";
export const generateInvoicePDF = async (transaction: Transaction, inventoryMap: Map<string, InventoryItem>, user: User | null, customerInfo?: CustomerInfo) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 14;
    
    // --- Header Branding ---
    // Add a subtle top accent bar
    doc.setFillColor(31, 41, 55); // Dark Slate
    doc.rect(0, 0, pageWidth, 15, 'F');
    
    // Shop Name (Stylized)
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(user?.shop_name?.toUpperCase() || 'ELECTRICALS', margin, 10);
    
    // Reset Text Color
    doc.setTextColor(31, 41, 55);
    
    // --- Invoice Title & Meta ---
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('INVOICE', margin, 35);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Invoice Number: #${transaction.id.substring(0, 8).toUpperCase()}`, margin, 42);
    doc.text(`Date of Issue: ${new Date(transaction.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}`, margin, 47);
    
    // --- From & To Section ---
    const sectionY = 60;
    
    // From (Shop Details)
    doc.setTextColor(31, 41, 55);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('FROM:', margin, sectionY);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(user?.shop_name || 'Electricals', margin, sectionY + 7);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    let fromOffset = sectionY + 12;
    if(user?.email) {
        doc.text(user.email, margin, fromOffset);
        fromOffset += 5;
    }
    if(user?.phone) {
        doc.text(`Ph: ${user.phone}`, margin, fromOffset);
    }
    
    // To (Customer Details)
    const col2X = pageWidth / 2 + 10;
    doc.setTextColor(31, 41, 55);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('BILL TO:', col2X, sectionY);
    
    if (customerInfo?.name || customerInfo?.phone || transaction.customer_name) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(customerInfo?.name || transaction.customer_name || 'Valued Customer', col2X, sectionY + 7);
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        if (customerInfo?.phone || transaction.customer_phone) {
            doc.text(`Ph: ${customerInfo?.phone || transaction.customer_phone}`, col2X, sectionY + 12);
        }
    } else {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(150, 150, 150);
        doc.text('Cash Sale / Walk-in Customer', col2X, sectionY + 7);
    }
    
    // --- Table Section ---
    const tableColumn = ["#", "Item Description", "Qty", "Rate (${RUPEE})", "Amount (${RUPEE})"];
    const tableRows: (string | number)[][] = [];
    
    let subtotal = 0;
    let totalGst = 0;
    const itemsToInvoice = transaction.items.filter(item => item.status !== 'returned');

    itemsToInvoice.forEach((item, index) => {
        const unitPrice = item.totalPrice / item.quantity;
        let rate = unitPrice;
        if (item.has_gst) {
            rate = unitPrice / 1.18; 
        }
        const taxableAmount = rate * item.quantity;
        
        tableRows.push([
            index + 1,
            `${item.productName}${item.sale_type === 'bundle' ? ` (Bundle)` : ''}`,
            item.quantity,
            rate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        ]);

        subtotal += taxableAmount;
        if (item.has_gst) {
            totalGst += item.totalPrice - taxableAmount;
        }
    });

    autoTable(doc, {
        startY: 90,
        head: [tableColumn],
        body: tableRows,
        theme: 'grid',
        headStyles: { 
            fillColor: [31, 41, 55], 
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center'
        },
        columnStyles: {
            0: { halign: 'center', cellWidth: 10 },
            2: { halign: 'center', cellWidth: 20 },
            3: { halign: 'right', cellWidth: 35 },
            4: { halign: 'right', cellWidth: 35 }
        },
        styles: {
            fontSize: 9,
            cellPadding: 4
        },
        alternateRowStyles: {
            fillColor: [250, 250, 250]
        }
    });

    const finalY = (doc as any).lastAutoTable.finalY || 120;

    // --- Summary Section ---
    const summaryWidth = 80;
    const summaryX = pageWidth - margin - summaryWidth;
    let summaryY = finalY + 10;

    // Background for summary
    doc.setFillColor(245, 245, 245);
    doc.rect(summaryX - 5, summaryY - 5, summaryWidth + 5, 35 + (totalGst > 0 ? 15 : 0), 'F');

    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.setFont('helvetica', 'normal');
    
    doc.text(`Subtotal:`, summaryX, summaryY + 2);
    doc.text(`(${RUPEE})${subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, pageWidth - margin, summaryY + 2, { align: 'right' });
    
    if (totalGst > 0) {
        const cgst = totalGst / 2;
        const sgst = totalGst / 2;
        summaryY += 7;
        doc.text(`CGST (9%):`, summaryX, summaryY + 2);
        doc.text(`(${RUPEE})${cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, pageWidth - margin, summaryY + 2, { align: 'right' });
        summaryY += 7;
        doc.text(`SGST (9%):`, summaryX, summaryY + 2);
        doc.text(`(${RUPEE})${sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, pageWidth - margin, summaryY + 2, { align: 'right' });
    }
    
    summaryY += 10;
    doc.setDrawColor(200, 200, 200);
    doc.line(summaryX, summaryY - 3, pageWidth - margin, summaryY - 3);
    
    doc.setFontSize(12);
    doc.setTextColor(31, 41, 55);
    doc.setFont('helvetica', 'bold');
    doc.text(`GRAND TOTAL:`, summaryX, summaryY + 3);
    const grandTotal = itemsToInvoice.reduce((acc, i) => acc + i.totalPrice, 0);
    doc.text(`(${RUPEE})${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, pageWidth - margin, summaryY + 3, { align: 'right' });
    
    // --- Signature & Footer ---
    let footerY = pageHeight - 25;
    
    if (user && user.signature_url) {
        try {
            const response = await fetch(user.signature_url);
            const blob = await response.blob();
            const reader = new FileReader();
            const dataUrl = await new Promise<string>((resolve, reject) => {
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
            
            const sigX = pageWidth - margin - 40;
            const sigY = summaryY + 20;
            doc.addImage(dataUrl, 'PNG', sigX, sigY, 35, 12);
            doc.setDrawColor(150, 150, 150);
            doc.line(sigX, sigY + 14, sigX + 40, sigY + 14);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'italic');
            doc.text('Authorized Signature', sigX + 20, sigY + 19, { align: 'center' });
        } catch (e) {
            console.error("Could not add signature image to PDF", e);
        }
    }

    // Bottom Footer
    doc.setDrawColor(230, 230, 230);
    doc.line(margin, pageHeight - 20, pageWidth - margin, pageHeight - 20);
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text('Thank you for your business!', pageWidth / 2, pageHeight - 12, { align: 'center' });
    doc.text('This is a computer-generated document and does not require a physical signature.', pageWidth / 2, pageHeight - 8, { align: 'center' });

    // Save PDF
    const pdfBlob = doc.output('blob');
    const blobUrl = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `Invoice-${transaction.id.substring(0,8).toUpperCase()}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
};