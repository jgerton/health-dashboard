/**
 * Types for parsed iCalendar (.ics) appointment data.
 */

export interface Appointment {
  id: string;
  uid: string;
  title: string;
  dateTime: string;
  endDateTime?: string;
  location?: string;
  doctorName?: string;
  officePhone?: string;
  description?: string;
  status: "upcoming" | "past" | "cancelled";
  sourceFile?: string;
  importedAt: string;
}

export interface IcsParseResult {
  appointments: Appointment[];
  skipped: number;
  errors: string[];
}
