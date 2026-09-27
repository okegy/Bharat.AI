"use client";

import Link from "next/link";
import { useState } from "react";

interface SampleItem {
  id: string;
  title: string;
  titleHi: string;
  category: string;
  description: string;
  fileUrl: string;
  type: "image" | "pdf";
  dataFields: Record<string, string>;
  testTargetUrl: string;
}

const SAMPLES: SampleItem[] = [
  {
    id: "aadhaar-front",
    title: "Sample Aadhaar Card (Front)",
    titleHi: "नमूना आधार कार्ड (सामने)",
    category: "Identity Verification & OCR",
    description: "Mock Indian Aadhaar card with photo, name, father's name, DOB, gender, and 12-digit UID for testing OCR extraction.",
    fileUrl: "/samples/sample-aadhaar.svg",
    type: "image",
    testTargetUrl: "/assistant",
    dataFields: {
      "Full Name": "Ramesh Kumar Sharma",
      "Father's Name": "Hari Om Sharma",
      "DOB": "15/08/1984",
      "Gender": "Male",
      "Aadhaar Number": "4767 1659 1624",
    },
  },
  {
    id: "aadhaar-back",
    title: "Sample Aadhaar Card (Back)",
    titleHi: "नमूना आधार कार्ड (पीछे का पता)",
    category: "Address & Resident Proof",
    description: "Mock Aadhaar card back with English and Hindi address, district, state, pincode, and barcode for address validation.",
    fileUrl: "/samples/sample-aadhaar-back.svg",
    type: "image",
    testTargetUrl: "/assistant",
    dataFields: {
      "House / Village": "House No 42, Village Rampur",
      "Post / Tehsil": "Post Shivpur, Tehsil Sadar",
      "District": "Varanasi",
      "State": "Uttar Pradesh",
      "Pincode": "221001",
    },
  },
  {
    id: "pmkisan-form",
    title: "PM-Kisan Scheme Application Form",
    titleHi: "पीएम किसान सम्मान निधि आवेदन पत्र",
    category: "Form Vision & Field Extraction",
    description: "Complete government registration form with applicant, banking, and landholding coordinates for testing AI form scanning & autofill.",
    fileUrl: "/samples/sample-pmkisan-form.svg",
    type: "image",
    testTargetUrl: "/form-fill",
    dataFields: {
      "Scheme Name": "PM Kisan Samman Nidhi",
      "Applicant Name": "RAMESH KUMAR SHARMA",
      "Bank Account": "30981245678 (SBIN0001234)",
      "Land Area": "1.8 Hectares (Small/Marginal)",
      "Survey / Khasra": "KH-492 / PLOT 12",
    },
  },
];

export default function SamplesPage() {
  const [selectedSample, setSelectedSample] = useState<SampleItem>(SAMPLES[0]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyImageLink = (url: string, id: string) => {
    const fullUrl = `${window.location.origin}${url}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20 text-xs font-semibold uppercase tracking-wider mb-2">
              🧪 Testing & Evaluation Kit
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Sample Documents & Test Assets
            </h1>
            <p className="text-slate-400 text-sm md:text-base mt-1">
              High-resolution mock Indian identity cards and welfare application forms to test OCR, camera scanning, and AI agent reasoning.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/assistant"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal-500/20 transition hover:from-teal-500 hover:to-emerald-500"
            >
              <span>Go to AI Assistant</span>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Main Grid: Selector + Previewer */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Sample Cards List */}
          <div className="lg:col-span-5 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 px-1">
              Select Sample Document
            </h2>
            <div className="space-y-3">
              {SAMPLES.map((sample) => {
                const isSelected = selectedSample.id === sample.id;
                return (
                  <div
                    key={sample.id}
                    onClick={() => setSelectedSample(sample)}
                    className={`cursor-pointer rounded-2xl p-4 transition border ${
                      isSelected
                        ? "bg-slate-900/90 border-teal-500 shadow-xl shadow-teal-500/10 ring-1 ring-teal-500"
                        : "bg-slate-900/40 border-slate-800 hover:bg-slate-900/70 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-teal-300 mb-1.5">
                          {sample.category}
                        </span>
                        <h3 className="font-bold text-white text-base leading-snug">
                          {sample.title}
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">
                          {sample.titleHi}
                        </p>
                      </div>
                      <span className={`h-2.5 w-2.5 rounded-full mt-1 shrink-0 ${isSelected ? "bg-teal-400 animate-pulse" : "bg-slate-700"}`} />
                    </div>

                    {/* Quick Fields summary */}
                    <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap gap-1.5">
                      {Object.keys(sample.dataFields).slice(0, 3).map((k) => (
                        <span key={k} className="text-[11px] bg-slate-800/60 text-slate-300 px-2 py-0.5 rounded">
                          {k}
                        </span>
                      ))}
                      {Object.keys(sample.dataFields).length > 3 && (
                        <span className="text-[11px] text-slate-500 py-0.5">
                          +{Object.keys(sample.dataFields).length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Instruction Card */}
            <div className="rounded-2xl bg-teal-950/30 border border-teal-800/40 p-4 text-xs text-teal-200/90 space-y-2">
              <div className="font-semibold flex items-center gap-1.5 text-teal-300">
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
                <span>How to test with your camera or screen</span>
              </div>
              <p>
                <strong>Method 1 (Phone Camera / Webcam):</strong> Open this page on a second screen or phone, and point your camera using the <strong>Scan</strong> button in the Assistant.
              </p>
              <p>
                <strong>Method 2 (Direct Upload):</strong> Click <strong>Download SVG</strong> below and upload it directly into the Assistant via the <strong>Upload</strong> or <strong>Scan</strong> file picker.
              </p>
            </div>
          </div>

          {/* Right Column: Live Document Previewer & Actions */}
          <div className="lg:col-span-7 space-y-6">
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4">
              
              {/* Card Title & Top Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <h3 className="font-bold text-lg text-white">
                    {selectedSample.title}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {selectedSample.description}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => copyImageLink(selectedSample.fileUrl, selectedSample.id)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition"
                  >
                    {copiedId === selectedSample.id ? "✓ Link Copied!" : "Copy URL"}
                  </button>
                  <a
                    href={selectedSample.fileUrl}
                    download={`${selectedSample.id}.svg`}
                    className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-xs font-semibold text-white transition flex items-center gap-1"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    <span>Download SVG</span>
                  </a>
                </div>
              </div>

              {/* Visual Preview Box */}
              <div className="relative rounded-xl overflow-hidden bg-slate-950/80 border border-slate-800 flex items-center justify-center p-4 min-h-[340px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedSample.fileUrl}
                  alt={selectedSample.title}
                  className="w-full max-h-[480px] object-contain rounded-lg shadow-2xl transition hover:scale-[1.01]"
                />
              </div>

              {/* Extracted Mock Data Table */}
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-teal-400">
                  Expected Extracted Data Values
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {Object.entries(selectedSample.dataFields).map(([label, val]) => (
                    <div key={label} className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                      <span className="text-slate-400 block text-[11px] font-medium">{label}</span>
                      <span className="text-slate-100 font-semibold mt-0.5 block">{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Bar */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Ready to test with OCR & Vision agents
                </span>
                <Link
                  href={selectedSample.testTargetUrl}
                  className="inline-flex items-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-500 px-4 py-2 text-xs font-bold text-white transition shadow-md"
                >
                  <span>Launch in Assistant Scanner</span>
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
              </div>

            </div>
          </div>
        </div>

      </div>
    </main>
  );
}
