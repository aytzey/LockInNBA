export const EST_TZ = "America/New_York";

export function getEstDateKey(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: EST_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function formatEstDateTime(dateTime: string): string {
  const date = new Date(dateTime);
  if (Number.isNaN(date.getTime())) {
    return "TBD";
  }

  return date.toLocaleString("en-US", {
    timeZone: EST_TZ,
    weekday: "short",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatEstDate(date: string): string {
  const dateObj = new Date(date);
  if (Number.isNaN(dateObj.getTime())) {
    return "";
  }

  return dateObj.toLocaleDateString("en-US", {
    timeZone: EST_TZ,
    weekday: "long",
    month: "short",
    day: "2-digit",
  });
}
