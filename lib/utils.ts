export function formatTimestamp(timestamp?: string | number | Date | null): string {
  if (timestamp === null || timestamp === undefined) {
    return '—';
  }

  if (typeof timestamp === 'string' && timestamp.trim() === '') {
    return '—';
  }

  try {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
      return '—';
    }

    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
    }).format(date);
  } catch {
    return '—';
  }
}
