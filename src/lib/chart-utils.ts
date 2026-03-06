export interface HistoryPoint {
  time: string;
  value: number;
}

export interface CandlePoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function calculateEMA(
  data: HistoryPoint[],
  period: number
): HistoryPoint[] {
  if (data.length < period) return [];
  const k = 2 / (period + 1);
  const result: HistoryPoint[] = [];
  let sum = 0;
  for (let i = 0; i < period; i++) sum += data[i].value;
  let ema = sum / period;
  result.push({
    time: data[period - 1].time,
    value: Math.round(ema * 1000) / 1000,
  });
  for (let i = period; i < data.length; i++) {
    ema = data[i].value * k + ema * (1 - k);
    result.push({ time: data[i].time, value: Math.round(ema * 1000) / 1000 });
  }
  return result;
}

export function generateDailyCandles(data: HistoryPoint[]): CandlePoint[] {
  if (data.length < 2) return [];
  const candles: CandlePoint[] = [];
  for (let i = 1; i < data.length; i++) {
    const open = data[i - 1].value;
    const close = data[i].value;
    candles.push({
      time: data[i].time,
      open,
      close,
      high: Math.max(open, close),
      low: Math.min(open, close),
    });
  }
  return candles;
}

export function generateWeeklyCandles(data: HistoryPoint[]): CandlePoint[] {
  if (data.length === 0) return [];
  const weeks = new Map<string, { time: string; values: number[] }>();
  for (const d of data) {
    const date = new Date(d.time + "T00:00:00");
    const day = date.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(date);
    monday.setDate(date.getDate() + mondayOffset);
    const weekKey = formatDate(monday);
    if (!weeks.has(weekKey)) weeks.set(weekKey, { time: weekKey, values: [] });
    weeks.get(weekKey)!.values.push(d.value);
  }
  return Array.from(weeks.values()).map((w) => ({
    time: w.time,
    open: w.values[0],
    high: Math.max(...w.values),
    low: Math.min(...w.values),
    close: w.values[w.values.length - 1],
  }));
}

export function getTimeframeFrom(tf: string): string {
  const now = new Date();
  switch (tf) {
    case "1M":
      now.setDate(now.getDate() - 30);
      break;
    case "3M":
      now.setMonth(now.getMonth() - 3);
      break;
    case "6M":
      now.setMonth(now.getMonth() - 6);
      break;
    case "1Y":
      now.setFullYear(now.getFullYear() - 1);
      break;
    default:
      return "1990-01-01";
  }
  return formatDate(now);
}
