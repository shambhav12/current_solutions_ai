import jsPDF from 'https://esm.sh/jspdf@2.5.1';
import autoTable from 'https://esm.sh/jspdf-autotable@3.8.2';
import { Transaction, InventoryItem } from '../types';

export const generateInvoicePDF = (transaction: Transaction, inventoryMap: Map<string, InventoryItem>) => {
    // Explicitly apply the autoTable plugin to the jsPDF instance.
    // This is more reliable than side-effect imports with ES modules.
    const doc = new jsPDF();
    
    // Shop Details
    doc.setFontSize(20);
    doc.text('Electricals', 14, 22);
    doc.setFontSize(12);
    doc.text('Tax Invoice', 14, 30);
    
    // Invoice Details
    doc.setFontSize(10);
    doc.text(`Invoice #: ${transaction.id}`, 14, 40);
    doc.text(`Date: ${new Date(transaction.date).toLocaleDateString()}`, 14, 45);
    
    // Table Data
    const tableColumn = ["#", "Item Description", "Qty", "Rate (₹)", "Amount (₹)"];
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

    // Create Table by calling the autoTable function
    autoTable(doc, {
        startY: 55,
        head: [tableColumn],
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [31, 41, 55] } // slate-800
    });

    // This gets the y-coordinate of the bottom of the table
    // The plugin attaches lastAutoTable to the doc instance.
    const finalY = (doc as any).lastAutoTable.finalY || 80;

    // Summary
    const summaryX = 145;
    doc.setFontSize(10);
    doc.text(`Subtotal:`, summaryX, finalY + 10);
    doc.text(`₹${subtotal.toFixed(2)}`, 200, finalY + 10, { align: 'right' });
    
    if (totalGst > 0) {
        doc.text(`GST (18%):`, summaryX, finalY + 15);
        doc.text(`₹${totalGst.toFixed(2)}`, 200, finalY + 15, { align: 'right' });
    }
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Grand Total:`, summaryX, finalY + 22);
    doc.text(`₹${itemsToInvoice.reduce((acc, i) => acc + i.totalPrice, 0).toFixed(2)}`, 200, finalY + 22, { align: 'right' });
    
    // Footer
    doc.setFontSize(8);
    doc.text('Thank you for your business!', 14, doc.internal.pageSize.height - 10);

    // Save PDF
    doc.save(`Invoice-${transaction.id}.pdf`);
};
