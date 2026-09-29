// Document date inputs represent a Manila calendar day, independent of the
// browser/server timezone. Keep an existing issue time on unrelated draft edits.
export function documentDate(value: Date | string = new Date()): string {
 return new Date(new Date(value).getTime() + 8 * 3600000).toISOString().slice(0, 10);
}

export function documentTimestamp(day: string, original?: Date | string): string {
 if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('Select a valid document date.');
 const timestamp = new Date(day + 'T00:00:00+08:00');
 if (Number.isNaN(timestamp.getTime()) || documentDate(timestamp) !== day) throw new Error('Select a valid document date.');
 return original && documentDate(original) === day
  ? new Date(original).toISOString()
  : timestamp.toISOString();
}
