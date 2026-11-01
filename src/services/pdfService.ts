import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { KhataTransaction, Expense, LongTermLoan, Profile } from '../types';

export const pdfService = {
  /**
   * Helper to format currency
   */
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(amount);
  },

  /**
   * Common Header for branded NEXMONEY reports
   */
  drawHeader(doc: jsPDF, title: string, profile: Profile | null, dateRange?: string) {
    // Primary Header Background Bar (Midnight Navy #0F172A)
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 32, 'F');

    // Brand Name NEXMONEY (Gold #F59E0B / White)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(245, 158, 11); // Gold accent
    doc.text('NEXMONEY', 14, 15);

    // Subtitle
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(203, 213, 225); // Slate 300
    doc.text('Personal Finance Management', 14, 22);
    doc.text('Manage Money. Stay Organized.', 14, 27);

    // Report Title & User info on right
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text(title, 196, 15, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(203, 213, 225);
    const userLine = profile?.full_name ? `${profile.full_name} (${profile.email})` : (profile?.email || 'Authenticated User');
    doc.text(`Account: ${userLine}`, 196, 22, { align: 'right' });
    const genDate = `Generated: ${new Date().toLocaleDateString('en-IN')} ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
    doc.text(dateRange ? `Period: ${dateRange} | ${genDate}` : genDate, 196, 27, { align: 'right' });

    // Reset text color for table content
    doc.setTextColor(15, 23, 42);
  },

  /**
   * Draw Footer
   */
  drawFooter(doc: jsPDF) {
    const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.line(14, 285, 196, 285);
      doc.text('NEXMONEY — Personal Finance Management. Confirmed Confidential Record.', 14, 290);
      doc.text(`Page ${i} of ${pageCount}`, 196, 290, { align: 'right' });
    }
  },

  /**
   * KHATA LEDGER PDF REPORT
   */
  generateKhataReport(transactions: KhataTransaction[], profile: Profile | null, filterPersonName?: string) {
    const doc = new jsPDF();
    const title = filterPersonName ? `Khata Ledger: ${filterPersonName}` : 'Khata Ledger Report';
    this.drawHeader(doc, title, profile);

    // Summary calculation
    let totalGiven = 0;
    let totalReceived = 0;
    let pendingCount = 0;

    transactions.forEach((tx) => {
      if (tx.type === 'GIVEN') totalGiven += Number(tx.amount);
      if (tx.type === 'RECEIVED') totalReceived += Number(tx.amount);
      if (tx.status === 'PENDING') pendingCount++;
    });

    const net = totalGiven - totalReceived;

    // Summary Box
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 38, 182, 22, 2, 2, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, 38, 182, 22, 2, 2, 'S');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);

    doc.text('Total Money Given:', 20, 46);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 38, 38); // Red
    doc.text(this.formatCurrency(totalGiven), 20, 53);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Total Money Received:', 70, 46);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 163, 74); // Green
    doc.text(this.formatCurrency(totalReceived), 70, 53);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Net Balance:', 125, 46);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(net >= 0 ? 37 : 220, net >= 0 ? 99 : 38, net >= 0 ? 235 : 38);
    doc.text(this.formatCurrency(net), 125, 53);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Pending Records:', 165, 46);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(String(pendingCount), 165, 53);

    // Table Data
    const tableBody = transactions.map((tx) => [
      tx.transaction_date,
      tx.person?.name || 'Unknown',
      tx.type,
      this.formatCurrency(Number(tx.amount)),
      tx.payment_method,
      tx.utr_number || '-',
      tx.status,
      tx.notes || '',
    ]);

    autoTable(doc, {
      startY: 66,
      head: [['Date', 'Person', 'Type', 'Amount', 'Method', 'UTR / Ref', 'Status', 'Notes']],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      styles: {
        fontSize: 8,
        cellPadding: 2.5,
      },
      columnStyles: {
        2: { fontStyle: 'bold' },
        3: { halign: 'right', fontStyle: 'bold' },
      },
      didParseCell: (data) => {
        if (data.section === 'body') {
          if (data.column.index === 2) {
            const val = data.cell.raw;
            if (val === 'GIVEN') data.cell.styles.textColor = [220, 38, 38];
            if (val === 'RECEIVED') data.cell.styles.textColor = [22, 163, 74];
          }
        }
      },
    });

    this.drawFooter(doc);
    doc.save(`NEXMONEY_Khata_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  },

  /**
   * EXPENSE PDF REPORT
   */
  generateExpenseReport(expenses: Expense[], profile: Profile | null, periodLabel?: string) {
    const doc = new jsPDF();
    this.drawHeader(doc, 'Personal Expense Statement', profile, periodLabel);

    const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

    // Summary Box
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 38, 182, 20, 2, 2, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, 38, 182, 20, 2, 2, 'S');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Total Expenses:', 20, 47);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 38, 38);
    doc.text(this.formatCurrency(total), 55, 47);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Total Entries:', 110, 47);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(String(expenses.length), 135, 47);

    // Table Data
    const tableBody = expenses.map((e) => [
      e.expense_date,
      e.category,
      this.formatCurrency(Number(e.amount)),
      e.payment_method,
      e.utr_number || '-',
      e.notes || '',
    ]);

    autoTable(doc, {
      startY: 64,
      head: [['Date', 'Category', 'Amount', 'Method', 'UTR / Ref', 'Notes']],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      styles: {
        fontSize: 8,
        cellPadding: 2.5,
      },
      columnStyles: {
        2: { halign: 'right', fontStyle: 'bold', textColor: [220, 38, 38] },
      },
    });

    this.drawFooter(doc);
    doc.save(`NEXMONEY_Expense_Statement_${new Date().toISOString().split('T')[0]}.pdf`);
  },

  /**
   * LONG-TERM LOANS PDF REPORT
   */
  generateLoanReport(loans: LongTermLoan[], profile: Profile | null) {
    const doc = new jsPDF();
    this.drawHeader(doc, 'Long-Term Loan Statement', profile);

    const totalGiven = loans.filter((l) => l.loan_type === 'GIVEN').reduce((sum, l) => sum + Number(l.original_amount), 0);
    const totalTaken = loans.filter((l) => l.loan_type === 'TAKEN').reduce((sum, l) => sum + Number(l.original_amount), 0);
    const remainingGiven = loans.filter((l) => l.loan_type === 'GIVEN').reduce((sum, l) => sum + (l.remaining_amount || 0), 0);
    const remainingTaken = loans.filter((l) => l.loan_type === 'TAKEN').reduce((sum, l) => sum + (l.remaining_amount || 0), 0);

    // Summary Box
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 38, 182, 24, 2, 2, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, 38, 182, 24, 2, 2, 'S');

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);

    doc.text('Loans Given:', 20, 46);
    doc.setFont('helvetica', 'bold');
    doc.text(this.formatCurrency(totalGiven), 20, 52);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(`Outstanding: ${this.formatCurrency(remainingGiven)}`, 20, 57);

    doc.setFontSize(8.5);
    doc.text('Loans Taken:', 80, 46);
    doc.setFont('helvetica', 'bold');
    doc.text(this.formatCurrency(totalTaken), 80, 52);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(`Outstanding: ${this.formatCurrency(remainingTaken)}`, 80, 57);

    doc.setFontSize(8.5);
    doc.text('Total Active Loans:', 140, 46);
    doc.setFont('helvetica', 'bold');
    const activeCount = loans.filter((l) => l.status === 'ACTIVE').length;
    doc.text(`${activeCount} Active (${loans.length - activeCount} Closed)`, 140, 52);

    const tableBody = loans.map((l) => [
      l.person_name,
      l.loan_type === 'GIVEN' ? 'Given (Asset)' : 'Taken (Liability)',
      this.formatCurrency(Number(l.original_amount)),
      this.formatCurrency(Number(l.total_repaid || 0)),
      this.formatCurrency(Number(l.remaining_amount ?? l.original_amount)),
      `${l.progress_pct || 0}%`,
      l.status,
      l.start_date,
      l.expected_return_date || '-',
    ]);

    autoTable(doc, {
      startY: 68,
      head: [['Counterparty', 'Type', 'Original', 'Repaid', 'Remaining', 'Progress', 'Status', 'Start Date', 'Due Date']],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
      },
      columnStyles: {
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right', fontStyle: 'bold' },
        5: { halign: 'center' },
      },
      didParseCell: (data) => {
        if (data.section === 'body') {
          if (data.column.index === 6) {
            const val = data.cell.raw;
            if (val === 'ACTIVE') data.cell.styles.textColor = [217, 119, 6];
            if (val === 'CLOSED') data.cell.styles.textColor = [22, 163, 74];
          }
        }
      },
    });

    this.drawFooter(doc);
    doc.save(`NEXMONEY_Loan_Statement_${new Date().toISOString().split('T')[0]}.pdf`);
  },
};
