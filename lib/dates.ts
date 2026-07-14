export function formatLibraryDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function isActiveLoan(status: string): boolean {
  return status === "BORROWED" || status === "OVERDUE";
}

export function isDueSoon(dueDate: string, now = new Date()): boolean {
  const difference = new Date(dueDate).getTime() - now.getTime();
  return difference >= 0 && difference <= 7 * 24 * 60 * 60 * 1000;
}
