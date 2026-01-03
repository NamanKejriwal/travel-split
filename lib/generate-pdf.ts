import { Group } from "@/components/views/groups-view"

export const generatePDF = (activities: any[], activeGroup: Group | null) => {
  if (!activeGroup || activities.length === 0) return;

  // 🔍 1. PRE-PROCESS DATA
  const realExpenses = activities.filter(e => !e.is_settlement);
  const settlements = activities.filter(e => e.is_settlement);
  const totalTripCost = realExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  
  // A. Member Analytics Logic (Who paid what)
  const personMap: Record<string, { paid_exp: number, paid_settle: number }> = {};
  
  // Initialize with known names from activity list to ensure everyone is included
  activities.forEach(e => {
      const name = e.profiles?.full_name || 'Unknown';
      if (!personMap[name]) personMap[name] = { paid_exp: 0, paid_settle: 0 };
      
      if (e.is_settlement) {
          personMap[name].paid_settle += Number(e.amount);
      } else {
          personMap[name].paid_exp += Number(e.amount);
      }
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

  // 📝 2. BUILD HTML CONTENT
  const printContent = `
    <html>
      <head>
        <title>${activeGroup?.name || "Trip"} - Full Expedition Report</title>
        <style>
          body { font-family: 'Helvetica', 'Arial', sans-serif; padding: 40px; color: #1f2937; line-height: 1.5; font-size: 12px; }
          .header { text-align: center; margin-bottom: 40px; border-bottom: 3px solid #00A896; padding-bottom: 20px; }
          h1 { color: #00A896; margin: 0; font-size: 28px; text-transform: uppercase; letter-spacing: 1px; }
          .meta { color: #6b7280; margin-top: 5px; font-size: 10px; }
          
          h2 { 
            color: #111827; 
            border-left: 5px solid #00A896; 
            padding-left: 12px; 
            margin-top: 35px; 
            margin-bottom: 15px;
            font-size: 16px; 
            text-transform: uppercase; 
            font-weight: 800;
          }

          table { width: 100%; border-collapse: collapse; margin-top: 10px; table-layout: fixed; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
          th, td { text-align: left; padding: 10px; border: 1px solid #e5e7eb; word-wrap: break-word; }
          th { background-color: #f3f4f6; color: #374151; font-weight: 700; font-size: 11px; text-transform: uppercase; }
          tr:nth-child(even) { background-color: #f9fafb; }
          
          .amount { text-align: right; font-family: 'Courier New', Courier, monospace; font-weight: bold; }
          .center { text-align: center; }
          
          .summary-card { 
            background: #f0fdfa; 
            border: 1px solid #ccfbf1; 
            padding: 20px; 
            border-radius: 8px; 
            display: flex; 
            justify-content: space-around; 
            margin-bottom: 30px;
          }
          .summary-item { text-align: center; }
          .summary-label { font-size: 10px; text-transform: uppercase; color: #0f766e; font-weight: bold; }
          .summary-value { font-size: 24px; font-weight: 900; color: #00A896; margin-top: 5px; }

          .settlement-text { color: #2563eb; font-style: italic; }
          .negative { color: #ef4444; }
          .positive { color: #10b981; }
          
          .page-break { page-break-before: always; }
          .footer { margin-top: 50px; text-align: center; font-size: 10px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 10px;}
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${activeGroup?.name || "Trip"} Expedition Report</h1>
          <p class="meta">Generated on ${new Date().toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short' })}</p>
        </div>

        <h2>1. Executive Summary</h2>
        <div class="summary-card">
          <div class="summary-item">
            <div class="summary-label">Total Cost</div>
            <div class="summary-value">₹${totalTripCost.toLocaleString()}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Transactions</div>
            <div class="summary-value">${activities.length}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Share Per Head</div>
            <div class="summary-value">₹${sharePerHead.toFixed(0)}</div>
          </div>
        </div>

        <h2>2. Member Financial Status (Calculated)</h2>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th class="amount">Paid (Exp)</th>
              <th class="amount">Paid (Settle)</th>
              <th class="amount">Fair Share</th>
              <th class="amount">Net Impact</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(personMap).map(([name, s]) => `
              <tr>
                <td><strong>${name}</strong></td>
                <td class="amount">₹${s.paid_exp.toFixed(0)}</td>
                <td class="amount" style="color: #6b7280;">₹${s.paid_settle.toFixed(0)}</td>
                <td class="amount">₹${sharePerHead.toFixed(0)}</td>
                <td class="amount ${(s.paid_exp + s.paid_settle - sharePerHead) >= 0 ? 'positive' : 'negative'}">
                  ₹${(s.paid_exp + s.paid_settle - sharePerHead).toFixed(0)}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <h2>3. Detailed Transaction Ledger</h2>
        <table>
          <thead>
            <tr>
              <th style="width: 90px;">Date</th>
              <th>Description</th>
              <th>Category</th>
              <th>Paid By</th>
              <th class="amount">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${activities.map(item => `
              <tr>
                <td>${new Date(item.created_at).toLocaleDateString('en-GB')}</td>
                <td class="${item.is_settlement ? 'settlement-text' : ''}">
                  ${item.is_settlement ? 'Debt Settlement' : item.description}
                </td>
                <td>${item.is_settlement ? '-' : (item.category || 'General')}</td>
                <td>${item.profiles?.full_name || 'Unknown'}</td>
                <td class="amount">₹${Number(item.amount).toLocaleString('en-IN')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="page-break"></div>

        <h2>4. Spending by Category</h2>
        <table>
          <thead><tr><th>Category</th><th class="amount">Total Amount</th><th class="center">Percentage</th></tr></thead>
          <tbody>
            ${Object.entries(catMap).sort((a,b) => b[1]-a[1]).map(([cat, amt]) => `
              <tr>
                <td>${cat}</td>
                <td class="amount">₹${amt.toFixed(0)}</td>
                <td class="center">${((amt/totalTripCost)*100).toFixed(1)}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <h2>5. Payment Liquidity (Mode)</h2>
        <table>
          <thead><tr><th>Mode</th><th class="amount">Volume</th><th class="center">Count</th><th class="center">Trip %</th></tr></thead>
          <tbody>
            ${Object.entries(modeMap).map(([mode, data]) => `
              <tr>
                <td>${mode}</td>
                <td class="amount">₹${data.amount.toFixed(0)}</td>
                <td class="center">${data.count}</td>
                <td class="center">${((data.amount/totalTripCost)*100).toFixed(1)}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <h2>6. Daily Spending Timeline</h2>
        <table>
          <thead><tr><th>Date</th><th class="amount">Daily Total</th><th class="center">Transactions</th></tr></thead>
          <tbody>
            ${Object.entries(dayMap).sort().map(([date, data]) => `
              <tr>
                <td>${date}</td>
                <td class="amount">₹${data.amount.toFixed(0)}</td>
                <td class="center">${data.count}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <h2>7. Debt Settlement History</h2>
        <table>
          <thead><tr><th>Date</th><th>Payer</th><th>Description</th><th class="amount">Amount</th></tr></thead>
          <tbody>
            ${settlements.length > 0 ? settlements.map(s => `
              <tr>
                <td>${new Date(s.created_at).toLocaleDateString('en-GB')}</td>
                <td>${s.profiles?.full_name || 'Unknown'}</td>
                <td class="settlement-text">Settlement Payment</td>
                <td class="amount">₹${Number(s.amount).toFixed(0)}</td>
              </tr>
            `).join('') : '<tr><td colspan="4" style="text-align:center; color: #9ca3af; padding: 20px;">No settlements recorded in this period.</td></tr>'}
          </tbody>
        </table>

        <div class="footer">
          End of Report • Generated by TravelSplit
        </div>
      </body>
    </html>
  `;

  const printWindow = window.open('', '', 'width=1000,height=900');
  if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      // Allow images/styles to load before printing
      setTimeout(() => {
          printWindow.print();
          printWindow.close();
      }, 800);
  }
}