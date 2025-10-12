import jsPDF from 'https://esm.sh/jspdf@2.5.1';
import autoTable from 'https://esm.sh/jspdf-autotable@3.8.2';
import { Transaction, InventoryItem, User } from '../types';

export const generateInvoicePDF = async (transaction: Transaction, inventoryMap: Map<string, InventoryItem>, user: User | null) => {
    const doc = new jsPDF();
    
    // Shop Details
    doc.setFontSize(20);
    doc.text(user?.shop_name || 'Electricals', 14, 22);
    doc.setFontSize(10);
    if(user?.email) {
        doc.text(`Email: ${user.email}`, 14, 28);
    }
    if(user?.phone) {
        doc.text(`Phone: ${user.phone}`, 14, 33);
    }
    
    // Invoice Details
    doc.setFontSize(12);
    doc.text('Tax Invoice', 150, 22);
    doc.setFontSize(10);
    doc.text(`Invoice #: ${transaction.id.substring(0, 8)}`, 150, 28);
    doc.text(`Date: ${new Date(transaction.date).toLocaleDateString()}`, 150, 33);
    
    // Table Data
    const tableColumn = ["#", "Item Description", "Qty", "Rate", "Amount"];
    const tableRows: (string | number)[][] = [];
    
    let subtotal = 0;
    let totalGst = 0;

    const itemsToInvoice = transaction.items.filter(item => item.status !== 'returned');

    itemsToInvoice.forEach((item, index) => {
        const unitPrice = item.totalPrice / item.quantity;

        let rate = unitPrice;
        if (item.has_gst) {
            // Price is inclusive of 18% GST, so calculate pre-tax rate
            rate = unitPrice / 1.18; 
        }
        
        const taxableAmount = rate * item.quantity;
        
        const rowData = [
            index + 1,
            `${item.productName}${item.sale_type === 'bundle' ? ` (Bundle)` : ''}`,
            item.quantity,
            rate.toFixed(2),
            taxableAmount.toFixed(2)
        ];
        tableRows.push(rowData);

        subtotal += taxableAmount;
        if (item.has_gst) {
            totalGst += item.totalPrice - taxableAmount;
        }
    });

    // Create Table
    autoTable(doc, {
        startY: 45,
        head: [tableColumn],
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [31, 41, 55] }
    });

    const finalY = (doc as any).lastAutoTable.finalY || 80;

    // Summary
    let summaryY = finalY + 10;
    const summaryX = 145;
    doc.setFontSize(10);
    doc.text(`Subtotal:`, summaryX, summaryY);
    doc.text(`${subtotal.toFixed(2)}`, 200, summaryY, { align: 'right' });
    
    if (totalGst > 0) {
        const cgst = totalGst / 2;
        const sgst = totalGst / 2;
        summaryY += 5;
        doc.text(`CGST (9%):`, summaryX, summaryY);
        doc.text(`${cgst.toFixed(2)}`, 200, summaryY, { align: 'right' });
        summaryY += 5;
        doc.text(`SGST (9%):`, summaryX, summaryY);
        doc.text(`${sgst.toFixed(2)}`, 200, summaryY, { align: 'right' });
    }
    
    summaryY += 7;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Grand Total:`, summaryX, summaryY);
    doc.text(`${itemsToInvoice.reduce((acc, i) => acc + i.totalPrice, 0).toFixed(2)}`, 200, summaryY, { align: 'right' });
    
    // Signature
    let footerY = doc.internal.pageSize.height - 15;
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
            
            // Add signature image and adjust footer position
            doc.addImage(dataUrl, 'PNG', 145, finalY + 25, 35, 15);
            doc.line(145, finalY + 42, 195, finalY + 42); // Line for signature
            doc.text('Authorized Signature', 150, finalY + 47);
            footerY = finalY + 60; // Push footer down
        } catch (e) {
            console.error("Could not add signature image to PDF", e);
        }
    }

    // Footer
    doc.setFontSize(8);
    doc.text('Thank you for your visit!', 14, footerY);
    doc.text('This is a computer-generated invoice.', 14, footerY + 4);

    // Save PDF
    const pdfBlob = doc.output('blob');
    const blobUrl = URL.createObjectURL(pdfBlob);

    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `Invoice-${transaction.id.substring(0,8)}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
};