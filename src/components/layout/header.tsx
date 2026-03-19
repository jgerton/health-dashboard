"use client";

import { Heart, Upload, Trash2, Shield, Lock, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  onImportClick: () => void;
  onClearData?: () => void;
  onLock?: () => void;
  patientName?: string;
  hasData?: boolean;
  currentView?: "appointments" | "dashboard";
  onViewChange?: (view: "appointments" | "dashboard") => void;
}

export function Header({
  onImportClick,
  onClearData,
  onLock,
  patientName,
  hasData,
  currentView,
  onViewChange,
}: HeaderProps) {
  return (
    <header className="border-b bg-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <Heart className="h-7 w-7 text-red-500" aria-hidden="true" />
            <div>
              <h1 className="text-lg font-bold">Health Dashboard</h1>
              {patientName && (
                <p className="text-xs text-gray-500">{patientName}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1 text-xs text-gray-400 mr-2">
              <Shield className="h-3 w-3" aria-hidden="true" />
              <span>Local only</span>
            </div>

            {onViewChange && currentView === "dashboard" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewChange("appointments")}
              >
                <CalendarDays className="h-4 w-4 mr-2" />
                Appointments
              </Button>
            )}
            {onViewChange && currentView === "appointments" && hasData && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewChange("dashboard")}
              >
                Records
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={onImportClick}
              className="gap-2"
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              <span>Import</span>
            </Button>

            {hasData && onClearData && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (
                    window.confirm(
                      "Delete all imported health data? This cannot be undone."
                    )
                  ) {
                    onClearData();
                  }
                }}
                className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Clear Data</span>
              </Button>
            )}

            {onLock && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onLock}
                className="gap-2"
                title="Lock vault"
              >
                <Lock className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Lock</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
