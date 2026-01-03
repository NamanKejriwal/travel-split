import { Group } from "@/components/views/groups-view"
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export const generatePDF = (activities: any[], activeGroup: Group | null) => {
  if (!activeGroup || activities.length === 0) return;

  // 🎨 BRANDING CONSTANTS
  const PRIMARY_COLOR: [number, number, number] = [0, 168, 150]; // #00A896
  const TEXT_COLOR: [number, number, number] = [31, 41, 55]; // Dark Gray
  const COMPANY_NAME = "TravelSplit";

  // 🔍 1. PRE-PROCESS DATA
  const realExpenses = activities.filter(e => !e.is_settlement);
  const settlements = activities.filter(e => e.is_settlement);
  const totalTripCost = realExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  
  // A. Member Analytics (Balances)
  const personMap: Record<string, { paid_exp: number, paid_settle: number }> = {};
  activities.forEach(e => {
      const name = e.profiles?.full_name || 'Unknown';
      if (!personMap[name]) personMap[name] = { paid_exp: 0, paid_settle: 0 };
      if (e.is_settlement) personMap[name].paid_settle += Number(e.amount);
      else personMap[name].paid_exp += Number(e.amount);
  });
  const memberCount = Object.keys(personMap).length;
  const sharePerHead = memberCount > 0 ? totalTripCost / memberCount : 0;

  // B. Category Logic
  const catMap: Record<string, number> = {};
  realExpenses.forEach(e => {
      const c = e.category || 'Other';
      catMap[c] = (catMap[c] || 0) + Number(e.amount);
  });

  // C. Payment Mode Logic
  const modeMap: Record<string, { amount: number, count: number }> = {};
  realExpenses.forEach(e => {
      const m = e.payment_mode || 'UPI';
      if (!modeMap[m]) modeMap[m] = { amount: 0, count: 0 };
      modeMap[m].amount += Number(e.amount);
      modeMap[m].count += 1;
  });

  // D. Daily Velocity Logic
  const dayMap: Record<string, { amount: number, count: number }> = {};
  realExpenses.forEach(e => {
      const d = new Date(e.created_at).toLocaleDateString('en-GB');
      if (!dayMap[d]) dayMap[d] = { amount: 0, count: 0 };
      dayMap[d].amount += Number(e.amount);
      dayMap[d].count += 1;
  });

  // 📝 2. GENERATE PDF DOCUMENT
  const doc = new jsPDF();
  
  // -- HELPER: ADD HEADER --
  const addHeader = (y: number, title: string) => {
      doc.setFontSize(14);
      doc.setTextColor(TEXT_COLOR[0], TEXT_COLOR[1], TEXT_COLOR[2]);
      doc.setFont("helvetica", "bold");
      
      // Draw colored bar
      doc.setDrawColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
      doc.setLineWidth(1.5);
      doc.line(14, y - 2, 14, y + 6); // Left border accent
      
      doc.text(title, 18, y + 5);
      return y + 10;
  };

  // -- MAIN TITLE & BRANDING --
  doc.setFontSize(24);
  doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
  doc.setFont("helvetica", "bold");
  doc.text(COMPANY_NAME, 14, 20);

  doc.setFontSize(18);
  doc.setTextColor(TEXT_COLOR[0], TEXT_COLOR[1], TEXT_COLOR[2]);
  doc.text(`${activeGroup.name || "Trip"} Report`, 14, 30);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated on ${new Date().toLocaleString('en-IN')}`, 14, 36);
  
  doc.setLineWidth(0.5);
  doc.setDrawColor(200, 200, 200);
  doc.line(14, 40, 196, 40);

  // -- 1. EXECUTIVE SUMMARY --
  let currentY = 50;
  currentY = addHeader(currentY, "1. Executive Summary");

  const summaryData = [
      ['Total Trip Cost', `Rs. ${totalTripCost.toLocaleString()}`],
      ['Total Transactions', activities.length.toString()],
      ['Cost Per Person', `Rs. ${sharePerHead.toFixed(0)}`]
  ];

  autoTable(doc, {
      startY: currentY,
      head: [['Metric', 'Value']],
      body: summaryData,
      theme: 'grid',
      headStyles: { fillColor: PRIMARY_COLOR, fontStyle: 'bold' },
      columnStyles: { 
          0: { fontStyle: 'bold', cellWidth: 80 },
          1: { halign: 'right' }
      },
      margin: { left: 14, right: 100 }
  });

  // -- 2. DETAILED EXPENSE LEDGER --
  // @ts-ignore
  currentY = doc.lastAutoTable.finalY + 15;
  
  // Basic check to ensure we don't start too low
  if (currentY > 240) { doc.addPage(); currentY = 20; }

  currentY = addHeader(currentY, "2. Detailed Expense Ledger");

  const ledgerRows = realExpenses.map(item => [
      new Date(item.created_at).toLocaleDateString('en-GB'),
      item.description,
      item.category || 'General',
      item.profiles?.full_name || 'Unknown',
      `Rs. ${Number(item.amount).toLocaleString('en-IN')}`
  ]);

  autoTable(doc, {
      startY: currentY,
      head: [['Date', 'Description', 'Category', 'Paid By', 'Amount']],
      body: ledgerRows,
      theme: 'striped',
      headStyles: { fillColor: PRIMARY_COLOR },
      columnStyles: { 
          4: { halign: 'right', font: 'courier' } 
      },
      showHead: 'everyPage'
  });

  // -- 3. MEMBER FINANCIAL STATUS --
  // @ts-ignore
  currentY = doc.lastAutoTable.finalY + 15;
  if (currentY > 240) { doc.addPage(); currentY = 20; }
  
  currentY = addHeader(currentY, "3. Member Financial Status");

  const balanceRows = Object.entries(personMap).map(([name, s]) => {
      const net = s.paid_exp + s.paid_settle - sharePerHead;
      return [
          name,
          `Rs. ${s.paid_exp.toFixed(0)}`,
          `Rs. ${s.paid_settle.toFixed(0)}`,
          `Rs. ${sharePerHead.toFixed(0)}`,
          `Rs. ${net.toFixed(0)}`
      ];
  });

  autoTable(doc, {
      startY: currentY,
      head: [['Name', 'Paid (Exp)', 'Paid (Settle)', 'Fair Share', 'Net Impact']],
      body: balanceRows,
      theme: 'striped',
      headStyles: { fillColor: PRIMARY_COLOR },
      columnStyles: { 
          1: { halign: 'right' }, 
          2: { halign: 'right' }, 
          3: { halign: 'right' }, 
          4: { halign: 'right', fontStyle: 'bold' }
      },
      didParseCell: function(data: any) {
          if (data.section === 'body' && data.column.index === 4) {
              const val = parseFloat(data.cell.raw.replace(/[^0-9.-]+/g,""));
              if (val < -1) data.cell.styles.textColor = [239, 68, 68]; // Red
              else if (val > 1) data.cell.styles.textColor = [16, 185, 129]; // Green
          }
      }
  });

  // -- 4. SPENDING BY CATEGORY --
  // @ts-ignore
  currentY = doc.lastAutoTable.finalY + 15;
  if (currentY > 240) { doc.addPage(); currentY = 20; }
  
  if (Object.keys(catMap).length > 0) {
      currentY = addHeader(currentY, "4. Spending by Category");
      
      const catRows = Object.entries(catMap)
          .sort((a,b) => b[1]-a[1])
          .map(([cat, amt]) => [
              cat,
              `Rs. ${amt.toFixed(0)}`,
              `${((amt/totalTripCost)*100).toFixed(1)}%`
          ]);

      autoTable(doc, {
          startY: currentY,
          head: [['Category', 'Total Amount', 'Share']],
          body: catRows,
          theme: 'striped',
          headStyles: { fillColor: PRIMARY_COLOR },
          columnStyles: { 
              1: { halign: 'right' }, 
              2: { halign: 'center' } 
          },
      });
  }

  // -- 5. PAYMENT MODE ANALYSIS --
  // @ts-ignore
  currentY = doc.lastAutoTable.finalY + 15;
  if (currentY > 240) { doc.addPage(); currentY = 20; }

  if (Object.keys(modeMap).length > 0) {
      currentY = addHeader(currentY, "5. Payment Mode Analysis");

      const modeRows = Object.entries(modeMap).map(([mode, data]) => [
          mode,
          data.count.toString(),
          `Rs. ${data.amount.toFixed(0)}`,
          `${((data.amount/totalTripCost)*100).toFixed(1)}%`
      ]);

      autoTable(doc, {
          startY: currentY,
          head: [['Mode', 'Txn Count', 'Total Volume', 'Share']],
          body: modeRows,
          theme: 'striped',
          headStyles: { fillColor: PRIMARY_COLOR },
          columnStyles: { 
              1: { halign: 'center' },
              2: { halign: 'right' },
              3: { halign: 'center' }
          }
      });
  }

  // -- 6. DAILY SPENDING TIMELINE --
  // @ts-ignore
  currentY = doc.lastAutoTable.finalY + 15;
  if (currentY > 240) { doc.addPage(); currentY = 20; }

  if (Object.keys(dayMap).length > 0) {
      currentY = addHeader(currentY, "6. Daily Spending Timeline");

      const dayRows = Object.entries(dayMap).sort().map(([date, data]) => [
          date,
          data.count.toString(),
          `Rs. ${data.amount.toFixed(0)}`
      ]);

      autoTable(doc, {
          startY: currentY,
          head: [['Date', 'Transactions', 'Daily Total']],
          body: dayRows,
          theme: 'striped',
          headStyles: { fillColor: PRIMARY_COLOR },
          columnStyles: { 
              1: { halign: 'center' },
              2: { halign: 'right' }
          }
      });
  }

  // -- 7. DEBT SETTLEMENT HISTORY --
  // @ts-ignore
  currentY = doc.lastAutoTable.finalY + 15;
  if (currentY > 240) { doc.addPage(); currentY = 20; }

  if (settlements.length > 0) {
      currentY = addHeader(currentY, "7. Debt Settlement History");

      const settlementRows = settlements.map(s => [
          new Date(s.created_at).toLocaleDateString('en-GB'),
          s.profiles?.full_name || 'Unknown',
          `Rs. ${Number(s.amount).toLocaleString('en-IN')}`
      ]);

      autoTable(doc, {
          startY: currentY,
          head: [['Date', 'Payer', 'Amount Settled']],
          body: settlementRows,
          theme: 'striped',
          headStyles: { fillColor: PRIMARY_COLOR },
          columnStyles: { 2: { halign: 'right' } }
      });
  }

  // -- FOOTER --
  const pageCount = doc.getNumberOfPages();
  for(let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `Page ${i} of ${pageCount} • Generated by TravelSplit`, 
        doc.internal.pageSize.width / 2, 
        doc.internal.pageSize.height - 10, 
        { align: 'center' }
      );
  }

  // SAVE FILE
  const filename = `${(activeGroup.name || "Trip").replace(/\s+/g, '_')}_Full_Report.pdf`;
  doc.save(filename);
}