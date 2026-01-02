
export enum MinuteStatus {
  PRODUCTIVE = 'productive',
  UNPRODUCTIVE = 'unproductive',
  FUTURE = 'future'
}

export interface DayData {
  date: string; // YYYY-MM-DD
  minutes: MinuteStatus[]; // Length 1440
}

export interface DailySummary {
  date: string;
  productiveCount: number;
  unproductiveCount: number;
  totalLogged: number;
  productivityScore: number;
}
