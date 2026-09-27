/**
 * Indian government scheme database with eligibility rules.
 * Each scheme has metadata and a set of criteria checked against the user profile.
 */

import type { ProfileData } from "@/lib/profile-vault";

export interface Scheme {
  id: string;
  name: string;
  nameHi: string;
  department: string;
  category: "food" | "agriculture" | "education" | "pension" | "health" | "housing" | "employment" | "women" | "disability" | "insurance" | "finance" | "skill";
  benefitType: "cash" | "subsidy" | "service" | "insurance" | "ration" | "loan" | "skill";
  estimatedBenefitINR: number;
  description: string;
  portalUrl: string;
  requiredDocuments: string[];
  eligibility: EligibilityRule[];
  formFields: FormFieldDef[];
}

export interface EligibilityRule {
  field: keyof ProfileData;
  op: "eq" | "neq" | "in" | "lt" | "lte" | "gt" | "gte" | "exists";
  value?: string | string[] | number;
  label: string;
}

export interface FormFieldDef {
  id: string;
  label: string;
  profileKey?: keyof ProfileData;
  type: "text" | "date" | "select" | "number" | "textarea" | "file";
  required: boolean;
  options?: string[];
}

export const SCHEMES: Scheme[] = [
  {
    id: "ration-card-nfsa",
    name: "Ration Card (NFSA)",
    nameHi: "राशन कार्ड (NFSA)",
    department: "Department of Food & Public Distribution",
    category: "food",
    benefitType: "ration",
    estimatedBenefitINR: 12000,
    description: "Subsidised food grains under the National Food Security Act. Wheat at ₹2/kg, rice at ₹3/kg for priority households.",
    portalUrl: "https://nfsa.gov.in/",
    requiredDocuments: ["Aadhaar Card", "Address Proof", "Income Certificate"],
    eligibility: [
      { field: "annualIncome", op: "lte", value: 300000, label: "Annual income ≤ ₹3,00,000" },
      { field: "state", op: "exists", label: "State is known" },
    ],
    formFields: [
      { id: "full_name", label: "Full Name", profileKey: "fullName", type: "text", required: true },
      { id: "father_name", label: "Father's Name", profileKey: "fatherName", type: "text", required: true },
      { id: "dob", label: "Date of Birth", profileKey: "dob", type: "date", required: true },
      { id: "address", label: "Address", profileKey: "address", type: "textarea", required: true },
      { id: "aadhaar", label: "Aadhaar Number", profileKey: "aadhaarNumber", type: "text", required: true },
      { id: "income", label: "Annual Income", profileKey: "annualIncome", type: "number", required: true },
      { id: "ration_type", label: "Ration Card Type", profileKey: "rationCardType", type: "select", required: true, options: ["APL", "BPL", "AAY"] },
    ],
  },
  {
    id: "pm-kisan",
    name: "PM-KISAN",
    nameHi: "पीएम-किसान",
    department: "Ministry of Agriculture",
    category: "agriculture",
    benefitType: "cash",
    estimatedBenefitINR: 6000,
    description: "₹6,000 per year in three instalments to small and marginal farmer families for crop inputs.",
    portalUrl: "https://pmkisan.gov.in/",
    requiredDocuments: ["Aadhaar Card", "Land Records", "Bank Passbook"],
    eligibility: [
      { field: "occupation", op: "in", value: ["farmer", "agriculture", "kisan"], label: "Occupation is farming" },
      { field: "landOwnership", op: "in", value: ["owned", "leased", "small", "marginal"], label: "Owns or leases farm land" },
    ],
    formFields: [
      { id: "full_name", label: "Full Name", profileKey: "fullName", type: "text", required: true },
      { id: "aadhaar", label: "Aadhaar Number", profileKey: "aadhaarNumber", type: "text", required: true },
      { id: "bank", label: "Bank Account", profileKey: "bankAccount", type: "text", required: true },
      { id: "state", label: "State", profileKey: "state", type: "text", required: true },
      { id: "district", label: "District", profileKey: "district", type: "text", required: true },
      { id: "land", label: "Land Ownership Type", profileKey: "landOwnership", type: "select", required: true, options: ["owned", "leased"] },
    ],
  },
  {
    id: "pmfby",
    name: "PM Fasal Bima Yojana",
    nameHi: "पीएम फसल बीमा योजना",
    department: "Ministry of Agriculture",
    category: "insurance",
    benefitType: "insurance",
    estimatedBenefitINR: 25000,
    description: "Crop insurance covering natural calamities, pests, and diseases. Farmer pays only 2% premium for Kharif and 1.5% for Rabi.",
    portalUrl: "https://pmfby.gov.in/",
    requiredDocuments: ["Aadhaar Card", "Land Records", "Bank Passbook", "Sowing Certificate"],
    eligibility: [
      { field: "occupation", op: "in", value: ["farmer", "agriculture", "kisan"], label: "Occupation is farming" },
    ],
    formFields: [
      { id: "full_name", label: "Full Name", profileKey: "fullName", type: "text", required: true },
      { id: "aadhaar", label: "Aadhaar Number", profileKey: "aadhaarNumber", type: "text", required: true },
      { id: "bank", label: "Bank Account", profileKey: "bankAccount", type: "text", required: true },
      { id: "land", label: "Land Type", profileKey: "landOwnership", type: "select", required: true, options: ["owned", "leased"] },
    ],
  },
  {
    id: "pmay-urban",
    name: "PM Awas Yojana (Urban)",
    nameHi: "पीएम आवास योजना (शहरी)",
    department: "Ministry of Housing & Urban Affairs",
    category: "housing",
    benefitType: "subsidy",
    estimatedBenefitINR: 250000,
    description: "Interest subsidy of up to ₹2.67 lakh on home loans for EWS/LIG families in urban areas.",
    portalUrl: "https://pmaymis.gov.in/",
    requiredDocuments: ["Aadhaar Card", "Income Certificate", "Bank Passbook"],
    eligibility: [
      { field: "annualIncome", op: "lte", value: 600000, label: "Annual income ≤ ₹6,00,000" },
    ],
    formFields: [
      { id: "full_name", label: "Full Name", profileKey: "fullName", type: "text", required: true },
      { id: "aadhaar", label: "Aadhaar Number", profileKey: "aadhaarNumber", type: "text", required: true },
      { id: "income", label: "Annual Income", profileKey: "annualIncome", type: "number", required: true },
      { id: "address", label: "Current Address", profileKey: "address", type: "textarea", required: true },
      { id: "bank", label: "Bank Account", profileKey: "bankAccount", type: "text", required: true },
    ],
  },
  {
    id: "pmay-gramin",
    name: "PM Awas Yojana (Gramin)",
    nameHi: "पीएम आवास योजना (ग्रामीण)",
    department: "Ministry of Rural Development",
    category: "housing",
    benefitType: "cash",
    estimatedBenefitINR: 130000,
    description: "₹1.20-1.30 lakh grant for construction of pucca house for rural BPL families.",
    portalUrl: "https://pmayg.nic.in/",
    requiredDocuments: ["Aadhaar Card", "BPL Certificate", "Land Document"],
    eligibility: [
      { field: "annualIncome", op: "lte", value: 200000, label: "Annual income ≤ ₹2,00,000" },
      { field: "category", op: "in", value: ["SC", "ST", "OBC", "General-EWS", "BPL"], label: "Belongs to eligible category" },
    ],
    formFields: [
      { id: "full_name", label: "Full Name", profileKey: "fullName", type: "text", required: true },
      { id: "aadhaar", label: "Aadhaar Number", profileKey: "aadhaarNumber", type: "text", required: true },
      { id: "category", label: "Category", profileKey: "category", type: "select", required: true, options: ["SC", "ST", "OBC", "General-EWS"] },
    ],
  },
  {
    id: "old-age-pension",
    name: "National Old Age Pension (IGNOAPS)",
    nameHi: "वृद्धावस्था पेंशन (IGNOAPS)",
    department: "Ministry of Rural Development",
    category: "pension",
    benefitType: "cash",
    estimatedBenefitINR: 3600,
    description: "Monthly pension of ₹200-500 for BPL citizens aged 60+ (₹500 after age 80).",
    portalUrl: "https://nsap.nic.in/",
    requiredDocuments: ["Aadhaar Card", "Age Proof", "BPL Certificate"],
    eligibility: [
      { field: "annualIncome", op: "lte", value: 200000, label: "BPL household" },
    ],
    formFields: [
      { id: "full_name", label: "Full Name", profileKey: "fullName", type: "text", required: true },
      { id: "dob", label: "Date of Birth", profileKey: "dob", type: "date", required: true },
      { id: "aadhaar", label: "Aadhaar Number", profileKey: "aadhaarNumber", type: "text", required: true },
      { id: "bank", label: "Bank Account", profileKey: "bankAccount", type: "text", required: true },
    ],
  },
  {
    id: "widow-pension",
    name: "Widow Pension (IGNWPS)",
    nameHi: "विधवा पेंशन (IGNWPS)",
    department: "Ministry of Rural Development",
    category: "pension",
    benefitType: "cash",
    estimatedBenefitINR: 3600,
    description: "Monthly pension for widows aged 40-79 from BPL households.",
    portalUrl: "https://nsap.nic.in/",
    requiredDocuments: ["Aadhaar Card", "Death Certificate of Spouse", "BPL Certificate"],
    eligibility: [
      { field: "gender", op: "eq", value: "female", label: "Gender is female" },
      { field: "maritalStatus", op: "eq", value: "widowed", label: "Widowed" },
      { field: "annualIncome", op: "lte", value: 200000, label: "BPL household" },
    ],
    formFields: [
      { id: "full_name", label: "Full Name", profileKey: "fullName", type: "text", required: true },
      { id: "dob", label: "Date of Birth", profileKey: "dob", type: "date", required: true },
      { id: "aadhaar", label: "Aadhaar Number", profileKey: "aadhaarNumber", type: "text", required: true },
      { id: "bank", label: "Bank Account", profileKey: "bankAccount", type: "text", required: true },
    ],
  },
  {
    id: "disability-pension",
    name: "Disability Pension (IGNDPS)",
    nameHi: "विकलांग पेंशन (IGNDPS)",
    department: "Ministry of Rural Development",
    category: "disability",
    benefitType: "cash",
    estimatedBenefitINR: 3600,
    description: "Monthly pension for persons with 80%+ disability from BPL households.",
    portalUrl: "https://nsap.nic.in/",
    requiredDocuments: ["Aadhaar Card", "Disability Certificate", "BPL Certificate"],
    eligibility: [
      { field: "disabilityStatus", op: "in", value: ["yes", "80+", "severe"], label: "Has severe disability (80%+)" },
      { field: "annualIncome", op: "lte", value: 200000, label: "BPL household" },
    ],
    formFields: [
      { id: "full_name", label: "Full Name", profileKey: "fullName", type: "text", required: true },
      { id: "dob", label: "Date of Birth", profileKey: "dob", type: "date", required: true },
      { id: "aadhaar", label: "Aadhaar Number", profileKey: "aadhaarNumber", type: "text", required: true },
      { id: "bank", label: "Bank Account", profileKey: "bankAccount", type: "text", required: true },
    ],
  },
  {
    id: "ayushman-bharat",
    name: "Ayushman Bharat (PM-JAY)",
    nameHi: "आयुष्मान भारत (PM-JAY)",
    department: "Ministry of Health",
    category: "health",
    benefitType: "insurance",
    estimatedBenefitINR: 500000,
    description: "Health insurance cover of ₹5 lakh per family per year for secondary and tertiary hospitalisation.",
    portalUrl: "https://pmjay.gov.in/",
    requiredDocuments: ["Aadhaar Card", "Ration Card"],
    eligibility: [
      { field: "annualIncome", op: "lte", value: 300000, label: "Economically weaker section" },
    ],
    formFields: [
      { id: "full_name", label: "Full Name", profileKey: "fullName", type: "text", required: true },
      { id: "aadhaar", label: "Aadhaar Number", profileKey: "aadhaarNumber", type: "text", required: true },
      { id: "ration", label: "Ration Card Type", profileKey: "rationCardType", type: "select", required: true, options: ["APL", "BPL", "AAY"] },
      { id: "phone", label: "Mobile Number", profileKey: "phone", type: "text", required: true },
    ],
  },
  {
    id: "pm-jan-dhan",
    name: "PM Jan Dhan Yojana",
    nameHi: "पीएम जन धन योजना",
    department: "Ministry of Finance",
    category: "finance",
    benefitType: "service",
    estimatedBenefitINR: 10000,
    description: "Zero-balance bank account with RuPay debit card, ₹1 lakh accident insurance, and ₹30,000 life cover.",
    portalUrl: "https://pmjdy.gov.in/",
    requiredDocuments: ["Aadhaar Card", "Passport Photo"],
    eligibility: [
      { field: "fullName", op: "exists", label: "Name is known" },
    ],
    formFields: [
      { id: "full_name", label: "Full Name", profileKey: "fullName", type: "text", required: true },
      { id: "aadhaar", label: "Aadhaar Number", profileKey: "aadhaarNumber", type: "text", required: true },
      { id: "address", label: "Address", profileKey: "address", type: "textarea", required: true },
      { id: "phone", label: "Mobile Number", profileKey: "phone", type: "text", required: true },
    ],
  },
  {
    id: "ujjwala",
    name: "PM Ujjwala Yojana",
    nameHi: "पीएम उज्ज्वला योजना",
    department: "Ministry of Petroleum",
    category: "food",
    benefitType: "subsidy",
    estimatedBenefitINR: 1600,
    description: "Free LPG connection with first refill and stove for BPL women. Subsequent refills at subsidised rates.",
    portalUrl: "https://www.pmujjwalayojana.com/",
    requiredDocuments: ["Aadhaar Card", "BPL Certificate", "Address Proof"],
    eligibility: [
      { field: "gender", op: "eq", value: "female", label: "Applicant is female" },
      { field: "annualIncome", op: "lte", value: 200000, label: "BPL household" },
    ],
    formFields: [
      { id: "full_name", label: "Full Name", profileKey: "fullName", type: "text", required: true },
      { id: "aadhaar", label: "Aadhaar Number", profileKey: "aadhaarNumber", type: "text", required: true },
      { id: "address", label: "Address", profileKey: "address", type: "textarea", required: true },
      { id: "bank", label: "Bank Account", profileKey: "bankAccount", type: "text", required: true },
    ],
  },
  {
    id: "sukanya-samriddhi",
    name: "Sukanya Samriddhi Yojana",
    nameHi: "सुकन्या समृद्धि योजना",
    department: "Ministry of Finance",
    category: "women",
    benefitType: "service",
    estimatedBenefitINR: 50000,
    description: "High-interest savings account for girl children (up to age 10). Current interest rate ~8%. Tax-free maturity at age 21.",
    portalUrl: "https://www.nsiindia.gov.in/",
    requiredDocuments: ["Aadhaar Card (Parent)", "Birth Certificate (Girl)", "Address Proof"],
    eligibility: [
      { field: "gender", op: "eq", value: "female", label: "For girl child" },
    ],
    formFields: [
      { id: "full_name", label: "Girl's Name", profileKey: "fullName", type: "text", required: true },
      { id: "dob", label: "Date of Birth", profileKey: "dob", type: "date", required: true },
      { id: "father_name", label: "Father's Name", profileKey: "fatherName", type: "text", required: true },
      { id: "address", label: "Address", profileKey: "address", type: "textarea", required: true },
    ],
  },
  {
    id: "mudra-loan",
    name: "PM Mudra Yojana",
    nameHi: "पीएम मुद्रा योजना",
    department: "Ministry of Finance",
    category: "finance",
    benefitType: "loan",
    estimatedBenefitINR: 1000000,
    description: "Collateral-free loans up to ₹10 lakh for micro and small enterprises: Shishu (≤₹50K), Kishor (≤₹5L), Tarun (≤₹10L).",
    portalUrl: "https://www.mudra.org.in/",
    requiredDocuments: ["Aadhaar Card", "Business Plan", "Bank Statements"],
    eligibility: [
      { field: "occupation", op: "in", value: ["self-employed", "business", "entrepreneur", "shopkeeper", "vendor"], label: "Self-employed or business owner" },
    ],
    formFields: [
      { id: "full_name", label: "Full Name", profileKey: "fullName", type: "text", required: true },
      { id: "aadhaar", label: "Aadhaar Number", profileKey: "aadhaarNumber", type: "text", required: true },
      { id: "phone", label: "Mobile Number", profileKey: "phone", type: "text", required: true },
      { id: "bank", label: "Bank Account", profileKey: "bankAccount", type: "text", required: true },
      { id: "occupation", label: "Business Type", profileKey: "occupation", type: "text", required: true },
    ],
  },
  {
    id: "pm-vishwakarma",
    name: "PM Vishwakarma Yojana",
    nameHi: "पीएम विश्वकर्मा योजना",
    department: "Ministry of MSME",
    category: "skill",
    benefitType: "subsidy",
    estimatedBenefitINR: 300000,
    description: "Training, toolkit, and loan up to ₹3 lakh at 5% for traditional artisans and craftspeople in 18 trades.",
    portalUrl: "https://pmvishwakarma.gov.in/",
    requiredDocuments: ["Aadhaar Card", "Bank Passbook", "Trade Proof"],
    eligibility: [
      { field: "occupation", op: "in", value: ["artisan", "carpenter", "blacksmith", "goldsmith", "potter", "weaver", "sculptor", "cobbler", "tailor", "mason", "basket-maker", "toymaker", "barber", "garland-maker", "washerman", "fishnet-maker", "locksmith", "armourer"], label: "Traditional artisan/craftsperson" },
    ],
    formFields: [
      { id: "full_name", label: "Full Name", profileKey: "fullName", type: "text", required: true },
      { id: "aadhaar", label: "Aadhaar Number", profileKey: "aadhaarNumber", type: "text", required: true },
      { id: "occupation", label: "Trade/Craft", profileKey: "occupation", type: "text", required: true },
      { id: "bank", label: "Bank Account", profileKey: "bankAccount", type: "text", required: true },
    ],
  },
  {
    id: "national-scholarship",
    name: "National Scholarship Portal (Post-Matric)",
    nameHi: "राष्ट्रीय छात्रवृत्ति (पोस्ट-मैट्रिक)",
    department: "Ministry of Education",
    category: "education",
    benefitType: "cash",
    estimatedBenefitINR: 36000,
    description: "Scholarships for SC/ST/OBC/minority students pursuing post-matric education. Covers tuition and living expenses.",
    portalUrl: "https://scholarships.gov.in/",
    requiredDocuments: ["Aadhaar Card", "Marksheet", "Caste Certificate", "Income Certificate"],
    eligibility: [
      { field: "category", op: "in", value: ["SC", "ST", "OBC", "Minority"], label: "SC/ST/OBC/Minority" },
      { field: "annualIncome", op: "lte", value: 250000, label: "Family income ≤ ₹2,50,000" },
    ],
    formFields: [
      { id: "full_name", label: "Full Name", profileKey: "fullName", type: "text", required: true },
      { id: "dob", label: "Date of Birth", profileKey: "dob", type: "date", required: true },
      { id: "aadhaar", label: "Aadhaar Number", profileKey: "aadhaarNumber", type: "text", required: true },
      { id: "category", label: "Category", profileKey: "category", type: "select", required: true, options: ["SC", "ST", "OBC", "Minority"] },
      { id: "income", label: "Family Income", profileKey: "annualIncome", type: "number", required: true },
      { id: "education", label: "Education Level", profileKey: "education", type: "text", required: true },
      { id: "bank", label: "Bank Account", profileKey: "bankAccount", type: "text", required: true },
    ],
  },
  {
    id: "stand-up-india",
    name: "Stand Up India",
    nameHi: "स्टैंड अप इंडिया",
    department: "Ministry of Finance",
    category: "finance",
    benefitType: "loan",
    estimatedBenefitINR: 10000000,
    description: "Loans between ₹10 lakh and ₹1 crore for SC/ST/women entrepreneurs for greenfield enterprises.",
    portalUrl: "https://www.standupmitra.in/",
    requiredDocuments: ["Aadhaar Card", "Business Plan", "Caste Certificate (if SC/ST)"],
    eligibility: [
      { field: "occupation", op: "in", value: ["self-employed", "business", "entrepreneur"], label: "Entrepreneur" },
    ],
    formFields: [
      { id: "full_name", label: "Full Name", profileKey: "fullName", type: "text", required: true },
      { id: "aadhaar", label: "Aadhaar Number", profileKey: "aadhaarNumber", type: "text", required: true },
      { id: "category", label: "Category", profileKey: "category", type: "select", required: true, options: ["SC", "ST", "OBC", "General"] },
      { id: "gender", label: "Gender", profileKey: "gender", type: "select", required: true, options: ["male", "female", "other"] },
      { id: "bank", label: "Bank Account", profileKey: "bankAccount", type: "text", required: true },
    ],
  },
  {
    id: "pmsby",
    name: "PM Suraksha Bima Yojana",
    nameHi: "पीएम सुरक्षा बीमा योजना",
    department: "Ministry of Finance",
    category: "insurance",
    benefitType: "insurance",
    estimatedBenefitINR: 200000,
    description: "Accident insurance cover of ₹2 lakh for death and full disability at ₹20/year premium (auto-debit from bank).",
    portalUrl: "https://www.jansuraksha.gov.in/",
    requiredDocuments: ["Aadhaar Card", "Bank Passbook"],
    eligibility: [
      { field: "bankAccount", op: "exists", label: "Has a bank account" },
    ],
    formFields: [
      { id: "full_name", label: "Full Name", profileKey: "fullName", type: "text", required: true },
      { id: "aadhaar", label: "Aadhaar Number", profileKey: "aadhaarNumber", type: "text", required: true },
      { id: "dob", label: "Date of Birth", profileKey: "dob", type: "date", required: true },
      { id: "bank", label: "Bank Account", profileKey: "bankAccount", type: "text", required: true },
    ],
  },
  {
    id: "pmjjby",
    name: "PM Jeevan Jyoti Bima Yojana",
    nameHi: "पीएम जीवन ज्योति बीमा योजना",
    department: "Ministry of Finance",
    category: "insurance",
    benefitType: "insurance",
    estimatedBenefitINR: 200000,
    description: "Life insurance cover of ₹2 lakh at ₹436/year premium for ages 18-55.",
    portalUrl: "https://www.jansuraksha.gov.in/",
    requiredDocuments: ["Aadhaar Card", "Bank Passbook"],
    eligibility: [
      { field: "bankAccount", op: "exists", label: "Has a bank account" },
    ],
    formFields: [
      { id: "full_name", label: "Full Name", profileKey: "fullName", type: "text", required: true },
      { id: "aadhaar", label: "Aadhaar Number", profileKey: "aadhaarNumber", type: "text", required: true },
      { id: "dob", label: "Date of Birth", profileKey: "dob", type: "date", required: true },
      { id: "bank", label: "Bank Account", profileKey: "bankAccount", type: "text", required: true },
      { id: "phone", label: "Mobile Number", profileKey: "phone", type: "text", required: true },
    ],
  },
  {
    id: "atal-pension",
    name: "Atal Pension Yojana",
    nameHi: "अटल पेंशन योजना",
    department: "Ministry of Finance",
    category: "pension",
    benefitType: "service",
    estimatedBenefitINR: 60000,
    description: "Guaranteed pension of ₹1,000-₹5,000/month after age 60 for unorganised sector workers. Government co-contributes 50%.",
    portalUrl: "https://www.jansuraksha.gov.in/",
    requiredDocuments: ["Aadhaar Card", "Bank Passbook"],
    eligibility: [
      { field: "bankAccount", op: "exists", label: "Has a bank account" },
    ],
    formFields: [
      { id: "full_name", label: "Full Name", profileKey: "fullName", type: "text", required: true },
      { id: "aadhaar", label: "Aadhaar Number", profileKey: "aadhaarNumber", type: "text", required: true },
      { id: "dob", label: "Date of Birth", profileKey: "dob", type: "date", required: true },
      { id: "bank", label: "Bank Account", profileKey: "bankAccount", type: "text", required: true },
      { id: "phone", label: "Mobile Number", profileKey: "phone", type: "text", required: true },
    ],
  },
  {
    id: "mgnrega",
    name: "MGNREGA Job Card",
    nameHi: "मनरेगा जॉब कार्ड",
    department: "Ministry of Rural Development",
    category: "employment",
    benefitType: "service",
    estimatedBenefitINR: 30000,
    description: "100 days of guaranteed wage employment per year per household for unskilled manual work in rural areas.",
    portalUrl: "https://nrega.nic.in/",
    requiredDocuments: ["Aadhaar Card", "Address Proof", "Passport Photo"],
    eligibility: [
      { field: "state", op: "exists", label: "State is known" },
    ],
    formFields: [
      { id: "full_name", label: "Full Name", profileKey: "fullName", type: "text", required: true },
      { id: "aadhaar", label: "Aadhaar Number", profileKey: "aadhaarNumber", type: "text", required: true },
      { id: "address", label: "Address", profileKey: "address", type: "textarea", required: true },
      { id: "state", label: "State", profileKey: "state", type: "text", required: true },
      { id: "district", label: "District", profileKey: "district", type: "text", required: true },
    ],
  },
  {
    id: "skill-india",
    name: "Skill India (PMKVY)",
    nameHi: "स्किल इंडिया (PMKVY)",
    department: "Ministry of Skill Development",
    category: "skill",
    benefitType: "service",
    estimatedBenefitINR: 8000,
    description: "Free short-term training (150-300 hours) with certification, assessment fee, and reward of ₹8,000 on passing.",
    portalUrl: "https://www.pmkvyofficial.org/",
    requiredDocuments: ["Aadhaar Card", "Education Certificate"],
    eligibility: [
      { field: "fullName", op: "exists", label: "Name is known" },
    ],
    formFields: [
      { id: "full_name", label: "Full Name", profileKey: "fullName", type: "text", required: true },
      { id: "aadhaar", label: "Aadhaar Number", profileKey: "aadhaarNumber", type: "text", required: true },
      { id: "education", label: "Education Level", profileKey: "education", type: "text", required: true },
      { id: "phone", label: "Mobile Number", profileKey: "phone", type: "text", required: true },
    ],
  },
  {
    id: "beti-bachao",
    name: "Beti Bachao Beti Padhao",
    nameHi: "बेटी बचाओ बेटी पढ़ाओ",
    department: "Ministry of Women & Child Development",
    category: "women",
    benefitType: "service",
    estimatedBenefitINR: 25000,
    description: "Awareness and direct benefit transfer for families with girl children, including education support and protection services.",
    portalUrl: "https://wcd.nic.in/bbbp-schemes",
    requiredDocuments: ["Aadhaar Card", "Birth Certificate"],
    eligibility: [
      { field: "gender", op: "eq", value: "female", label: "For girl child" },
    ],
    formFields: [
      { id: "full_name", label: "Girl's Name", profileKey: "fullName", type: "text", required: true },
      { id: "dob", label: "Date of Birth", profileKey: "dob", type: "date", required: true },
      { id: "father_name", label: "Father's Name", profileKey: "fatherName", type: "text", required: true },
      { id: "address", label: "Address", profileKey: "address", type: "textarea", required: true },
    ],
  },
  {
    id: "maternity-benefit",
    name: "PM Matru Vandana Yojana",
    nameHi: "पीएम मातृ वंदना योजना",
    department: "Ministry of Women & Child Development",
    category: "women",
    benefitType: "cash",
    estimatedBenefitINR: 5000,
    description: "₹5,000 cash benefit in three instalments for first live birth to compensate wage loss during pregnancy.",
    portalUrl: "https://wcd.nic.in/schemes/pradhan-mantri-matru-vandana-yojana",
    requiredDocuments: ["Aadhaar Card", "Bank Passbook", "MCP Card"],
    eligibility: [
      { field: "gender", op: "eq", value: "female", label: "Applicant is female" },
    ],
    formFields: [
      { id: "full_name", label: "Full Name", profileKey: "fullName", type: "text", required: true },
      { id: "aadhaar", label: "Aadhaar Number", profileKey: "aadhaarNumber", type: "text", required: true },
      { id: "dob", label: "Date of Birth", profileKey: "dob", type: "date", required: true },
      { id: "bank", label: "Bank Account", profileKey: "bankAccount", type: "text", required: true },
      { id: "phone", label: "Mobile Number", profileKey: "phone", type: "text", required: true },
    ],
  },
  {
    id: "pm-svanidhi",
    name: "PM SVANidhi",
    nameHi: "पीएम स्वनिधि",
    department: "Ministry of Housing & Urban Affairs",
    category: "finance",
    benefitType: "loan",
    estimatedBenefitINR: 50000,
    description: "Working capital loan of ₹10K-₹50K for street vendors. 7% interest subsidy and ₹1,200/year cashback for digital payments.",
    portalUrl: "https://pmsvanidhi.mohua.gov.in/",
    requiredDocuments: ["Aadhaar Card", "Vending Certificate or Letter of Recommendation"],
    eligibility: [
      { field: "occupation", op: "in", value: ["vendor", "street-vendor", "hawker", "shopkeeper"], label: "Street vendor" },
    ],
    formFields: [
      { id: "full_name", label: "Full Name", profileKey: "fullName", type: "text", required: true },
      { id: "aadhaar", label: "Aadhaar Number", profileKey: "aadhaarNumber", type: "text", required: true },
      { id: "phone", label: "Mobile Number", profileKey: "phone", type: "text", required: true },
      { id: "address", label: "Vending Location", profileKey: "address", type: "textarea", required: true },
    ],
  },

  {
    id: "pm-surya-ghar",
    name: "PM Surya Ghar: Muft Bijli Yojana",
    nameHi: "पीएम सूर्य घर: मुफ्त बिजली योजना",
    department: "Ministry of New and Renewable Energy",
    category: "housing",
    benefitType: "subsidy",
    estimatedBenefitINR: 78000,
    description: "Rooftop solar installation subsidy up to ₹78,000 and 300 units of free electricity every month for households.",
    portalUrl: "https://pmsuryaghar.gov.in/",
    requiredDocuments: ["Aadhaar Card", "Electricity Bill", "Bank Passbook"],
    eligibility: [
      { field: "annualIncome", op: "lte", value: 600000, label: "Annual income ≤ ₹6,00,000" },
    ],
    formFields: [
      { id: "full_name", label: "Full Name", profileKey: "fullName", type: "text", required: true },
      { id: "aadhaar", label: "Aadhaar Number", profileKey: "aadhaarNumber", type: "text", required: true },
      { id: "consumer_number", label: "Electricity Consumer Number", type: "text", required: true },
      { id: "state", label: "State", profileKey: "state", type: "text", required: true },
    ],
  },
  {
    id: "lakhpati-didi",
    name: "Lakhpati Didi Scheme",
    nameHi: "लखपति दीदी योजना",
    department: "Ministry of Rural Development",
    category: "women",
    benefitType: "loan",
    estimatedBenefitINR: 100000,
    description: "Interest-free micro-loans of ₹1 Lakh to ₹5 Lakh and entrepreneurship training for Self-Help Group (SHG) women members.",
    portalUrl: "https://nrlm.gov.in/",
    requiredDocuments: ["Aadhaar Card", "SHG Member ID", "Bank Passbook"],
    eligibility: [
      { field: "gender", op: "eq", value: "female", label: "Applicant is female" },
    ],
    formFields: [
      { id: "full_name", label: "Full Name", profileKey: "fullName", type: "text", required: true },
      { id: "aadhaar", label: "Aadhaar Number", profileKey: "aadhaarNumber", type: "text", required: true },
      { id: "shg_name", label: "Self Help Group Name", type: "text", required: true },
    ],
  },
  {
    id: "pm-matsya-sampada",
    name: "PM Matsya Sampada Yojana",
    nameHi: "पीएम मत्स्य संपदा योजना",
    department: "Department of Fisheries",
    category: "agriculture",
    benefitType: "subsidy",
    estimatedBenefitINR: 150000,
    description: "Financial subsidy up to 60% for women/SC/ST and 40% for general categories for aquaculture, boats, and fish farming equipment.",
    portalUrl: "https://pmmsy.dof.gov.in/",
    requiredDocuments: ["Aadhaar Card", "Pond / Land Lease Documents", "Bank Passbook"],
    eligibility: [
      { field: "occupation", op: "in", value: ["fisherman", "fishery", "farmer", "agriculture"], label: "Occupation in fisheries or agriculture" },
    ],
    formFields: [
      { id: "full_name", label: "Full Name", profileKey: "fullName", type: "text", required: true },
      { id: "aadhaar", label: "Aadhaar Number", profileKey: "aadhaarNumber", type: "text", required: true },
      { id: "district", label: "District", profileKey: "district", type: "text", required: true },
    ],
  },
  {
    id: "pm-ksy",
    name: "PM Krishi Sinchayee Yojana",
    nameHi: "पीएम कृषि सिंचाई योजना",
    department: "Ministry of Agriculture",
    category: "agriculture",
    benefitType: "subsidy",
    estimatedBenefitINR: 45000,
    description: "55% subsidy for small/marginal farmers for micro-irrigation systems (drip and sprinkler technology).",
    portalUrl: "https://pmksy.gov.in/",
    requiredDocuments: ["Aadhaar Card", "Land Khata/Khasra", "Bank Passbook"],
    eligibility: [
      { field: "occupation", op: "in", value: ["farmer", "agriculture", "kisan"], label: "Occupation is farming" },
    ],
    formFields: [
      { id: "full_name", label: "Full Name", profileKey: "fullName", type: "text", required: true },
      { id: "aadhaar", label: "Aadhaar Number", profileKey: "aadhaarNumber", type: "text", required: true },
      { id: "land_area", label: "Land Area (Acres)", type: "number", required: true },
    ],
  },
  {
    id: "day-nrlm",
    name: "DAY-NRLM (Deendayal Antyodaya Yojana)",
    nameHi: "दीनदयाल अंत्योदय योजना - आजीविका",
    department: "Ministry of Rural Development",
    category: "employment",
    benefitType: "cash",
    estimatedBenefitINR: 15000,
    description: "Revolving fund of ₹15,000 per Self-Help Group and community investment support for poor rural women.",
    portalUrl: "https://nrlm.gov.in/",
    requiredDocuments: ["Aadhaar Card", "Ration Card", "Bank Passbook"],
    eligibility: [
      { field: "annualIncome", op: "lte", value: 250000, label: "Annual income ≤ ₹2,50,000" },
    ],
    formFields: [
      { id: "full_name", label: "Full Name", profileKey: "fullName", type: "text", required: true },
      { id: "aadhaar", label: "Aadhaar Number", profileKey: "aadhaarNumber", type: "text", required: true },
    ],
  },
  {
    id: "day-nulm",
    name: "DAY-NULM (Urban Livelihoods)",
    nameHi: "दीनदयाल अंत्योदय योजना - शहरी",
    department: "Ministry of Housing & Urban Affairs",
    category: "employment",
    benefitType: "skill",
    estimatedBenefitINR: 20000,
    description: "Skill training and micro-enterprise loans up to ₹2 Lakh for urban poor and street vendors.",
    portalUrl: "https://nulm.gov.in/",
    requiredDocuments: ["Aadhaar Card", "Urban BPL / Income Certificate"],
    eligibility: [
      { field: "annualIncome", op: "lte", value: 300000, label: "Annual income ≤ ₹3,00,000" },
    ],
    formFields: [
      { id: "full_name", label: "Full Name", profileKey: "fullName", type: "text", required: true },
      { id: "aadhaar", label: "Aadhaar Number", profileKey: "aadhaarNumber", type: "text", required: true },
    ],
  },
  {
    id: "pm-shri",
    name: "PM SHRI School Student Support",
    nameHi: "पीएम श्री स्कूल छात्र सहायता",
    department: "Ministry of Education",
    category: "education",
    benefitType: "service",
    estimatedBenefitINR: 5000,
    description: "Free digital learning kits, uniforms, and STEM learning access for students enrolled in PM SHRI government schools.",
    portalUrl: "https://pmshrischools.education.gov.in/",
    requiredDocuments: ["Student ID Card", "Aadhaar Card"],
    eligibility: [
      { field: "occupation", op: "in", value: ["student", "pupil", "scholar"], label: "Occupation is student" },
    ],
    formFields: [
      { id: "full_name", label: "Full Name", profileKey: "fullName", type: "text", required: true },
      { id: "school_name", label: "School Name", type: "text", required: true },
    ],
  },
  {
    id: "naps",
    name: "National Apprenticeship Promotion Scheme (NAPS)",
    nameHi: "राष्ट्रीय शिक्षुता प्रोत्साहन योजना",
    department: "Ministry of Skill Development & Entrepreneurship",
    category: "skill",
    benefitType: "cash",
    estimatedBenefitINR: 18000,
    description: "Monthly stipend support up to ₹1,500/month (25% of total stipend) during industry apprenticeship training.",
    portalUrl: "https://www.apprenticeshipindia.gov.in/",
    requiredDocuments: ["Aadhaar Card", "Educational Marksheets", "Bank Passbook"],
    eligibility: [
      { field: "age", op: "gte", value: 18, label: "Age ≥ 18 years" },
    ],
    formFields: [
      { id: "full_name", label: "Full Name", profileKey: "fullName", type: "text", required: true },
      { id: "aadhaar", label: "Aadhaar Number", profileKey: "aadhaarNumber", type: "text", required: true },
    ],
  },
  {
    id: "mission-vatsalya",
    name: "Mission Vatsalya (Child Welfare)",
    nameHi: "मिशन वात्सल्य बाल कल्याण",
    department: "Ministry of Women and Child Development",
    category: "women",
    benefitType: "cash",
    estimatedBenefitINR: 40000,
    description: "Financial aid of ₹4,000/month for non-institutional care of vulnerable and orphaned children.",
    portalUrl: "https://wcd.nic.in/",
    requiredDocuments: ["Child Birth Certificate", "Guardian Aadhaar Card", "Income Certificate"],
    eligibility: [
      { field: "annualIncome", op: "lte", value: 200000, label: "Annual family income ≤ ₹2,00,000" },
    ],
    formFields: [
      { id: "full_name", label: "Guardian Name", profileKey: "fullName", type: "text", required: true },
      { id: "child_name", label: "Child Name", type: "text", required: true },
    ],
  },
  {
    id: "mission-shakti",
    name: "Mission Shakti (Sambal & Samarthya)",
    nameHi: "मिशन शक्ति",
    department: "Ministry of Women and Child Development",
    category: "women",
    benefitType: "service",
    estimatedBenefitINR: 25000,
    description: "Integrated care, legal aid, shelter, and financial assistance for women in distress through One Stop Centres.",
    portalUrl: "https://wcd.nic.in/schemes/mission-shakti",
    requiredDocuments: ["Aadhaar Card", "Residence Proof"],
    eligibility: [
      { field: "gender", op: "eq", value: "female", label: "Applicant is female" },
    ],
    formFields: [
      { id: "full_name", label: "Full Name", profileKey: "fullName", type: "text", required: true },
      { id: "phone", label: "Mobile Number", profileKey: "phone", type: "text", required: true },
    ],
  },
  {
    id: "pm-poshan",
    name: "PM POSHAN Scheme (Mid-Day Meal)",
    nameHi: "पीएम पोषण योजना",
    department: "Ministry of Education",
    category: "food",
    benefitType: "ration",
    estimatedBenefitINR: 6000,
    description: "Nutritious hot cooked meals for primary and upper primary school children across government schools.",
    portalUrl: "https://pmposhan.education.gov.in/",
    requiredDocuments: ["School Enrollment Record"],
    eligibility: [
      { field: "occupation", op: "in", value: ["student", "pupil"], label: "Enrolled in school" },
    ],
    formFields: [
      { id: "full_name", label: "Student Name", profileKey: "fullName", type: "text", required: true },
      { id: "school_id", label: "School UDISE Code", type: "text", required: true },
    ],
  },
  {
    id: "jal-jeevan",
    name: "Jal Jeevan Mission",
    nameHi: "जल जीवन मिशन",
    department: "Department of Drinking Water and Sanitation",
    category: "housing",
    benefitType: "service",
    estimatedBenefitINR: 10000,
    description: "Free functional household tap connection (FHTC) providing clean drinking water to rural households.",
    portalUrl: "https://ejalshakti.gov.in/",
    requiredDocuments: ["Aadhaar Card", "Electricity or House Tax Receipt"],
    eligibility: [
      { field: "state", op: "exists", label: "State is known" },
    ],
    formFields: [
      { id: "full_name", label: "Head of Family Name", profileKey: "fullName", type: "text", required: true },
      { id: "address", label: "House Address", profileKey: "address", type: "textarea", required: true },
    ],
  },
  {
    id: "samagra-shiksha",
    name: "Samagra Shiksha Abhiyan Allowance",
    nameHi: "समग्र शिक्षा भत्ता योजना",
    department: "Department of School Education & Literacy",
    category: "education",
    benefitType: "cash",
    estimatedBenefitINR: 3500,
    description: "Annual stipend for free textbooks, school uniforms, and transport allowance for elementary school students.",
    portalUrl: "https://samagra.education.gov.in/",
    requiredDocuments: ["Student Aadhaar Card", "Bank Account Details"],
    eligibility: [
      { field: "occupation", op: "in", value: ["student", "pupil"], label: "Occupation is student" },
    ],
    formFields: [
      { id: "full_name", label: "Student Name", profileKey: "fullName", type: "text", required: true },
      { id: "bank_acc", label: "Bank Account Number", profileKey: "bankAccount", type: "text", required: true },
    ],
  },
  {
    id: "kanya-sumangala",
    name: "Mukhya Mantri Kanya Sumangala Yojana",
    nameHi: "मुख्यमंत्री कन्या सुमंगला योजना",
    department: "Department of Women & Child Development",
    category: "women",
    benefitType: "cash",
    estimatedBenefitINR: 25000,
    description: "₹25,000 cash grant in 6 stages from birth to graduation for girl children born in eligible families.",
    portalUrl: "https://mksy.up.gov.in/",
    requiredDocuments: ["Girl Child Aadhaar Card", "Parent Income Certificate", "Bank Passbook"],
    eligibility: [
      { field: "gender", op: "eq", value: "female", label: "Applicant is female" },
      { field: "annualIncome", op: "lte", value: 300000, label: "Annual family income ≤ ₹3,00,000" },
    ],
    formFields: [
      { id: "full_name", label: "Girl Child Name", profileKey: "fullName", type: "text", required: true },
      { id: "mother_name", label: "Mother's Name", type: "text", required: true },
      { id: "dob", label: "Date of Birth", profileKey: "dob", type: "date", required: true },
    ],
  },
  {
    id: "ladli-behna",
    name: "CM Ladli Behna Yojana",
    nameHi: "मुख्यमंत्री लाडली बहना योजना",
    department: "Department of Women and Child Development",
    category: "women",
    benefitType: "cash",
    estimatedBenefitINR: 15000,
    description: "Direct Bank Transfer of ₹1,250 every month (₹15,000/year) to married/unmarried adult women.",
    portalUrl: "https://cmladlibehna.mp.gov.in/",
    requiredDocuments: ["Samagra ID", "Aadhaar Card", "DBT Enabled Bank Account"],
    eligibility: [
      { field: "gender", op: "eq", value: "female", label: "Applicant is female" },
      { field: "annualIncome", op: "lte", value: 250000, label: "Annual income ≤ ₹2,50,000" },
    ],
    formFields: [
      { id: "full_name", label: "Full Name", profileKey: "fullName", type: "text", required: true },
      { id: "aadhaar", label: "Aadhaar Number", profileKey: "aadhaarNumber", type: "text", required: true },
      { id: "bank", label: "DBT Bank Account", profileKey: "bankAccount", type: "text", required: true },
    ],
  },
  {
    id: "subhadra-yojana",
    name: "Subhadra Yojana",
    nameHi: "सुभद्रा योजना",
    department: "Department of Women and Child Development",
    category: "women",
    benefitType: "cash",
    estimatedBenefitINR: 50000,
    description: "₹10,000 per year for 5 years (Total ₹50,000) directly into Aadhaar-linked bank accounts for women aged 21-60.",
    portalUrl: "https://subhadra.odisha.gov.in/",
    requiredDocuments: ["Aadhaar Card", "Single Bank Account"],
    eligibility: [
      { field: "gender", op: "eq", value: "female", label: "Applicant is female" },
      { field: "age", op: "gte", value: 21, label: "Age ≥ 21 years" },
    ],
    formFields: [
      { id: "full_name", label: "Full Name", profileKey: "fullName", type: "text", required: true },
      { id: "aadhaar", label: "Aadhaar Number", profileKey: "aadhaarNumber", type: "text", required: true },
    ],
  },
  {
    id: "majhi-ladki-bahin",
    name: "Mukhyamantri Majhi Ladki Bahin Yojana",
    nameHi: "मुख्यमंत्री माझी लाडकी बहीण योजना",
    department: "Women and Child Development Department",
    category: "women",
    benefitType: "cash",
    estimatedBenefitINR: 18000,
    description: "₹1,500 monthly financial assistance (₹18,000 annually) for women aged 21 to 65 years.",
    portalUrl: "https://ladakibahin.maharashtra.gov.in/",
    requiredDocuments: ["Aadhaar Card", "Domicile Certificate", "Income Certificate"],
    eligibility: [
      { field: "gender", op: "eq", value: "female", label: "Applicant is female" },
      { field: "annualIncome", op: "lte", value: 250000, label: "Annual family income ≤ ₹2,50,000" },
    ],
    formFields: [
      { id: "full_name", label: "Full Name", profileKey: "fullName", type: "text", required: true },
      { id: "aadhaar", label: "Aadhaar Number", profileKey: "aadhaarNumber", type: "text", required: true },
    ],
  },
  {
    id: "pm-e-bus-sewa",
    name: "PM-eBus Sewa Concession",
    nameHi: "पीएम ई-बस सेवा रियायत",
    department: "Ministry of Housing & Urban Affairs",
    category: "employment",
    benefitType: "service",
    estimatedBenefitINR: 3600,
    description: "Discounted monthly bus travel pass for senior citizens, students, and divyangjan on electric city buses.",
    portalUrl: "https://mohua.gov.in/",
    requiredDocuments: ["Aadhaar Card", "Senior Citizen / Student ID"],
    eligibility: [
      { field: "state", op: "exists", label: "State is known" },
    ],
    formFields: [
      { id: "full_name", label: "Full Name", profileKey: "fullName", type: "text", required: true },
      { id: "aadhaar", label: "Aadhaar Number", profileKey: "aadhaarNumber", type: "text", required: true },
    ],
  },
  {
    id: "svamitva",
    name: "SVAMITVA Property Title Card",
    nameHi: "स्वामित्व योजना संपत्ति कार्ड",
    department: "Ministry of Panchayati Raj",
    category: "housing",
    benefitType: "service",
    estimatedBenefitINR: 20000,
    description: "Official Ownership Property Card for Abadi (inhabited) rural land using drone survey technology.",
    portalUrl: "https://svamitva.nic.in/",
    requiredDocuments: ["Aadhaar Card", "Gram Panchayat Property Document"],
    eligibility: [
      { field: "state", op: "exists", label: "State is known" },
    ],
    formFields: [
      { id: "full_name", label: "Owner Name", profileKey: "fullName", type: "text", required: true },
      { id: "village", label: "Gram Panchayat / Village", profileKey: "district", type: "text", required: true },
    ],
  },
  {
    id: "pm-pranam",
    name: "PM PRANAM Fertilizer Subsidy Incentive",
    nameHi: "पीएम प्रणाम योजना",
    department: "Department of Fertilizers",
    category: "agriculture",
    benefitType: "subsidy",
    estimatedBenefitINR: 8000,
    description: "50% grant subsidy for Gram Panchayats and farmers promoting organic and bio-fertilizer usage.",
    portalUrl: "https://www.fert.nic.in/",
    requiredDocuments: ["Land Records", "Aadhaar Card"],
    eligibility: [
      { field: "occupation", op: "in", value: ["farmer", "agriculture", "kisan"], label: "Occupation is farming" },
    ],
    formFields: [
      { id: "full_name", label: "Farmer Name", profileKey: "fullName", type: "text", required: true },
      { id: "aadhaar", label: "Aadhaar Number", profileKey: "aadhaarNumber", type: "text", required: true },
    ],
  },
  {
    id: "agri-infra-fund",
    name: "Agriculture Infrastructure Fund",
    nameHi: "कृषि अवसंरचना कोष",
    department: "Ministry of Agriculture",
    category: "agriculture",
    benefitType: "loan",
    estimatedBenefitINR: 300000,
    description: "3% interest subvention on loans up to ₹2 Crore for setting up cold storage, warehouses, and sorting units.",
    portalUrl: "https://agriinfra.dac.gov.in/",
    requiredDocuments: ["Aadhaar Card", "DPR / Project Report", "Bank Details"],
    eligibility: [
      { field: "occupation", op: "in", value: ["farmer", "agriculture", "business"], label: "Agri-entrepreneur or farmer" },
    ],
    formFields: [
      { id: "full_name", label: "Applicant Name", profileKey: "fullName", type: "text", required: true },
      { id: "project_cost", label: "Project Cost (INR)", type: "number", required: true },
    ],
  },
  {
    id: "pm-mitra",
    name: "PM MITRA Weaver & Artisan Support",
    nameHi: "पीएम मित्रा बुनकर सहायता",
    department: "Ministry of Textiles",
    category: "skill",
    benefitType: "subsidy",
    estimatedBenefitINR: 25000,
    description: "Financial subsidy for modern handloom looms, raw material credit line, and skill training for traditional weavers.",
    portalUrl: "https://texmin.nic.in/",
    requiredDocuments: ["Weaver ID Card", "Aadhaar Card", "Bank Passbook"],
    eligibility: [
      { field: "occupation", op: "in", value: ["artisan", "weaver", "craftsman", "tailor"], label: "Occupation is artisan or weaver" },
    ],
    formFields: [
      { id: "full_name", label: "Full Name", profileKey: "fullName", type: "text", required: true },
      { id: "aadhaar", label: "Aadhaar Number", profileKey: "aadhaarNumber", type: "text", required: true },
    ],
  },
  {
    id: "adip-divyangjan",
    name: "ADIP Scheme for Divyangjan",
    nameHi: "दिव्यांगजन हेतु एडीआईपी योजना",
    department: "Department of Empowerment of Persons with Disabilities",
    category: "disability",
    benefitType: "service",
    estimatedBenefitINR: 30000,
    description: "Free durable motor tricycles, hearing aids, wheelchairs, and prosthetic limbs for persons with disabilities.",
    portalUrl: "https://disabilityaffairs.gov.in/",
    requiredDocuments: ["UDID Card / Disability Certificate", "Aadhaar Card", "Income Certificate"],
    eligibility: [
      { field: "annualIncome", op: "lte", value: 270000, label: "Monthly income ≤ ₹22,500 (₹2.7L/year)" },
    ],
    formFields: [
      { id: "full_name", label: "Full Name", profileKey: "fullName", type: "text", required: true },
      { id: "udid", label: "UDID Card Number", type: "text", required: true },
      { id: "aadhaar", label: "Aadhaar Number", profileKey: "aadhaarNumber", type: "text", required: true },
    ],
  },
  {
    id: "post-matric-sc-st",
    name: "Post-Matric Scholarship for SC/ST",
    nameHi: "अनुसूचित जाति/जनजाति उत्तर-मैट्रिक छात्रवृत्ति",
    department: "Ministry of Social Justice & Empowerment",
    category: "education",
    benefitType: "cash",
    estimatedBenefitINR: 20000,
    description: "Full tuition fee reimbursement and monthly maintenance allowance for SC/ST post-secondary students.",
    portalUrl: "https://scholarships.gov.in/",
    requiredDocuments: ["Caste Certificate", "Aadhaar Card", "Income Certificate", "Fee Receipt"],
    eligibility: [
      { field: "occupation", op: "in", value: ["student", "pupil"], label: "Occupation is student" },
      { field: "annualIncome", op: "lte", value: 250000, label: "Family income ≤ ₹2,50,000" },
    ],
    formFields: [
      { id: "full_name", label: "Student Name", profileKey: "fullName", type: "text", required: true },
      { id: "college_name", label: "College / Institute Name", type: "text", required: true },
      { id: "aadhaar", label: "Aadhaar Number", profileKey: "aadhaarNumber", type: "text", required: true },
    ],
  },
  {
    id: "pre-matric-minority",
    name: "Pre-Matric Scholarship for Minorities",
    nameHi: "अल्पसंख्यक पूर्व-मैट्रिक छात्रवृत्ति",
    department: "Ministry of Minority Affairs",
    category: "education",
    benefitType: "cash",
    estimatedBenefitINR: 4000,
    description: "Scholarship aid up to ₹4,000/year for Class 1 to 10 students belonging to minority communities.",
    portalUrl: "https://scholarships.gov.in/",
    requiredDocuments: ["Self Declaration of Minority Community", "Aadhaar Card", "Bank Passbook"],
    eligibility: [
      { field: "occupation", op: "in", value: ["student", "pupil"], label: "Occupation is student" },
      { field: "annualIncome", op: "lte", value: 100000, label: "Family income ≤ ₹1,00,000" },
    ],
    formFields: [
      { id: "full_name", label: "Student Name", profileKey: "fullName", type: "text", required: true },
      { id: "school", label: "School Name", type: "text", required: true },
    ],
  },
  {
    id: "central-sector-scholarship",
    name: "Central Sector Scheme of Scholarships",
    nameHi: "केंद्रीय क्षेत्र छात्रवृत्ति योजना",
    department: "Department of Higher Education",
    category: "education",
    benefitType: "cash",
    estimatedBenefitINR: 20000,
    description: "₹12,000/year for graduation and ₹20,000/year for post-graduation for meritorious top 80 percentile students.",
    portalUrl: "https://scholarships.gov.in/",
    requiredDocuments: ["Class 12th Marksheet", "Aadhaar Card", "Income Certificate"],
    eligibility: [
      { field: "occupation", op: "in", value: ["student", "pupil"], label: "Occupation is student" },
      { field: "annualIncome", op: "lte", value: 450000, label: "Family income ≤ ₹4,50,000" },
    ],
    formFields: [
      { id: "full_name", label: "Student Name", profileKey: "fullName", type: "text", required: true },
      { id: "roll_no", label: "Class 12 Board Roll Number", type: "text", required: true },
    ],
  },
  {
    id: "e-shram",
    name: "e-SHRAM Card & Social Security Cover",
    nameHi: "ई-श्रम कार्ड एवं सामाजिक सुरक्षा",
    department: "Ministry of Labour & Employment",
    category: "insurance",
    benefitType: "insurance",
    estimatedBenefitINR: 200000,
    description: "Universal e-SHRAM 12-digit UAN card giving ₹2 Lakh accidental death cover and priority in social security schemes.",
    portalUrl: "https://eshram.gov.in/",
    requiredDocuments: ["Aadhaar Card", "Bank Account Details"],
    eligibility: [
      { field: "age", op: "gte", value: 16, label: "Age ≥ 16 years" },
    ],
    formFields: [
      { id: "full_name", label: "Full Name", profileKey: "fullName", type: "text", required: true },
      { id: "aadhaar", label: "Aadhaar Number", profileKey: "aadhaarNumber", type: "text", required: true },
      { id: "occupation", label: "Unorganized Occupation", profileKey: "occupation", type: "text", required: true },
    ],
  },
];

// --- Eligibility Engine ---

function checkRule(profile: ProfileData, rule: EligibilityRule): boolean {
  const val = profile[rule.field];

  switch (rule.op) {
    case "exists":
      return val !== undefined && val !== null && val !== "";
    case "eq":
      return val?.toLowerCase() === String(rule.value).toLowerCase();
    case "neq":
      return val?.toLowerCase() !== String(rule.value).toLowerCase();
    case "in": {
      if (!val || !Array.isArray(rule.value)) return false;
      return rule.value.some(
        (v) => val.toLowerCase() === v.toLowerCase(),
      );
    }
    case "lt":
      return val !== undefined && Number(val) < Number(rule.value);
    case "lte":
      return val !== undefined && Number(val) <= Number(rule.value);
    case "gt":
      return val !== undefined && Number(val) > Number(rule.value);
    case "gte":
      return val !== undefined && Number(val) >= Number(rule.value);
    default:
      return false;
  }
}

export interface SchemeMatch {
  scheme: Scheme;
  score: number;
  matchedRules: string[];
  unmatchedRules: string[];
  missingFields: string[];
}

export function findEligibleSchemes(profile: ProfileData): SchemeMatch[] {
  const results: SchemeMatch[] = [];

  for (const scheme of SCHEMES) {
    const matchedRules: string[] = [];
    const unmatchedRules: string[] = [];
    const missingFields: string[] = [];

    for (const rule of scheme.eligibility) {
      const fieldVal = profile[rule.field];
      if (fieldVal === undefined || fieldVal === null || fieldVal === "") {
        missingFields.push(rule.label);
        continue;
      }
      if (checkRule(profile, rule)) {
        matchedRules.push(rule.label);
      } else {
        unmatchedRules.push(rule.label);
      }
    }

    if (unmatchedRules.length > 0) continue;

    const totalRules = scheme.eligibility.length;
    const score =
      totalRules === 0
        ? 0.5
        : matchedRules.length / totalRules;

    results.push({ scheme, score, matchedRules, unmatchedRules, missingFields });
  }

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.scheme.estimatedBenefitINR - a.scheme.estimatedBenefitINR;
  });

  return results;
}

export function getSchemeById(id: string): Scheme | undefined {
  return SCHEMES.find((s) => s.id === id);
}
