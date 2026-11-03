// Which alerts were already posted, so a reload does not repost them.
// Stored per browser. Losing it only causes a repeat post, never a missed one.

const KEY = 'tendo.chatAlertsSent';
const MAX = 200;

export function readSentAlerts(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function markAlertSent(id: string): void {
  try {
    const list = readSentAlerts().filter((x) => x !== id);
    list.push(id);
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)));
  } catch {
    /* storage unavailable: alerts may repeat after reload */
  }
}

/** Text posted to Google Chat for a deadline warning. Plain text, no HTML. */
export function formatChatAlert(title: string, message: string): string {
  return `Deadline reminder: ${title}\n${message}\nVerify on the source notice before bidding.`;
}
