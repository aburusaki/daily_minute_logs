
export const getTodayKey = (): string => {
  return new Date().toISOString().split('T')[0];
};

export const formatTime = (minuteIndex: number): string => {
  const hours = Math.floor(minuteIndex / 60);
  const minutes = minuteIndex % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

export const getCurrentMinuteIndex = (): number => {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
};

export const getCurrentSeconds = (): number => {
  return new Date().getSeconds();
};

export const isFutureMinute = (index: number, dateKey: string): boolean => {
  const today = getTodayKey();
  if (dateKey < today) return false;
  if (dateKey > today) return true;
  return index > getCurrentMinuteIndex();
};

export const isCurrentMinute = (index: number, dateKey: string): boolean => {
  const today = getTodayKey();
  return dateKey === today && index === getCurrentMinuteIndex();
};
