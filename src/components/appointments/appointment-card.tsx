"use client";

import { Calendar, MapPin, Phone, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Appointment } from "@/lib/ics/types";

interface AppointmentCardProps {
  appointment: Appointment;
}

function formatDateTime(dateTime: string): { date: string; time: string | null } {
  if (!dateTime.includes("T")) {
    const d = new Date(dateTime + "T00:00:00");
    return {
      date: d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      time: null,
    };
  }

  const d = new Date(dateTime);
  return {
    date: d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    time: d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

export function AppointmentCard({ appointment }: AppointmentCardProps) {
  const { date, time } = formatDateTime(appointment.dateTime);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0 space-y-2">
            <h3 className="font-semibold text-lg">{appointment.title}</h3>

            <div className="flex items-center gap-2 text-gray-600">
              <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="text-base font-medium">{date}</span>
              {time && <span className="text-base">{time}</span>}
            </div>

            {appointment.doctorName && (
              <div className="flex items-center gap-2 text-gray-600">
                <User className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{appointment.doctorName}</span>
              </div>
            )}

            {appointment.location && (
              <div className="flex items-center gap-2 text-gray-600">
                <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{appointment.location}</span>
              </div>
            )}

            {appointment.officePhone && (
              <div className="flex items-center gap-2 text-gray-600">
                <Phone className="h-4 w-4 shrink-0" aria-hidden="true" />
                <a
                  href={`tel:${appointment.officePhone.replace(/[^\d+]/g, "")}`}
                  className="text-blue-600 hover:underline"
                >
                  {appointment.officePhone}
                </a>
              </div>
            )}
          </div>

          {appointment.status === "cancelled" && (
            <Badge variant="destructive">Cancelled</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
