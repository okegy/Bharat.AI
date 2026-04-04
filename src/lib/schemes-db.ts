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
  benefitType: "cash" | "subsidy" | "service" | "insurance" | "ration" | "loan";
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
