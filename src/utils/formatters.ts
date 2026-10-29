import { CurrencyType } from '../types';

export function formatCurrency(amount: number, _currency: CurrencyType = 'INR'): string {
  if (isNaN(amount) || amount === 0) return '₹0';

  // If amount is given in Lakh/Crore scale (amounts >= 1 Cr = 10,000,000)
  // Our base figures are scaled appropriately for Indian Gov Tenders
  const inrValue = amount >= 1000000 && amount < 100000000 ? amount : amount * 83;

  if (inrValue >= 10000000) {
    return `₹${(inrValue / 10000000).toFixed(2)} Cr`;
  }
  if (inrValue >= 100000) {
    return `₹${(inrValue / 100000).toFixed(2)} Lakh`;
  }
  return `₹${Math.round(inrValue).toLocaleString('en-IN')}`;
}

/** Format a tender or company value in the currency supplied by its source; never infer FX rates. */
export function formatTenderValue(amount: number, currency: CurrencyType = 'INR'): string {
  if (!Number.isFinite(amount) || amount <= 0) return 'Value not stated';
  if (currency === 'INR') {
    if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(2)} Cr`;
    if (amount >= 100_000) return `₹${(amount / 100_000).toFixed(2)} Lakh`;
    return `₹${Math.round(amount).toLocaleString('en-IN')}`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatRawAmount(amount: number, _currency: CurrencyType = 'INR'): string {
  if (isNaN(amount)) return '₹0';
  // If unit rate is under 5000, convert to realistic INR market rate if needed
  const inrVal = amount < 5000 ? Math.round(amount * 83) : Math.round(amount);
  return `₹${inrVal.toLocaleString('en-IN')}`;
}

export function getTimeRemaining(deadlineIso: string): { text: string; isUrgent: boolean; isExpired: boolean } {
  if (!deadlineIso || !deadlineIso.trim()) {
    return { text: 'Deadline not stated', isUrgent: false, isExpired: false };
  }
  const deadline = Date.parse(deadlineIso);
  if (!Number.isFinite(deadline)) {
    return { text: 'Deadline needs verification', isUrgent: false, isExpired: false };
  }
  const diff = deadline - Date.now();
  if (diff <= 0) {
    return { text: 'Closed / Expired', isUrgent: true, isExpired: true };
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  if (days === 0) {
    return {
      text: `${remainingHours}h remaining`,
      isUrgent: true,
      isExpired: false,
    };
  }

  return {
    text: `${days}d ${remainingHours}h remaining`,
    isUrgent: days <= 2,
    isExpired: false,
  };
}

export function getSectorBadgeColor(sector: string): string {
  switch (sector) {
    case 'Civil Construction':
      return 'bg-[#4d6b2f]/10 text-[#3f5724] border-[#4d6b2f]/30';
    case 'Roads & Highways':
      return 'bg-amber-500/10 text-amber-800 border-amber-500/30';
    case 'IT & Cloud':
      return 'bg-teal-500/10 text-teal-800 border-teal-500/30';
    case 'Healthcare & MedTech':
      return 'bg-emerald-500/10 text-emerald-800 border-emerald-500/30';
    case 'Renewable Energy':
      return 'bg-[#556b2f]/15 text-[#3b5323] border-[#556b2f]/35';
    default:
      return 'bg-stone-200 text-stone-700 border-stone-300';
  }
}

export function getFitScoreColor(score: number): { text: string; bg: string; border: string; label: string } {
  if (score >= 80) {
    return {
      text: 'text-[#3f5724]',
      bg: 'bg-[#4d6b2f]/10',
      border: 'border-[#4d6b2f]/30',
      label: 'High Match',
    };
  }
  if (score >= 65) {
    return {
      text: 'text-amber-800',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      label: 'Moderate Match',
    };
  }
  return {
    text: 'text-rose-800',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
    label: 'Low Alignment',
  };
}
