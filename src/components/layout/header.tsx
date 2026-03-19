"use client";

import { Heart, Upload, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  onImportClick: () => void;
  patientName?: string;
}

export function Header({ onImportClick, patientName }: HeaderProps) {
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

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={onImportClick}
              className="gap-2"
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              <span>Import Records</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
