"use client";

import { useState } from "react";
import { Download, Upload, FileJson, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { downloadExport, importFromExport } from "@/lib/db/export";

interface DataManagementProps {
  documentCount: number;
  onDataChange: () => void;
}

export function DataManagement({
  documentCount,
  onDataChange,
}: DataManagementProps) {
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await downloadExport();
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportStatus("Importing...");
    const result = await importFromExport(file);

    if (result.errors.length > 0) {
      setImportStatus(`Errors: ${result.errors.join(", ")}`);
    } else if (result.imported === 0 && result.duplicates > 0) {
      setImportStatus(`All ${result.duplicates} records already imported`);
    } else {
      setImportStatus(
        `Imported ${result.imported} records${
          result.duplicates > 0 ? `, ${result.duplicates} duplicates skipped` : ""
        }`
      );
      onDataChange();
    }

    // Reset file input
    e.target.value = "";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data Management</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-500">
          {documentCount} documents stored locally in your browser.
          Export to back up your data or transfer to another device.
        </p>

        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={isExporting || documentCount === 0}
            className="gap-2"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {isExporting ? "Exporting..." : "Export Backup"}
          </Button>

          <Button
            variant="outline"
            className="gap-2"
            onClick={() =>
              document.getElementById("import-export-file")?.click()
            }
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            Import Backup
          </Button>

          <input
            id="import-export-file"
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImportFile}
          />
        </div>

        {importStatus && (
          <div className="flex items-center gap-2 text-sm p-3 rounded-lg bg-gray-50">
            {importStatus.startsWith("Error") ? (
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0" aria-hidden="true" />
            ) : (
              <CheckCircle className="h-4 w-4 text-green-500 shrink-0" aria-hidden="true" />
            )}
            <span>{importStatus}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
