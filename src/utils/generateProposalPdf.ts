import { jsPDF } from 'jspdf';
import { BidCalculation, BOQItem, CompanyProfile, CurrencyType, ProposalDocument, Tender } from '../types';

function formatInrForPdf(amount: number): string {
  if (isNaN(amount) || amount === 0) return 'INR 0';
  const inrValue = amount >= 1000000 && amount < 100000000 ? amount : amount * 83;

  if (inrValue >= 10000000) {
    return `INR ${(inrValue / 10000000).toFixed(2)} Cr`;
  }
  if (inrValue >= 100000) {
    return `INR ${(inrValue / 100000).toFixed(2)} Lakh`;
  }
  return `INR ${Math.round(inrValue).toLocaleString('en-IN')}`;
}

function formatRawAmountForPdf(amount: number): string {
  if (isNaN(amount)) return 'INR 0';
  const inrVal = amount < 5000 ? Math.round(amount * 83) : Math.round(amount);
  return `INR ${inrVal.toLocaleString('en-IN')}`;
}

export function generateProposalPdf({
  tender,
  calculation,
  boqItems,
  companyProfile,
  proposal,
}: {
  tender: Tender;
  calculation: BidCalculation;
  boqItems: BOQItem[];
  companyProfile: CompanyProfile;
  proposal: ProposalDocument | null;
  currency?: CurrencyType;
}): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2;
  const primaryColor = [77, 107, 47]; // Olive green #4d6b2f
  const primaryDark = [63, 87, 36]; // #3f5724
  const darkTextColor = [28, 25, 23]; // stone-900
  const mutedTextColor = [87, 83, 78]; // stone-600
  const lightBgColor = [250, 249, 246]; // stone-50
  const borderColor = [228, 224, 218]; // stone-200

  let currentY = 14;

  const drawPageHeader = (pageNumber: number) => {
    if (pageNumber > 1) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
      doc.text(companyProfile.name.toUpperCase(), marginX, 10);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
      doc.text(`Tender Ref: ${tender.refNumber} | Official Bid Submission`, pageWidth - marginX, 10, {
        align: 'right',
      });

      doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
      doc.setLineWidth(0.3);
      doc.line(marginX, 12, pageWidth - marginX, 12);
    }
  };

  const drawPageFooter = (pageNumber: number, totalPagesPlaceholder: number) => {
    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.setLineWidth(0.3);
    doc.line(marginX, pageHeight - 12, pageWidth - marginX, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
    doc.text(
      `TenDo Tender Intelligence System | Confidential Document | Submitted by ${companyProfile.name}`,
      marginX,
      pageHeight - 7
    );
    doc.text(`Page ${pageNumber} of ${totalPagesPlaceholder}`, pageWidth - marginX, pageHeight - 7, {
      align: 'right',
    });
  };

  const checkPageBreak = (neededHeight: number): void => {
    if (currentY + neededHeight > pageHeight - 18) {
      doc.addPage();
      currentY = 16;
      drawPageHeader(doc.getNumberOfPages());
    }
  };

  // ================= PAGE 1: COVER & EXECUTIVE BRIEF =================
  // Top Banner (Olive Green Gradient Style)
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(marginX, currentY, contentWidth, 24, 'F');

  // Banner Subtext
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('GOVERNMENT OF INDIA e-PROCUREMENT • OFFICIAL BID SUBMISSION', marginX + 4, currentY + 6);

  // Banner Main Company Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(companyProfile.name, marginX + 4, currentY + 14);

  // Sub-banner credentials
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(
    'CPWD Class-1 Registered Engineering Consortium • Quality & Safety Management Certified',
    marginX + 4,
    currentY + 20
  );

  // Date and Ref on the right of banner
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(`Ref: TD/SUB/${tender.refNumber}`, pageWidth - marginX - 4, currentY + 9, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, pageWidth - marginX - 4, currentY + 15, {
    align: 'right',
  });
  doc.text('Status: OFFICIAL TENDER BID', pageWidth - marginX - 4, currentY + 20, { align: 'right' });

  currentY += 28;

  // Company Profile Credentials Card
  doc.setFillColor(lightBgColor[0], lightBgColor[1], lightBgColor[2]);
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.setLineWidth(0.4);
  doc.roundedRect(marginX, currentY, contentWidth, 25, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
  doc.text('BIDDER CREDENTIALS & OPERATIONAL CAPACITY PROFILE', marginX + 3.5, currentY + 4.5);

  const colW = contentWidth / 4;
  const row1Y = currentY + 10;
  const row2Y = currentY + 18;

  // Col 1: Turnover & Solvency
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
  doc.text('Annual Turnover:', marginX + 3.5, row1Y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
  doc.text(formatInrForPdf(companyProfile.annualTurnover), marginX + 3.5, row1Y + 3.8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
  doc.text('Bank Solvency / BG Limit:', marginX + 3.5, row2Y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
  doc.text(formatInrForPdf(companyProfile.availableSolvency), marginX + 3.5, row2Y + 3.8);

  // Col 2: Past Rating & Win Rate
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
  doc.text('Past Performance Rating:', marginX + colW + 2, row1Y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
  doc.text(`${companyProfile.pastPerformanceRating} / 5.0 Stars (A+)`, marginX + colW + 2, row1Y + 3.8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
  doc.text('Historical Win Rate:', marginX + colW + 2, row2Y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
  doc.text(`${companyProfile.historicalWinRate}% Track Record`, marginX + colW + 2, row2Y + 3.8);

  // Col 3: Capacity & Plant
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
  doc.text('Operational Bandwidth:', marginX + colW * 2 + 2, row1Y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
  doc.text(
    `${companyProfile.activeProjectsCount} / ${companyProfile.maxProjectCapacity} Projects (${100 - companyProfile.currentCapacityUtilizationPercent}% Free)`,
    marginX + colW * 2 + 2,
    row1Y + 3.8
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
  doc.text('Machinery Fleet:', marginX + colW * 2 + 2, row2Y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
  doc.text(`${companyProfile.heavyMachineryCount} Heavy Plant Units`, marginX + colW * 2 + 2, row2Y + 3.8);

  // Col 4: Certifications
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
  doc.text('Active Certifications:', marginX + colW * 3 + 2, row1Y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
  doc.text('ISO 9001 • ISO 45001', marginX + colW * 3 + 2, row1Y + 3.8);
  doc.text('ISO 14001 • CPWD Class-1', marginX + colW * 3 + 2, row2Y + 3.8);

  currentY += 29;

  // Tender Overview Block
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.roundedRect(marginX, currentY, contentWidth, 23, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
  doc.text('GOVERNMENT TENDER OPPORTUNITY DETAILS', marginX + 3.5, currentY + 4.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
  const splitTitle = doc.splitTextToSize(tender.title, contentWidth - 7);
  doc.text(splitTitle.slice(0, 2), marginX + 3.5, currentY + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
  doc.text(
    `Authority: ${tender.authority}  |  Portal: ${tender.portal}  |  Location: ${tender.location}`,
    marginX + 3.5,
    currentY + 15
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
  doc.text(
    `NIT Est: ${formatInrForPdf(tender.budget)}   |   Offered Bid: ${formatInrForPdf(calculation.totalBidAmount)} (${
      calculation.varianceAgainstTenderBudgetPercent >= 0 ? '+' : ''
    }${calculation.varianceAgainstTenderBudgetPercent}%)   |   Duration: ${tender.completionDurationDays} Days`,
    marginX + 3.5,
    currentY + 20
  );

  currentY += 27;

  // Executive Cover Letter Section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
  doc.text('EXECUTIVE LETTER TO THE TENDER INVITING AUTHORITY (TIA)', marginX, currentY);
  currentY += 4;

  const letterText =
    proposal?.executiveCoverLetter ||
    `To: The Tender Inviting Authority (TIA)\n${tender.authority}\n\nSubject: Formal Technical & Financial Bid Submission for "${tender.title}" (Ref: ${tender.refNumber})\n\nDear Sir/Madam,\n\nWe, ${companyProfile.name}, have thoroughly examined the Tender Documents, General and Special Conditions of Contract, Technical Specifications, and the Bill of Quantities (BOQ). We hereby offer to execute and complete the entire works in conformity with the tender conditions for the competitive sum of ${formatInrForPdf(
      calculation.totalBidAmount
    )}.\n\nOur bid has been engineered through real-time market cost analysis, incorporating prevailing indexation for structural steel, high-strength cement, aggregates, and statutory fair wages. We confirm our unreserved acceptance of all contractual milestones and submit herewith our Earnest Money Deposit and all mandatory pre-qualification credentials.\n\nRespectfully submitted,\nAuthorized Signatory\n${companyProfile.name}`;

  doc.setFont('times', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
  const splitLetter = doc.splitTextToSize(letterText, contentWidth - 4);

  // Background box for letter
  const letterHeight = Math.min(splitLetter.length * 3.7 + 5, 80);
  doc.setFillColor(lightBgColor[0], lightBgColor[1], lightBgColor[2]);
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.roundedRect(marginX, currentY, contentWidth, letterHeight, 1.5, 1.5, 'FD');

  doc.text(splitLetter.slice(0, 21), marginX + 2.5, currentY + 4.5);
  currentY += letterHeight + 6;

  // ================= PAGE 2: FINANCIAL SUMMARY & BOQ TABLE =================
  doc.addPage();
  currentY = 16;
  drawPageHeader(2);

  // Section Heading: Financial Summary
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
  doc.text('COMPREHENSIVE FINANCIAL BREAKDOWN & COST ESTIMATION (INR)', marginX, currentY);
  currentY += 4;

  // 4 Financial Summary KPI cards
  const kpiWidth = (contentWidth - 6) / 4;
  const kpiHeight = 15;

  const kpis = [
    { title: 'DIRECT MATERIALS', value: formatInrForPdf(calculation.directMaterialsCost), color: primaryDark },
    { title: 'WORKFORCE PAYROLL', value: formatInrForPdf(calculation.directLaborCost), color: darkTextColor },
    { title: 'EQUIPMENT & FREIGHT', value: formatInrForPdf(calculation.transportLogisticsCost), color: darkTextColor },
    { title: 'TOTAL OFFERED BID', value: formatInrForPdf(calculation.totalBidAmount), color: primaryDark },
  ];

  kpis.forEach((kpi, index) => {
    const kpiX = marginX + index * (kpiWidth + 2);
    doc.setFillColor(lightBgColor[0], lightBgColor[1], lightBgColor[2]);
    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.roundedRect(kpiX, currentY, kpiWidth, kpiHeight, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
    doc.text(kpi.title, kpiX + 2.5, currentY + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(kpi.value, kpiX + 2.5, currentY + 10.5);
  });

  currentY += kpiHeight + 5;

  // Detailed Cost Sub-Totals Strip
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.roundedRect(marginX, currentY, contentWidth, 14, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
  doc.text(
    `Site Preliminaries & QA (${calculation.preliminariesOverheadCost ? '3.8%' : '4.0%'}): ${formatInrForPdf(
      calculation.preliminariesOverheadCost
    )}   |   Commodity Escalation Buffer (3.5%): ${formatInrForPdf(calculation.contingencyBufferCost)}`,
    marginX + 3,
    currentY + 5
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
  doc.text(
    `Base Execution Cost: ${formatInrForPdf(calculation.baseCost)}   |   Contractor Margin (${
      calculation.marginPercent
    }%): +${formatInrForPdf(calculation.marginAmount)}   |   Statutory GST (${calculation.taxPercent}%): +${formatInrForPdf(
      calculation.taxAmount
    )}`,
    marginX + 3,
    currentY + 10.5
  );

  currentY += 19;

  // BOQ Table Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
  doc.text('ITEMIZED BILL OF QUANTITIES (BOQ) SCHEDULE', marginX, currentY);
  currentY += 4;

  // Table Columns Widths: Description (75mm), Category (30mm), Qty & Unit (27mm), Unit Rate (24mm), Total (26mm) = 182mm
  const colDesc = 75;
  const colCat = 30;
  const colQty = 27;
  const colRate = 24;
  const colTotal = 26;

  // Draw Table Header Bar
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(marginX, currentY, contentWidth, 7, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text('ITEM DESCRIPTION', marginX + 2, currentY + 4.8);
  doc.text('CATEGORY', marginX + colDesc + 2, currentY + 4.8);
  doc.text('QTY / UNIT', marginX + colDesc + colCat + 2, currentY + 4.8);
  doc.text('RATE (INR)', marginX + colDesc + colCat + colQty + 2, currentY + 4.8);
  doc.text('TOTAL AMOUNT', marginX + colDesc + colCat + colQty + colRate + colTotal - 2, currentY + 4.8, {
    align: 'right',
  });

  currentY += 7;

  // Render BOQ Items
  boqItems.forEach((item, index) => {
    checkPageBreak(8);

    const isEven = index % 2 === 0;
    if (isEven) {
      doc.setFillColor(255, 255, 255);
    } else {
      doc.setFillColor(lightBgColor[0], lightBgColor[1], lightBgColor[2]);
    }
    doc.rect(marginX, currentY, contentWidth, 6.5, 'F');

    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.setLineWidth(0.2);
    doc.line(marginX, currentY + 6.5, marginX + contentWidth, currentY + 6.5);

    // Description
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
    const truncatedName = item.name.length > 48 ? `${item.name.slice(0, 46)}...` : item.name;
    doc.text(truncatedName, marginX + 2, currentY + 4.3);

    // Category
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
    doc.text(item.category, marginX + colDesc + 2, currentY + 4.3);

    // Qty
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
    doc.text(`${item.quantity.toLocaleString()} ${item.unit}`, marginX + colDesc + colCat + 2, currentY + 4.3);

    // Rate
    doc.text(
      formatRawAmountForPdf(item.unitRate).replace('INR ', ''),
      marginX + colDesc + colCat + colQty + 2,
      currentY + 4.3
    );

    // Total
    doc.setFont('helvetica', 'bold');
    doc.text(formatInrForPdf(item.total), marginX + colDesc + colCat + colQty + colRate + colTotal - 2, currentY + 4.3, {
      align: 'right',
    });

    currentY += 6.5;
  });

  // Table Total Footer
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(marginX, currentY, contentWidth, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('TOTAL BASE DIRECT COSTS (BEFORE TAX & OVERHEADS)', marginX + 2, currentY + 4.8);
  doc.text(
    formatInrForPdf(calculation.baseCost),
    marginX + colDesc + colCat + colQty + colRate + colTotal - 2,
    currentY + 4.8,
    { align: 'right' }
  );

  currentY += 12;

  // ================= PAGE 3: STRATEGIC JUSTIFICATION & QA/QC =================
  doc.addPage();
  currentY = 16;
  drawPageHeader(3);

  // Section 1: Cost Justification Narrative
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
  doc.text('1. DATA-DRIVEN COST & MARKET PRICE JUSTIFICATION (INR)', marginX, currentY);
  currentY += 4;

  const costNarrative =
    proposal?.costJustificationNarrative ||
    `Our financial estimate of ${formatInrForPdf(
      calculation.totalBidAmount
    )} represents a disciplined, data-backed quotation that delivers optimal value to the government without sacrificing structural integrity or delivery timelines:\n\n1. Raw Materials & Commodities (${formatInrForPdf(
      calculation.directMaterialsCost
    )}): Direct pricing based on current mill spot rates for Fe550D TMT Steel and 53-Grade OPC Cement with volume procurement agreements.\n2. Workforce & Manpower (${formatInrForPdf(
      calculation.directLaborCost
    )}): Engineered on an estimated ${calculation.totalManDays || 22500} man-days across certified site engineers, skilled bar-benders, masons, and general helpers adhering strictly to statutory minimum wages and EPF/ESIC social security provisions.\n3. Equipment & Logistics (${formatInrForPdf(
      calculation.transportLogisticsCost || 2400000
    )}): Dedicated deployment of heavy machinery (Tower Cranes, JCBs, Concrete Transit Mixers) owned and operated directly by ${
      companyProfile.name
    }, eliminating third-party rental markups.\n4. Hedging & Buffer (${formatInrForPdf(
      calculation.contingencyBufferCost
    )}): A prudent contingency reserve to insulate the project against unexpected commodity spikes or diesel freight hikes.`;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
  const splitCost = doc.splitTextToSize(costNarrative, contentWidth - 4);
  const costBoxH = Math.min(splitCost.length * 3.4 + 4, 45);

  doc.setFillColor(lightBgColor[0], lightBgColor[1], lightBgColor[2]);
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.roundedRect(marginX, currentY, contentWidth, costBoxH, 1.5, 1.5, 'FD');
  doc.text(splitCost.slice(0, 13), marginX + 2.5, currentY + 4);

  currentY += costBoxH + 6;

  // Section 2: Execution Schedule & Manpower Timeline
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
  doc.text('2. PROJECT DELIVERY PHASES & MANPOWER SCHEDULE', marginX, currentY);
  currentY += 4;

  const scheduleNarrative =
    proposal?.executionScheduleNarrative ||
    `The works shall be completed strictly within ${tender.completionDurationDays} calendar days structured across four synchronized operational gates:\n- Phase 1 (Days 1–45): Site handover, perimeter fencing, geotechnical validation, temporary site offices, and substructure excavation.\n- Phase 2 (Days 46–150): Foundation raft, columns, and super-structure RCC framing up to completion.\n- Phase 3 (Days 151–280): Masonry walls, internal plastering, MEP cabling, fire safety conduits, and architectural facade installations.\n- Phase 4 (Days 281–${tender.completionDurationDays}): Finishes, weathercoat exterior painting, testing & commissioning, statutory agency approvals, and final handover.`;

  const splitSchedule = doc.splitTextToSize(scheduleNarrative, contentWidth - 4);
  const scheduleBoxH = Math.min(splitSchedule.length * 3.4 + 4, 38);

  doc.setFillColor(lightBgColor[0], lightBgColor[1], lightBgColor[2]);
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.roundedRect(marginX, currentY, contentWidth, scheduleBoxH, 1.5, 1.5, 'FD');
  doc.text(splitSchedule.slice(0, 11), marginX + 2.5, currentY + 4);

  currentY += scheduleBoxH + 6;

  // Section 3: QA/QC and Safety Plan
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
  doc.text('3. QUALITY ASSURANCE & HEALTH/SAFETY COMPLIANCE CHARTER', marginX, currentY);
  currentY += 4;

  const qaNarrative =
    proposal?.qualityAndSafetyPlan ||
    `We enforce a Zero-Accident, Zero-Defect Quality Assurance (QA/QC) charter:\n- 100% third-party batch testing for all cement and steel consignments through government-accredited NABL laboratories.\n- Daily concrete cube compressive strength tests (7-day and 28-day curing intervals).\n- Strict compliance with ISO 45001 safety mandates, personal protective equipment (PPE) enforcement, and site paramedic coverage.`;

  const splitQa = doc.splitTextToSize(qaNarrative, contentWidth - 4);
  const qaBoxH = Math.min(splitQa.length * 3.4 + 4, 32);

  doc.setFillColor(lightBgColor[0], lightBgColor[1], lightBgColor[2]);
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.roundedRect(marginX, currentY, contentWidth, qaBoxH, 1.5, 1.5, 'FD');
  doc.text(splitQa.slice(0, 9), marginX + 2.5, currentY + 4);

  currentY += qaBoxH + 8;

  // Section 4: Authorized Signatory & Digital Stamp Block
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setLineWidth(0.6);
  doc.roundedRect(marginX, currentY, contentWidth, 30, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
  doc.text('OFFICIAL SUBMISSION VERIFICATION & CORPORATE ENDORSEMENT', marginX + 4, currentY + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
  doc.text(`Authorized Signatory: Head of Estimations & Tenders`, marginX + 4, currentY + 11.5);
  doc.text(`Entity: ${companyProfile.name}`, marginX + 4, currentY + 16.5);
  doc.text(`Official CPWD Class-1 License & Corporate Seal Affixed`, marginX + 4, currentY + 21.5);
  doc.text(`Submission Timestamp: ${new Date().toISOString()}`, marginX + 4, currentY + 26);

  // Digital Signature Box on the Right
  const dscBoxX = pageWidth - marginX - 58;
  doc.setFillColor(lightBgColor[0], lightBgColor[1], lightBgColor[2]);
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.setLineWidth(0.3);
  doc.roundedRect(dscBoxX, currentY + 3.5, 54, 23, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
  doc.text('CLASS-3 DIGITAL SIGNATURE (DSC)', dscBoxX + 2.5, currentY + 7.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
  doc.text(`Signer: ${companyProfile.name}`, dscBoxX + 2.5, currentY + 11.5);
  doc.text(`Cert Hash: SHA256-${tender.id.slice(-6)}-${Date.now().toString().slice(-6)}`, dscBoxX + 2.5, currentY + 15.5);
  doc.text(`Validity: VERIFIED & COMPLIANT`, dscBoxX + 2.5, currentY + 19.5);
  doc.text(`Govt. e-Procurement Portal (GeM/CPPP)`, dscBoxX + 2.5, currentY + 23);

  // Footer for all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawPageFooter(i, totalPages);
  }

  // Trigger download
  const cleanRef = tender.refNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${companyProfile.name.split(' ')[0]}_Proposal_${cleanRef}.pdf`;
  doc.save(filename);
}
