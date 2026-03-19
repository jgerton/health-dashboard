"use client";

import { useState, useCallback } from "react";
import { Upload, FileText, CheckCircle, AlertCircle, Copy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { parseCCD } from "@/lib/ccd/parser";
import type { ParsedCCD } from "@/lib/ccd/types";

interface ImportResult {
  file: string;
  success: boolean;
  duplicate?: boolean;
  error?: string;
  data?: ParsedCCD;
  icsFile?: boolean;
  appointmentCount?: number;
}

interface FileUploadProps {
  onImport: (results: ParsedCCD[], rawXmls: string[]) => void;
  onImportIcs?: (files: { content: string; name: string }[]) => Promise<{ imported: number; duplicates: number; errors: string[] }>;
}

export function FileUpload({ onImport, onImportIcs }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      setIsProcessing(true);
      const importResults: ImportResult[] = [];
      const successData: ParsedCCD[] = [];
      const successXmls: string[] = [];

      const icsFiles: { content: string; name: string }[] = [];

      for (const file of Array.from(files)) {
        if (file.name.endsWith(".xml")) {
          try {
            const text = await file.text();
            const parsed = parseCCD(text, file.name);
            importResults.push({
              file: file.name,
              success: true,
              data: parsed,
            });
            successData.push(parsed);
            successXmls.push(text);
          } catch (e) {
            importResults.push({
              file: file.name,
              success: false,
              error: e instanceof Error ? e.message : "Parse error",
            });
          }
        } else if (file.name.endsWith(".ics")) {
          try {
            const text = await file.text();
            icsFiles.push({ content: text, name: file.name });
            importResults.push({
              file: file.name,
              success: true,
              icsFile: true,
            });
          } catch (e) {
            importResults.push({
              file: file.name,
              success: false,
              error: e instanceof Error ? e.message : "Read error",
            });
          }
        } else {
          importResults.push({
            file: file.name,
            success: false,
            error: "Unsupported file type",
          });
        }
      }

      setResults(importResults);
      setIsProcessing(false);

      if (successData.length > 0) {
        onImport(successData, successXmls);
      }

      if (icsFiles.length > 0 && onImportIcs) {
        const icsResult = await onImportIcs(icsFiles);
        // Update results with appointment count
        const updatedResults = importResults.map((r) =>
          r.icsFile && r.success
            ? { ...r, appointmentCount: icsResult.imported }
            : r
        );
        setResults(updatedResults);
      }
    },
    [onImport, onImportIcs]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files);
      }
    },
    [processFiles]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        processFiles(e.target.files);
      }
    },
    [processFiles]
  );

  const successCount = results.filter((r) => r.success).length;
  const errorCount = results.filter((r) => !r.success).length;

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-xl">Import Health Records</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className={`
            border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
            transition-colors duration-200
            ${isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"}
          `}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById("file-input")?.click()}
          role="button"
          tabIndex={0}
          aria-label="Upload health records or calendar files"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              document.getElementById("file-input")?.click();
            }
          }}
        >
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" aria-hidden="true" />
          <p className="text-lg font-medium mb-1">
            {isProcessing ? "Processing..." : "Drop health records or calendar files here"}
          </p>
          <p className="text-sm text-gray-500">
            or click to browse. Supports CCD/XML health records and .ics calendar files.
          </p>
          <p className="text-xs text-gray-400 mt-2">
            All data stays in your browser. Nothing is uploaded to any server.
          </p>
          <input
            id="file-input"
            type="file"
            accept=".xml,.ics"
            multiple
            className="hidden"
            onChange={handleFileInput}
            aria-label="Select XML or ICS files to upload"
          />
        </div>

        {results.length > 0 && (
          <div className="mt-6 space-y-2">
            <div className="flex gap-4 text-sm mb-3">
              {successCount > 0 && (
                <span className="text-green-600 font-medium">
                  {successCount} imported successfully
                </span>
              )}
              {errorCount > 0 && (
                <span className="text-red-600 font-medium">
                  {errorCount} failed
                </span>
              )}
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1">
              {results.map((result, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-sm py-1.5 px-3 rounded bg-gray-50"
                >
                  {result.success ? (
                    result.duplicate ? (
                      <Copy className="h-4 w-4 text-gray-400 shrink-0" aria-hidden="true" />
                    ) : (
                      <CheckCircle className="h-4 w-4 text-green-500 shrink-0" aria-hidden="true" />
                    )
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-500 shrink-0" aria-hidden="true" />
                  )}
                  <FileText className="h-4 w-4 text-gray-400 shrink-0" aria-hidden="true" />
                  <span className="truncate">{result.file}</span>
                  {result.error && (
                    <span className="text-red-500 text-xs ml-auto">
                      {result.error}
                    </span>
                  )}
                  {result.duplicate && (
                    <span className="text-gray-400 text-xs ml-auto">
                      already imported
                    </span>
                  )}
                  {result.success && !result.duplicate && result.data && (
                    <span className="text-gray-400 text-xs ml-auto">
                      {result.data.medications.length} meds,{" "}
                      {result.data.results.length} labs,{" "}
                      {result.data.problems.length} problems
                    </span>
                  )}
                  {result.success && result.icsFile && (
                    <span className="text-gray-400 text-xs ml-auto">
                      {result.appointmentCount !== undefined
                        ? `${result.appointmentCount} appointments`
                        : "calendar file imported"}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
