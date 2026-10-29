import React, { useState, useEffect } from 'react';
import { BidCalculation, BOQItem, CommodityPrice, CompanyProfile, CurrencyType, Tender } from '../types';
import { formatCurrency, formatRawAmount } from '../utils/formatters';
import { SECTOR_BOQ_TEMPLATES } from '../data/initialData';
import {
  Calculator,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Truck,
  Users,
  HardHat,
  ShieldAlert,
  Percent,
  CheckCircle2,
  FileCheck,
  ChevronRight,
  Plus,
  Trash2,
  Layers,
  Sparkles,
} from 'lucide-react';

interface CostEstimationEngineProps {
  tender: Tender;
  currency: CurrencyType;
  commodities: CommodityPrice[];
  companyProfile: CompanyProfile;
  onProceedToProposal: (tender: Tender, calculation: BidCalculation, boqItems: BOQItem[]) => void;
  onRefreshCommodities: () => void;
}

export const CostEstimationEngine: React.FC<CostEstimationEngineProps> = ({
  tender,
  currency,
  commodities,
  companyProfile,
  onProceedToProposal,
  onRefreshCommodities,
}) => {
  const initialTemplateKey = tender.defaultBiddingTemplate || 'civil_building';
  const initialItems = SECTOR_BOQ_TEMPLATES[initialTemplateKey]?.items || SECTOR_BOQ_TEMPLATES.civil_building.items;

  const [boqItems, setBoqItems] = useState<BOQItem[]>(initialItems);
  const [selectedTemplate, setSelectedTemplate] = useState<string>(initialTemplateKey);

  // Workforce & execution timeline state
  const [completionDays, setCompletionDays] = useState<number>(tender.completionDurationDays || 365);
  const [engineerCount, setEngineerCount] = useState<number>(6);
  const [engineerDailySalary, setEngineerDailySalary] = useState<number>(2800); // ₹2,800/day
  const [skilledWorkerCount, setSkilledWorkerCount] = useState<number>(45);
  const [skilledWorkerDailySalary, setSkilledWorkerDailySalary] = useState<number>(950); // ₹950/day
  const [unskilledWorkerCount, setUnskilledWorkerCount] = useState<number>(70);
  const [unskilledWorkerDailySalary, setUnskilledWorkerDailySalary] = useState<number>(600); // ₹600/day

  // Financial multipliers
  const [contingencyPercent, setContingencyPercent] = useState<number>(3.5);
  const [overheadPercent, setOverheadPercent] = useState<number>(3.8);
  const [contractorMarginPercent, setContractorMarginPercent] = useState<number>(companyProfile.targetMarginPercent || 12.5);
  const [taxPercent, setTaxPercent] = useState<number>(18.0); // GST 18%

  useEffect(() => {
    const key = tender.defaultBiddingTemplate || 'civil_building';
    setSelectedTemplate(key);
    if (SECTOR_BOQ_TEMPLATES[key]) {
      setBoqItems(SECTOR_BOQ_TEMPLATES[key].items);
    }
    setCompletionDays(tender.completionDurationDays || 365);
  }, [tender.id]);

  const [priceSyncWarning, setPriceSyncWarning] = useState<string | null>(null);

  const handleSyncCommodities = () => {
    setPriceSyncWarning(
      'No verified live price provider is connected. No sample rate was copied into the BOQ; enter verified supplier quotations manually.'
    );
    onRefreshCommodities();
  };

  const handleUpdateItem = (id: string, field: 'quantity' | 'unitRate', value: number) => {
    setBoqItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const qty = field === 'quantity' ? value : item.quantity;
          const rate = field === 'unitRate' ? value : item.unitRate;
          return {
            ...item,
            [field]: value,
            total: Math.round(qty * rate),
          };
        }
        return item;
      })
    );
  };

  const handleDeleteItem = (id: string) => {
    setBoqItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleAddItem = () => {
    const newItem: BOQItem = {
      id: `custom-${Date.now()}`,
      category: 'Materials',
      name: 'Custom CPWD Specification Item',
      unit: 'Unit',
      quantity: 100,
      unitRate: 4500,
      total: 450000,
      isFluctuating: false,
    };
    setBoqItems((prev) => [...prev, newItem]);
  };

  const handleTemplateChange = (tplKey: string) => {
    setSelectedTemplate(tplKey);
    if (SECTOR_BOQ_TEMPLATES[tplKey]) {
      setBoqItems(SECTOR_BOQ_TEMPLATES[tplKey].items);
    }
  };

  // Calculations
  const directMaterialsCost = boqItems
    .filter((i) => i.category === 'Materials')
    .reduce((acc, i) => acc + i.total, 0);

  const tableLaborCost = boqItems
    .filter((i) => i.category === 'Labor')
    .reduce((acc, i) => acc + i.total, 0);

  const engineerTotalCost = engineerCount * completionDays * engineerDailySalary;
  const skilledWorkerTotalCost = skilledWorkerCount * Math.round(completionDays * 0.88) * skilledWorkerDailySalary;
  const unskilledWorkerTotalCost = unskilledWorkerCount * Math.round(completionDays * 0.88) * unskilledWorkerDailySalary;

  const directLaborCost = tableLaborCost > 0 ? tableLaborCost : engineerTotalCost + skilledWorkerTotalCost + unskilledWorkerTotalCost;
  const totalWorkers = engineerCount + skilledWorkerCount + unskilledWorkerCount;
  const totalManDays = Math.round(
    engineerCount * completionDays +
    (skilledWorkerCount + unskilledWorkerCount) * (completionDays * 0.88)
  );

  const transportAndEquipmentCost = boqItems
    .filter((i) => i.category === 'Equipment & Transport')
    .reduce((acc, i) => acc + i.total, 0);

  const rawSubtotal = directMaterialsCost + directLaborCost + transportAndEquipmentCost;
  const preliminariesOverheadCost = Math.round(rawSubtotal * (overheadPercent / 100));
  const contingencyBufferCost = Math.round(rawSubtotal * (contingencyPercent / 100));
  const baseCost = rawSubtotal + preliminariesOverheadCost + contingencyBufferCost;
  const marginAmount = Math.round(baseCost * (contractorMarginPercent / 100));
  const preTaxSubtotal = baseCost + marginAmount;
  const taxAmount = Math.round(preTaxSubtotal * (taxPercent / 100));
  const totalBidAmount = preTaxSubtotal + taxAmount;

  const officialBudget = tender.budget;
  const varianceAmount = totalBidAmount - officialBudget;
  const variancePercent = Number(((varianceAmount / officialBudget) * 100).toFixed(1));

  // Price variance alone cannot support a credible probability of winning.
  const calculatedWinProbability = 0;

  const currentCalculation: BidCalculation = {
    directMaterialsCost,
    directLaborCost,
    transportLogisticsCost: transportAndEquipmentCost,
    equipmentMachineryCost: transportAndEquipmentCost,
    preliminariesOverheadCost,
    contingencyBufferCost,
    baseCost,
    marginPercent: contractorMarginPercent,
    marginAmount,
    taxPercent,
    taxAmount,
    totalBidAmount,
    varianceAgainstTenderBudgetPercent: variancePercent,
    winProbability: calculatedWinProbability,
    strategyType:
      contractorMarginPercent <= 8
        ? 'Aggressive (L1)'
        : contractorMarginPercent >= 16
        ? 'Defensive (Premium)'
        : 'Balanced (Optimal)',
    totalManDays,
    workerCount: totalWorkers,
    equipmentAndTransportCost: transportAndEquipmentCost,
  };

  return (
    <div className="space-y-6">
      {/* Tender Context Card */}
      <div className="p-5 rounded-3xl bg-white border border-stone-200 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-[#4d6b2f]/10 text-[#3f5724] border border-[#4d6b2f]/30">
                {tender.sector}
              </span>
              <span className="text-xs text-stone-500 font-mono font-bold">{tender.refNumber}</span>
              <span className="text-xs text-stone-300">&bull;</span>
              <span className="text-xs text-stone-600 font-medium">{tender.portal}</span>
            </div>
            <h2 className="text-xl font-black text-stone-900 tracking-tight">{tender.title}</h2>
            <p className="text-xs text-stone-500 mt-1">
              Authority: <strong className="text-stone-800">{tender.authority}</strong> | Official NIT
              Budget:{' '}
              <strong className="text-[#3f5724] text-sm font-mono font-black">
                {formatCurrency(tender.budget, 'INR')}
              </strong>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncCommodities}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-[#3f5724] border border-stone-200 text-xs font-bold transition"
              title="No verified live commodity-price provider is connected"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#4d6b2f]" />
              <span>Check Price Source</span>
            </button>

            <button
              onClick={() => onProceedToProposal(tender, currentCalculation, boqItems)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#4d6b2f] hover:bg-[#3f5724] text-white text-xs font-bold shadow-xs transition active:scale-95"
            >
              <FileCheck className="w-4 h-4" />
              <span>Draft Proposal Explainer</span>
            </button>
          </div>
        </div>

        {/* Template Selector */}
        <div className="mt-4 pt-4 border-t border-stone-100 flex items-center gap-2 overflow-x-auto scrollbar-none text-xs">
          <span className="text-stone-500 font-semibold flex items-center gap-1 shrink-0">
            <Layers className="w-3.5 h-3.5 text-stone-400" />
            Sector BOQ Template:
          </span>
          {Object.entries(SECTOR_BOQ_TEMPLATES).map(([key, tpl]) => (
            <button
              key={key}
              onClick={() => handleTemplateChange(key)}
              className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition font-semibold ${
                selectedTemplate === key
                  ? 'bg-[#4d6b2f] text-white shadow-2xs'
                  : 'bg-stone-100 text-stone-600 hover:text-stone-900'
              }`}
            >
              {tpl.name}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <h3 className="text-sm font-extrabold">BOQ template rates are illustrative assumptions</h3>
          <p className="text-xs leading-relaxed">
            No verified live material-price provider is connected. These are not supplier quotations.
            Check quantities, units, current local quotes, taxes, EMD, logistics and tender price-variation clauses before relying on an estimate.
          </p>
          {priceSyncWarning && <p role="status" className="text-xs font-bold">{priceSyncWarning}</p>}
        </div>
      </div>

      {/* Main Grid: Left BOQ & Labor breakdown, Right Financial Summary & Pricing Optimizer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: BOQ & Labor inputs (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Building Construction Real-Time Commodities Breakdown */}
          <div className="p-5 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black text-stone-900 text-base flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-[#4d6b2f]" />
                  <span>Itemized Bill of Quantities (BOQ) & Raw Materials</span>
                </h3>
                <p className="text-xs text-stone-500">
                  Real-time Indian market unit rates for Fe550 Steel, M-Sand, 53-Grade Cement, Paints & RMC
                </p>
              </div>

              <button
                onClick={handleAddItem}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200 text-xs font-bold transition"
              >
                <Plus className="w-3.5 h-3.5 text-[#4d6b2f]" />
                <span>Add Item</span>
              </button>
            </div>

            {/* BOQ Table */}
            <div className="overflow-x-auto rounded-2xl border border-stone-200">
              <table className="w-full text-left text-xs text-stone-700">
                <thead className="bg-stone-50 text-stone-600 uppercase text-[10px] tracking-wider border-b border-stone-200 font-bold">
                  <tr>
                    <th className="py-2.5 px-3">Item / Description</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-2 text-right">Quantity</th>
                    <th className="py-2.5 px-2 text-right">Rate (₹)</th>
                    <th className="py-2.5 px-3 text-right">Total (₹)</th>
                    <th className="py-2.5 px-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 bg-white font-mono">
                  {boqItems.map((item) => (
                    <tr key={item.id} className="hover:bg-stone-50 transition">
                      <td className="py-2.5 px-3 font-sans">
                        <div className="font-bold text-stone-900 flex items-center gap-1.5">
                          {item.name}
                          {item.isFluctuating && (
                            <span
                              className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"
                              title="Illustrative template item; rate needs verification"
                            ></span>
                          )}
                        </div>
                        {item.notes && (
                          <div className="text-[10px] text-stone-500 font-sans mt-0.5">{item.notes}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.category === 'Materials'
                              ? 'bg-[#4d6b2f]/10 text-[#3f5724] border border-[#4d6b2f]/20'
                              : item.category === 'Labor'
                              ? 'bg-amber-500/10 text-amber-800 border border-amber-500/20'
                              : 'bg-stone-100 text-stone-700'
                          }`}
                        >
                          {item.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleUpdateItem(item.id, 'quantity', Number(e.target.value))}
                          className="w-20 px-1.5 py-1 rounded-lg bg-stone-50 border border-stone-200 text-right text-stone-900 text-xs font-bold focus:outline-none focus:border-[#4d6b2f] font-mono"
                        />
                        <div className="text-[10px] text-stone-400 font-sans mt-0.5">{item.unit}</div>
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0.1"
                          value={item.unitRate}
                          onChange={(e) => handleUpdateItem(item.id, 'unitRate', Number(e.target.value))}
                          className="w-20 px-1.5 py-1 rounded-lg bg-stone-50 border border-stone-200 text-right text-stone-900 text-xs font-bold focus:outline-none focus:border-[#4d6b2f] font-mono"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-stone-900">
                        {formatCurrency(item.total, 'INR')}
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-1 rounded text-stone-400 hover:text-rose-600 transition"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total Materials Subtotal */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-stone-50 border border-stone-200 text-xs">
              <span className="text-stone-600 font-medium">Total Materials & Freight Subtotal:</span>
              <span className="font-black text-stone-900 text-sm font-mono">
                {formatCurrency(directMaterialsCost, 'INR')}
              </span>
            </div>
          </div>

          {/* Granular Workforce, Days to Complete & Salary Details */}
          <div className="p-5 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black text-stone-900 text-base flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#4d6b2f]" />
                  <span>Workforce Man-Days & Worker Daily Salaries</span>
                </h3>
                <p className="text-xs text-stone-500">
                  Calculate total days to complete building and worker daily wage rates (INR)
                </p>
              </div>

              <div className="px-3 py-1 rounded-full bg-[#4d6b2f]/10 border border-[#4d6b2f]/30 text-[#3f5724] text-xs font-bold font-mono">
                {totalManDays.toLocaleString()} Total Man-Days
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200">
                <label className="text-[11px] font-bold text-stone-600 block mb-1">
                  Days to Complete Building
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="15"
                    max="1000"
                    value={completionDays}
                    onChange={(e) => setCompletionDays(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-stone-200 text-sm font-black text-stone-900 focus:outline-none focus:border-[#4d6b2f]"
                  />
                  <span className="text-xs text-stone-500 font-medium">Days</span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200">
                <label className="text-[11px] font-bold text-stone-600 block mb-1">
                  Site Civil Engineers (Count)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={engineerCount}
                    onChange={(e) => setEngineerCount(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-stone-200 text-sm font-black text-stone-900 focus:outline-none focus:border-[#4d6b2f]"
                  />
                  <span className="text-xs text-stone-500 font-medium">Engs</span>
                </div>
                <div className="text-[10px] text-stone-500 mt-1 font-mono">
                  Rate: ₹{engineerDailySalary}/day
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200">
                <label className="text-[11px] font-bold text-stone-600 block mb-1">
                  Skilled Masons & Benders
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="200"
                    value={skilledWorkerCount}
                    onChange={(e) => setSkilledWorkerCount(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-stone-200 text-sm font-black text-stone-900 focus:outline-none focus:border-[#4d6b2f]"
                  />
                  <span className="text-xs text-stone-500 font-medium">Workers</span>
                </div>
                <div className="text-[10px] text-stone-500 mt-1 font-mono">
                  Rate: ₹{skilledWorkerDailySalary}/day
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200">
                <label className="text-[11px] font-bold text-stone-600 block mb-1">
                  General Helpers & Hands
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="400"
                    value={unskilledWorkerCount}
                    onChange={(e) => setUnskilledWorkerCount(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-stone-200 text-sm font-black text-stone-900 focus:outline-none focus:border-[#4d6b2f]"
                  />
                  <span className="text-xs text-stone-500 font-medium">Helpers</span>
                </div>
                <div className="text-[10px] text-stone-500 mt-1 font-mono">
                  Rate: ₹{unskilledWorkerDailySalary}/day
                </div>
              </div>
            </div>

            {/* Total Labor Salary Summary */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-stone-50 border border-stone-200 text-xs">
              <span className="text-stone-600 font-medium">
                Total Direct Labor & Statutory Payroll ({totalWorkers} Employees over {completionDays} days):
              </span>
              <span className="font-black text-[#3f5724] text-sm font-mono">
                {formatCurrency(directLaborCost, 'INR')}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Pricing Strategy, Margin Sliders & Final Budget Ask (1 Col) */}
        <div className="space-y-6">
          {/* Strategic Bid Positioning Card */}
          <div className="p-5 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-4">
            <div>
              <h3 className="font-black text-stone-900 text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#4d6b2f]" />
                <span>Strategic Bid Positioning</span>
              </h3>
              <p className="text-xs text-stone-500">
                Model bid cost and margin assumptions. The applicable evaluation method must be confirmed from the tender.
              </p>
            </div>

            {/* 3 Strategy Buttons */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <button
                onClick={() => setContractorMarginPercent(7.0)}
                className={`p-2.5 rounded-2xl border transition ${
                  contractorMarginPercent <= 8
                    ? 'bg-amber-500/10 border-amber-500 text-amber-900 font-bold'
                    : 'bg-stone-50 border-stone-200 text-stone-600 hover:text-stone-900'
                }`}
              >
                <div className="text-[11px] font-bold">Aggressive L1</div>
                <div className="text-xs mt-1 font-mono">7% Margin</div>
                <div className="text-[10px] text-stone-500 font-semibold mt-0.5">No win odds estimated</div>
              </button>

              <button
                onClick={() => setContractorMarginPercent(12.5)}
                className={`p-2.5 rounded-2xl border transition ${
                  contractorMarginPercent > 8 && contractorMarginPercent < 16
                    ? 'bg-[#4d6b2f] text-white border-[#4d6b2f] font-bold shadow-xs'
                    : 'bg-stone-50 border-stone-200 text-stone-600 hover:text-stone-900'
                }`}
              >
                <div className="text-[11px] font-bold">Optimal Sweet-Spot</div>
                <div className="text-xs mt-1 font-mono">12.5% Margin</div>
                <div className="text-[10px] text-stone-200 font-medium mt-0.5">No win odds estimated</div>
              </button>

              <button
                onClick={() => setContractorMarginPercent(18.0)}
                className={`p-2.5 rounded-2xl border transition ${
                  contractorMarginPercent >= 16
                    ? 'bg-stone-200 border-stone-400 text-stone-900 font-bold'
                    : 'bg-stone-50 border-stone-200 text-stone-600 hover:text-stone-900'
                }`}
              >
                <div className="text-[11px] font-bold">Defensive Buffer</div>
                <div className="text-xs mt-1 font-mono">18% Margin</div>
                <div className="text-[10px] text-stone-500 mt-0.5">No win odds estimated</div>
              </button>
            </div>

            {/* Financial Multiplier Sliders */}
            <div className="space-y-3 pt-2">
              <div>
                <div className="flex justify-between text-xs mb-1 font-medium">
                  <span className="text-stone-600">Contractor Profit Margin</span>
                  <span className="font-bold text-[#3f5724] font-mono">{contractorMarginPercent}%</span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="25"
                  step="0.5"
                  value={contractorMarginPercent}
                  onChange={(e) => setContractorMarginPercent(Number(e.target.value))}
                  className="w-full accent-[#4d6b2f] cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1 font-medium">
                  <span className="text-stone-600">Contingency / Commodity Risk Buffer</span>
                  <span className="font-bold text-amber-700 font-mono">{contingencyPercent}%</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="8"
                  step="0.5"
                  value={contingencyPercent}
                  onChange={(e) => setContingencyPercent(Number(e.target.value))}
                  className="w-full accent-amber-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1 font-medium">
                  <span className="text-stone-600">Site Overheads, QA & Compliance</span>
                  <span className="font-bold text-stone-800 font-mono">{overheadPercent}%</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="8"
                  step="0.2"
                  value={overheadPercent}
                  onChange={(e) => setOverheadPercent(Number(e.target.value))}
                  className="w-full accent-stone-600 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Structured Financial Reporting & Budget Ask Card */}
          <div className="p-6 rounded-3xl bg-white border-2 border-[#4d6b2f]/30 shadow-md space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <h3 className="font-black text-stone-900 text-base">Comprehensive Tender Budget Ask</h3>
              <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#4d6b2f]/10 text-[#3f5724]">
                Audited INR
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-stone-600">
                <span>Direct Raw Materials:</span>
                <span className="text-stone-900 font-bold font-mono">{formatCurrency(directMaterialsCost, 'INR')}</span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>Workforce Salary & Wages:</span>
                <span className="text-stone-900 font-bold font-mono">{formatCurrency(directLaborCost, 'INR')}</span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>Equipment & Transport Freight:</span>
                <span className="text-stone-900 font-bold font-mono">{formatCurrency(transportAndEquipmentCost, 'INR')}</span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>Site Overheads & QA ({overheadPercent}%):</span>
                <span className="text-stone-900 font-bold font-mono">{formatCurrency(preliminariesOverheadCost, 'INR')}</span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>Commodity Escalation Buffer ({contingencyPercent}%):</span>
                <span className="text-amber-800 font-bold font-mono">{formatCurrency(contingencyBufferCost, 'INR')}</span>
              </div>

              <div className="pt-2 border-t border-stone-200 flex justify-between font-bold text-stone-800">
                <span>Base Execution Cost Floor:</span>
                <span className="font-mono">{formatCurrency(baseCost, 'INR')}</span>
              </div>

              <div className="flex justify-between text-[#3f5724] font-bold">
                <span>Contractor Margin ({contractorMarginPercent}%):</span>
                <span className="font-mono">+{formatCurrency(marginAmount, 'INR')}</span>
              </div>

              <div className="flex justify-between text-stone-600">
                <span>Statutory GST ({taxPercent}%):</span>
                <span className="font-mono font-bold text-stone-800">+{formatCurrency(taxAmount, 'INR')}</span>
              </div>

              {/* Total Bid Amount Highlight in Olive Green theme */}
              <div className="pt-3 border-t-2 border-[#4d6b2f]/30 p-4 rounded-2xl bg-[#4d6b2f]/10 border border-[#4d6b2f]/30">
                <span className="text-[11px] text-[#3f5724] uppercase tracking-wider block font-bold">
                  Final Competitive Tender Bid Price (INR)
                </span>
                <span className="text-2xl font-black text-stone-900 font-mono block mt-1">
                  {formatCurrency(totalBidAmount, 'INR')}
                </span>
                <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-[#4d6b2f]/20">
                  <span className="text-stone-600">vs Official NIT Estimate:</span>
                  <span
                    className={`font-black font-mono ${
                      variancePercent <= 0 ? 'text-[#3f5724]' : 'text-rose-600'
                    }`}
                  >
                    {variancePercent <= 0 ? `${variancePercent}% (Discount)` : `+${variancePercent}% (Premium)`}
                  </span>
                </div>
              </div>
            </div>

            {/* Win Probability Bar */}
            <div className="space-y-1.5 pt-2">
              <div className="flex justify-between text-xs">
                <span className="text-stone-600 font-medium">Win probability:</span>
                <span className="font-black text-[#3f5724]">Not estimated</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-stone-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-linear-to-r from-lime-600 to-[#4d6b2f] transition-all duration-500"
                  style={{ width: '0%' }}
                ></div>
              </div>
            </div>

            {/* Action CTA */}
            <button
              onClick={() => onProceedToProposal(tender, currentCalculation, boqItems)}
              className="w-full py-3.5 rounded-2xl bg-[#4d6b2f] hover:bg-[#3f5724] text-white font-bold text-sm shadow-md transition active:scale-98 flex items-center justify-center gap-2"
            >
              <FileCheck className="w-4 h-4" />
              <span>Generate Official Proposal Document</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
