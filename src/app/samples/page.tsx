"use client";

import Link from "next/link";
import { useState } from "react";

interface SampleItem {
  id: string;
  title: string;
  titleHi: string;
  category: string;
  emoji: string;
  description: string;
  fileUrl: string;
  type: "image" | "pdf";
  dataFields: Record<string, string>;
  testTargetUrl: string;
}

const MOCK_DOCS: SampleItem[] = [
  {
    id: "aadhaar-front",
    emoji: "🪪",
    title: "Sample Aadhaar Card (Front)",
    titleHi: "नमूना आधार कार्ड (सामने)",
    category: "Identity OCR",
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
    emoji: "📍",
    title: "Sample Aadhaar Card (Back)",
    titleHi: "नमूना आधार कार्ड (पीछे का पता)",
    category: "Address Proof",
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
    emoji: "🌾",
    title: "PM-Kisan Application Form (Mock)",
    titleHi: "पीएम किसान सम्मान निधि आवेदन पत्र",
    category: "Form Vision AI",
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

const GOVT_FORMS: SampleItem[] = [
  {
    id: "pmkisan-pdf",
    emoji: "🌾",
    title: "PM-Kisan Samman Nidhi",
    titleHi: "पीएम किसान सम्मान निधि",
    category: "Agriculture",
    description: "Pradhan Mantri Kisan Samman Nidhi Yojana application form for small & marginal farmers.",
    fileUrl: "/forms/01-PM-KISAN-Application.pdf",
    type: "pdf",
    testTargetUrl: "/form-fill",
    dataFields: {
      "Scheme": "PM-KISAN",
      "Benefit": "₹6,000/year",
      "Eligibility": "Small & Marginal Farmers",
      "Ministry": "Agriculture & Farmers Welfare",
    },
  },
  {
    id: "ration-card-pdf",
    emoji: "🍚",
    title: "Ration Card (NFSA)",
    titleHi: "राशन कार्ड (NFSA)",
    category: "Food Security",
    description: "National Food Security Act ration card application for subsidized food grains.",
    fileUrl: "/forms/02-Ration-Card-NFSA.pdf",
    type: "pdf",
    testTargetUrl: "/form-fill",
    dataFields: {
      "Scheme": "NFSA Ration Card",
      "Benefit": "Subsidized Foodgrains",
      "Eligibility": "BPL / AAY Families",
      "Ministry": "Consumer Affairs, Food & PDS",
    },
  },
  {
    id: "pmay-urban-pdf",
    emoji: "🏘️",
    title: "PM Awas Yojana (Urban)",
    titleHi: "प्रधानमंत्री आवास योजना (शहरी)",
    category: "Housing",
    description: "Housing for All urban scheme application — credit linked subsidy for home loans.",
    fileUrl: "/forms/03-PM-Awas-Yojana-Urban.pdf",
    type: "pdf",
    testTargetUrl: "/form-fill",
    dataFields: {
      "Scheme": "PMAY-Urban (CLSS)",
      "Benefit": "Up to ₹2.67 Lakh subsidy",
      "Eligibility": "EWS / LIG / MIG families",
      "Ministry": "Housing & Urban Affairs",
    },
  },
  {
    id: "pmay-rural-pdf",
    emoji: "🏡",
    title: "PM Awas Yojana (Rural)",
    titleHi: "प्रधानमंत्री आवास योजना (ग्रामीण)",
    category: "Housing",
    description: "Housing assistance for rural households living in kuchha or dilapidated houses.",
    fileUrl: "/forms/04-PM-Awas-Yojana-Rural.pdf",
    type: "pdf",
    testTargetUrl: "/form-fill",
    dataFields: {
      "Scheme": "PMAY-Gramin",
      "Benefit": "₹1.2L – ₹1.3L assistance",
      "Eligibility": "Houseless / SECC list",
      "Ministry": "Rural Development",
    },
  },
  {
    id: "sukanya-pdf",
    emoji: "👧",
    title: "Sukanya Samriddhi Yojana",
    titleHi: "सुकन्या समृद्धि योजना",
    category: "Savings & Girl Child",
    description: "Small savings scheme for girl child under Beti Bachao Beti Padhao campaign.",
    fileUrl: "/forms/05-Sukanya-Samriddhi.pdf",
    type: "pdf",
    testTargetUrl: "/form-fill",
    dataFields: {
      "Scheme": "SSY",
      "Interest Rate": "8.2% p.a.",
      "Eligibility": "Girl child below 10 years",
      "Ministry": "Finance / Post Office",
    },
  },
  {
    id: "fasal-bima-pdf",
    emoji: "🌧️",
    title: "PM Fasal Bima Yojana",
    titleHi: "प्रधानमंत्री फसल बीमा योजना",
    category: "Crop Insurance",
    description: "Crop insurance scheme protecting farmers against crop failure due to natural calamities.",
    fileUrl: "/forms/06-PM-Fasal-Bima.pdf",
    type: "pdf",
    testTargetUrl: "/form-fill",
    dataFields: {
      "Scheme": "PMFBY",
      "Premium": "2% Kharif / 1.5% Rabi",
      "Eligibility": "All farmers with crop loans",
      "Ministry": "Agriculture",
    },
  },
  {
    id: "ayushman-pdf",
    emoji: "🏥",
    title: "Ayushman Bharat (PMJAY)",
    titleHi: "आयुष्मान भारत - जन आरोग्य योजना",
    category: "Health Insurance",
    description: "₹5 lakh per family per year health insurance for secondary and tertiary hospitalization.",
    fileUrl: "/forms/07-Ayushman-Bharat.pdf",
    type: "pdf",
    testTargetUrl: "/form-fill",
    dataFields: {
      "Scheme": "PM-JAY / PMJAY",
      "Benefit": "₹5 Lakh/family/year",
      "Eligibility": "SECC / poor & vulnerable",
      "Ministry": "Health & Family Welfare",
    },
  },
  {
    id: "ujjwala-pdf",
    emoji: "🔥",
    title: "PM Ujjwala Yojana",
    titleHi: "प्रधानमंत्री उज्ज्वला योजना",
    category: "LPG / Fuel",
    description: "Free LPG connection to women from BPL / SC / ST households for clean cooking fuel.",
    fileUrl: "/forms/08-PM-Ujjwala.pdf",
    type: "pdf",
    testTargetUrl: "/form-fill",
    dataFields: {
      "Scheme": "PMUY",
      "Benefit": "Free LPG Connection",
      "Eligibility": "BPL / SC / ST women",
      "Ministry": "Petroleum & Natural Gas",
    },
  },
  {
    id: "nps-pdf",
    emoji: "🏦",
    title: "National Pension Scheme",
    titleHi: "राष्ट्रीय पेंशन प्रणाली",
    category: "Pension / Retirement",
    description: "Voluntary defined contribution pension scheme for retirement financial security.",
    fileUrl: "/forms/09-National-Pension.pdf",
    type: "pdf",
    testTargetUrl: "/form-fill",
    dataFields: {
      "Scheme": "NPS",
      "Benefit": "Market-linked pension",
      "Eligibility": "18–70 years (Indian citizen)",
      "Regulator": "PFRDA",
    },
  },
  {
    id: "mudra-pdf",
    emoji: "💼",
    title: "PM Mudra Yojana",
    titleHi: "प्रधानमंत्री मुद्रा योजना",
    category: "Business / MSME",
    description: "Micro-enterprise loans up to ₹10 lakh under Shishu, Kishore, and Tarun categories.",
    fileUrl: "/forms/10-PM-Mudra-Yojana.pdf",
    type: "pdf",
    testTargetUrl: "/form-fill",
    dataFields: {
      "Scheme": "PMMY",
      "Benefit": "Loan up to ₹10 Lakh",
      "Eligibility": "Non-corporate micro enterprises",
      "Ministry": "Finance / SIDBI",
    },
  },
];

export default function SamplesPage() {
  const [activeTab, setActiveTab] = useState<"mock" | "pdf">("mock");
  const [selectedMock, setSelectedMock] = useState<SampleItem>(MOCK_DOCS[0]);
  const [selectedPDF, setSelectedPDF] = useState<SampleItem>(GOVT_FORMS[0]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const currentItem = activeTab === "mock" ? selectedMock : selectedPDF;
  const currentList = activeTab === "mock" ? MOCK_DOCS : GOVT_FORMS;
  const setSelected = activeTab === "mock"
    ? (s: SampleItem) => setSelectedMock(s)
    : (s: SampleItem) => setSelectedPDF(s);

  const copyLink = (url: string, id: string) => {
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
              Testing &amp; Evaluation Kit
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Sample Documents &amp; Forms
            </h1>
            <p className="text-slate-400 text-sm md:text-base mt-1">
              Mock identity cards for OCR testing &middot; 10 real government PDF forms for AI autofill
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

        {/* Tab Bar */}
        <div className="flex gap-2 p-1 rounded-xl bg-slate-900/60 border border-slate-800 w-fit">
          <button
            onClick={() => setActiveTab("mock")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
              activeTab === "mock"
                ? "bg-teal-600 text-white shadow"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            Mock ID Documents (OCR Test)
          </button>
          <button
            onClick={() => setActiveTab("pdf")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
              activeTab === "pdf"
                ? "bg-indigo-600 text-white shadow"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            Government Forms (10 PDFs)
          </button>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Left Column */}
          <div className="lg:col-span-5 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 px-1">
              {activeTab === "mock" ? "Select Sample Document" : "Select Government Scheme"}
            </h2>
            <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
              {currentList.map((item) => {
                const isSelected = currentItem.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelected(item)}
                    className={`cursor-pointer rounded-2xl p-4 transition border ${
                      isSelected
                        ? activeTab === "mock"
                          ? "bg-slate-900/90 border-teal-500 shadow-xl shadow-teal-500/10 ring-1 ring-teal-500"
                          : "bg-slate-900/90 border-indigo-500 shadow-xl shadow-indigo-500/10 ring-1 ring-indigo-500"
                        : "bg-slate-900/40 border-slate-800 hover:bg-slate-900/70 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl mt-0.5">{item.emoji}</span>
                        <div>
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-teal-300 mb-1.5">
                            {item.category}
                          </span>
                          <h3 className="font-bold text-white text-sm leading-snug">{item.title}</h3>
                          <p className="text-[11px] text-slate-400 mt-0.5">{item.titleHi}</p>
                        </div>
                      </div>
                      <span className={`h-2.5 w-2.5 rounded-full mt-1 shrink-0 ${isSelected
                        ? activeTab === "mock" ? "bg-teal-400 animate-pulse" : "bg-indigo-400 animate-pulse"
                        : "bg-slate-700"}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* How to Test */}
            <div className="rounded-2xl bg-teal-950/30 border border-teal-800/40 p-4 text-xs text-teal-200/90 space-y-2">
              <div className="font-semibold flex items-center gap-1.5 text-teal-300">
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
                <span>How to test</span>
              </div>
              {activeTab === "mock" ? (
                <>
                  <p><strong>Webcam:</strong> Point camera at this screen using <strong>Scan</strong> in the Assistant.</p>
                  <p><strong>Upload:</strong> Download SVG and upload via the Assistant file picker.</p>
                </>
              ) : (
                <>
                  <p><strong>View &amp; Download:</strong> Open the PDF to view the official form.</p>
                  <p><strong>AI Autofill:</strong> Click <strong>Try AI Autofill</strong> to let the assistant fill it by voice.</p>
                </>
              )}
            </div>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-7 space-y-6">
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4">

              {/* Card Title */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{currentItem.emoji}</span>
                  <div>
                    <h3 className="font-bold text-lg text-white leading-tight">{currentItem.title}</h3>
                    <p className="text-xs text-slate-400">{currentItem.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => copyLink(currentItem.fileUrl, currentItem.id)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition"
                  >
                    {copiedId === currentItem.id ? "Copied!" : "Copy URL"}
                  </button>
                  <a
                    href={currentItem.fileUrl}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs font-semibold text-white transition flex items-center gap-1"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    <span>Download</span>
                  </a>
                </div>
              </div>

              {/* Preview */}
              <div className="relative rounded-xl overflow-hidden bg-slate-950/80 border border-slate-800 flex items-center justify-center min-h-[360px]">
                {currentItem.type === "pdf" ? (
                  <iframe
                    src={`${currentItem.fileUrl}#toolbar=0&view=FitH`}
                    title={currentItem.title}
                    className="w-full h-[480px] rounded-lg"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={currentItem.fileUrl}
                    alt={currentItem.title}
                    className="w-full max-h-[480px] object-contain rounded-lg shadow-2xl transition hover:scale-[1.01]"
                  />
                )}
              </div>

              {/* Info Cards */}
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-teal-400">
                  {activeTab === "mock" ? "Expected Extracted Data" : "Scheme Information"}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {Object.entries(currentItem.dataFields).map(([label, val]) => (
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
                  {activeTab === "mock" ? "Ready for OCR & Vision agents" : "Real government form · AI autofill ready"}
                </span>
                <Link
                  href={currentItem.testTargetUrl}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-white transition shadow-md ${
                    activeTab === "mock"
                      ? "bg-teal-600 hover:bg-teal-500"
                      : "bg-indigo-600 hover:bg-indigo-500"
                  }`}
                >
                  <span>{activeTab === "mock" ? "Launch in Scanner" : "Try AI Autofill"}</span>
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

