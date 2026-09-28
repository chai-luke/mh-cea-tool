// Text shared across screens. Plain register (de-AI pass 18 Sep 2026): no spaced dashes, no arrows in prose, no tool-internal
// vocabulary. Navigation labels ("Sources → Medicine costs") keep the arrow because they name a path in the tool, not prose.

export const HOME_TITLE = "Antipsychotic Medication Cost-Effectiveness Tool";
export const HOME_SUB = "Prioritizing Medications for Psychosis.";
export const ABOUT = "The tool aims to support decision-makers in prioritizing antipsychotic medicines based on value for money. It adopts the approach of a health technology appraisal from the health sector perspective, modelling the costs and benefits of each product over one year. Essential medicines and newer products are compared against either a current treatment or no treatment comparator, with results translated into ranked cost-effectiveness and budget impact based on the selected product cabinet.";
export const TARGET_POP = "Adults with non-affective psychosis, with a focus on schizophrenia.";

export const PRODUCTS_SUB = "Please select which products should be included in the analysis and enter prices for each product.";
export const PRICE_TIER_PROTOCOL = "T1 in-country procurement, then T2 India import/export price, then T3 focus-country proxy (an average of the other focus countries, or one focus country's tender used as a proxy), then T4 country-adjusted global benchmark.";
export const ABBREVIATIONS: [string, string][] = [
  ["CEA", "Cost-effectiveness analysis: compares interventions on cost per health outcome gained"],
  ["CPI", "Consumer price index: used to inflate or deflate costs across years"],
  ["DALY", "Disability-adjusted life year: one year of healthy life lost to death or disability"],
  ["DW", "Disability weight: severity weight (0 to 1) from the Global Burden of Disease study"],
  ["EJP", "Economically justifiable price: the highest unit price at which a product is still cost-effective"],
  ["FGA", "First-generation antipsychotic: the older \"typical\" antipsychotics"],
  ["HRH", "Human resources for health: clinical staff costs (doctors, nurses, pharmacists and others)"],
  ["ICER", "Incremental cost-effectiveness ratio: extra cost per extra DALY averted compared with the comparator"],
  ["IM injection", "Intramuscular injection: short-acting, typically for acute management"],
  ["LAI", "Long-acting injectable: depot injection given every 2 to 4 weeks; improves adherence"],
  ["Novel", "New mechanism of action not classified as FGA or SGA (for example Cobenfy, a muscarinic agonist)"],
  ["SA IC", "South Africa Investment Case for Mental Health: primary data source (Docrat and colleagues)"],
  ["SGA", "Second-generation antipsychotic: the newer \"atypical\" antipsychotics"],
];
export const BASIS_NOTES: [string, string, string][] = [
  ["T1", "c-grn", "In-country procurement price (strongest)"],
  ["T2", "c-tea", "India import/export trade price"],
  ["T3", "c-gry", "Focus-country proxy: an average of the other focus countries, or one focus country's tender"],
  ["T4", "c-amb", "Country-adjusted global benchmark (weakest; replace with a local price when known)"],
];

export const SETUP = {
  title: "Model Setup",
  sub: "Select the country, comparator and currency, then review the products on the Products page.",
  country: "Drives prices, salaries, pathways and thresholds",
  comparator: "Compare to no treatment or current treatment?",
  currency: "USD ($) or LCU (local currency unit). LCU converts every money figure in the model at the country exchange rate; DALYs and percentages are unaffected.",
  ctTitle: (c: string) => `Current treatment by use in ${c}`,
  ctSub: "Please select the product for current treatment for each indicated use category.",
  analysisTitle: "Analysis settings",
  analysisHint: "These define the question being asked: which cost-effectiveness threshold, whether programme overheads count, and whether medicines are costed as taken or as procured. Change them freely for a country analysis.",
  threshold: "Select the threshold for cost-effectiveness.",
  custom: "Enter the threshold in USD per DALY averted. It is converted automatically when LCU is selected.",
  inEffect: "The value every cost-effectiveness label on the results pages is judged against.",
  admin: "Account for HRH costs of training, supervision, program management.",
  costing: "Consumed doses = standard CEA convention (default). Full course = what procurement pays; shows the unconsumed share as wastage and does not credit low adherence with lower costs. Switch here for the procurement view.",
  methodTitle: "Method assumptions",
  methodHint: "These change how the model calculates rather than what is asked. They are held at the validation-release defaults so results stay comparable across countries; change them to test the method, and say so when quoting results.",
  channel: "People on treatment are admitted to hospital less often than people who are not (trial evidence). Turn off to give every product the same admission rate.",
  admBasis: "Country admission data mostly describe people already on treatment. “Adjusted for treatment” works back to the rate without treatment before applying each product's effect (recommended). “As reported” uses the country rate directly as the untreated rate.",
  admBasisLabels: { "Comparator-rebased": "Adjusted for treatment (recommended)", "Untreated baseline": "As reported" } as Record<string, string>,
  tf: "How symptom improvement is converted into healthy time. Proportional: one standard deviation of improvement removes 28% of the untreated disability weight (the WHO-CHOICE method, recommended). Absolute: a fixed 0.181 disability-weight units per standard deviation (Andrews 2003).",
  tfLabels: { "Proportional": "Proportional (share of disability)", "Absolute (Andrews literal)": "Absolute (fixed 0.181)" } as Record<string, string>,
  cap: "Never credits more improvement than the gap between acute and stable schizophrenia in the Global Burden of Disease study (0.19 disability-weight units). At current values it only affects clozapine (about 3%).",
  mortality: "People on any antipsychotic die less often than people left untreated (hazard ratio 0.71, Correll 2022; observational evidence). On by default. It applies to every treated product, so it cancels out when products are compared with each other and matters only against no treatment.",
  mortalityLayers: "An extra survival benefit for long-acting injections (odds ratio 0.79, Aymerich 2024) and for clozapine (hazard ratio 0.74), on top of the benefit of treatment. Off by default: the lower mortality seen with injections in registers is largely a continuity-of-treatment effect that the adherence channel already credits, so counting it again would favour injections twice. Turn on for the observational view.",
  adherenceTitle: "Adherence",
  adherenceHint: "Adherence is the share of prescribed doses a person takes over the year. It enters the model in two places. Medicines are costed on doses taken (unless full-course costing is selected), and each product's health gain and protection against admission are scaled by it, so a product taken more reliably delivers more of its trial effect. One value applies to every product of a formulation; Cobenfy has its own.",
  adherenceRows: [
    ["oral", "Oral tablets", "All oral products. Ascher-Svanum 2008."],
    ["lai", "Long-acting injections", "All depot injections. Einarson 2012."],
    ["im", "Short-acting injections", "Acute-agitation products: given by staff, so every dose is taken."],
    ["cobenfy", "Cobenfy (KarXT)", "Set equal to oral adherence (owner decision 14 Sep 2026). The earlier 55% rested on trial discontinuation (ICER 2024; EMERGENT-4/5) and is kept as the low sensitivity bound."],
  ] as [("oral" | "lai" | "im" | "cobenfy"), string, string][],
  rw: "Scales every product's health gain; 1.0 = trial effect sizes as published.",
};

export const DASH = {
  cabinetIntro: "For each clinical use (starting and continuing treatment, maintenance injections, treatment-resistant illness, acute agitation), the product that gives the most health for the money at the current settings. Where nothing beats current treatment, current treatment stays. Each card names the product it was compared with. The selection updates live with the settings and prices.",
  cabinetAbout: "The most cost-effective medications to manage psychosis across the full treatment pathway, including treatment initiation, maintenance, treatment-resistance, and acute agitation.",
  cabinetLive: "Recommended selections are live: the most cost-effective drug per clinical use case is selected automatically from the included interventions, ranked by $/DALY.",
  rankedTitle: "All products ranked by cost-effectiveness",
  priceFlag: (weak: number, n: number) => `${weak} of ${n} products priced on a benchmark or proxy; indicative until country prices are confirmed`,
  notes: [
    ["Order", "products are ranked by net monetary benefit at the current threshold; current-treatment products are listed before SW-quadrant products. Use the filter above the table to see one indicated use at a time."],
    ["Compared with", "each product is measured against the current treatment for its own indicated use, named on its cabinet card above (or no treatment in that mode); the filter above the table shows one use with its comparator. An acute-agitation injection is never compared with a maintenance product."],
    ["Incremental CE", "the extra cost per extra healthy year gained compared with the current treatment for its own indicated use. The two bar cells show it against the threshold: the left cell fills up to the threshold (teal when the product is cost-effective, red when it is not) and the right cell (log scale) shows how far above the threshold it sits. Dominant, dominated and SW-quadrant products have no incremental ratio and are labelled instead."],
    ["Dominant (cost-saving)", "more health for less money than current treatment: the best outcome."],
    ["SW quadrant", "costs less but delivers less; informational only, never recommended automatically."],
    ["Dominated", "another product gives more health for less money."],
    ["Current treatment", "the current standard of care for that use."],
    ["Nat. EML", "✓ = on the national essential medicines list."],
    ["DALY", "disability-adjusted life year; equivalent to one lost year of healthy life."],
  ] as [string, string][],
};

export const SCEN = {
  title: "Scenario: Cost-Effective Price",
  ejpIntro: "EJP = the price at which the product is cost-effective against its comparator at the live threshold; it changes with country, comparator, threshold and currency.",
  riskHint: "Blank = the country default. Raise it for post-discharge or high-risk groups. Changes only the price calculations on this page.",
  riskTitle: "One-year readmission after discharge runs 24 to 50% internationally. The value scales only the inpatient term in the cost-effective price and head-to-head calculations on this page; the dashboard is unchanged.",
  naNote: "No break-even = no unit price makes the product cost-effective against its own use category's current treatment: either it delivers no more health than that comparator (dominated or SW-quadrant products), or even free its staffing, inpatient and side-effect costs exceed what the threshold justifies. Each row is compared with its own use category's current treatment (or no treatment), shown in the Compared with column; an acute-agitation injection is never measured against a maintenance product.",
  notes: [
    ["Headroom", "the price could rise this far and stay cost-effective."],
    ["Needs a cut", "cost-effective only below today's price."],
    ["No break-even", "no price works: even free, the product's staffing, inpatient and side-effect costs exceed the justified spend, or it delivers no more health than its comparator."],
    ["Current treatment", "the current standard of care; no price question, so it is not listed."],
    ["SW quadrant", "costs less than current treatment but delivers fewer health gains; its price point is where the savings fully offset the health loss at the threshold."],
  ] as [string, string][],
  hhIntro: "Pick any two products below. The EJP table above generalizes this break-even to all products against their comparators.",
  hhFoot: "Break-even uses the current threshold, comparator and country settings.",
};

export const BIA = {
  title: "Medication budget impact",
  sub: "Medicine costs only (the procurement view); staff, inpatient and side-effect management costs are in the cost-effectiveness results. One-year treatment funnel from the CHAI demand estimate model.",
  howToRead: "Three columns. Today = people on treatment at today's diagnosis, initiation and retention rates. At coverage goal = the same funnel at the national coverage target. Funded = today's funnel scaled down to what the current medicine budget can pay for; it is shown only when a verified antipsychotic budget exists, and equals Today whenever that budget already covers the cost.",
  budgetNote: "Enter the national annual budget for procuring antipsychotics, in the currency currently displayed. It is used as entered and is not converted; the sourced default is converted automatically.",
  wastageNote: "Uplift on doses to allow for wastage and buffer stock.",
  costingNote: "Consumed doses = adherence-adjusted (default). Full course = the procurement ask if every person in care receives a complete year of medicine.",
  costBasisNote: "Medicine procurement costs only, or the full health-system cost per patient-year from the cost-effectiveness results.",
  mixBasisNote: "Default = the country's current product mix from the demand model (procurement shares by product within each use). CE-optimised = the dashboard cabinet winner takes each category at 100%. Per-category override in the mix tables below.",
  mixIntro: "Shares of each category's patient-years by product. Defaults = the country procurement mix in the demand model. Type a user % to override a product's share, add a product with the picker, or set a per-category basis. Effective shares must sum to 100%.",
  demandFoot: "Grey rows are reference values from the demand model; coverage = retained ÷ need; funding = rate × patient-years. The demand model's funding rate covers medicines at its own average price; the budget above prices each product in the mix, so the two differ.",
  keyParamsFoot: "A user value on the coverage rows rescales the demand funnel proportionally (budget impact only; the cost-effectiveness engine is untouched). Blank = the demand model's rate. Low and high are indicative bounds (±25% coverage, 10 to 20% wastage) for discussion with country teams.",
  formula: "Per product: unit price × annual units × adherence, uplifted by the wastage buffer, times the product's share of that category's patient-years, times patient-years. Source data: Sources → Demand & epidemiology.",
};

export const SENS = {
  noTornadoTitle: "Tornado plot not displayed",
  noTornadoBody: "The selected product's result against this comparator is a category (for example cost-saving, or cheaper but less effective) rather than a cost per DALY, so there is no number to vary. Choose another product or comparator to see the plot.",
  title: "Sensitivity analysis",
  sub: "Deterministic one-way sensitivity analysis to evaluate the impact of key assumptions and parameter values.",
  fixed: "Constants held fixed (not varied): cost-side adherence, drug SMD, average length of stay, admin overhead %, CPI factor. The CE threshold is deliberately excluded because it cancels out of a $/DALY ratio.",
};

/** Guide: plain language. Each row: what it is, source, where to change it (screen id + label). */
export interface GuideRow { topic: string; plain: string; source: string; where: { screen: string; label: string; src?: string } }
export const GUIDE_ROWS: GuideRow[] = [
  { topic: "Comparator", plain: "Every product is compared with the medicine the country mostly uses today for the same purpose (starting and continuing treatment, maintenance injections, treatment-resistant illness, calming acute agitation). That medicine is shown as “Current treatment”, named on each cabinet card of the CE Dashboard and in the group headers of the Products and Scenario tables. Choosing “No treatment” instead compares each product with leaving the person untreated, who still ends up in hospital sometimes.", source: "Country procurement data; country clinical teams", where: { screen: "setup", label: "Setup → Comparator" } },
  { topic: "Cost-effectiveness threshold", plain: "The most a health system is judged willing to pay for one extra healthy year of life (one DALY averted). The default uses estimates of what health systems actually pay for health gains in each country (Ochalek and colleagues, 2018). Other options: the country's income per person, another published estimate (Pichon-Riviere 2023), South Africa's own threshold, or a number typed in.", source: "Ochalek 2018; Pichon-Riviere 2023; Edoka & Stacey 2020; World Bank", where: { screen: "setup", label: "Setup → Analysis settings" } },
  { topic: "Medicine prices", plain: "Each price carries a label showing how reliable it is: T1 is the country's own procurement price, T2 an Indian export price, T3 a proxy from another focus country (an average, or one country's tender), T4 a global benchmark adjusted to the country. Where several sources exist for a product the highest tier is used by default, and an alternate can be picked on Sources → Medicine costs. Any price typed in on the Products page replaces the default everywhere.", source: "Country procurement records and tenders; India export data; global benchmarks (Sep 2026)", where: { screen: "sources", src: "medicine-costs", label: "Sources → Medicine costs" } },
  { topic: "Dosing schedule", plain: "Each product is costed on its licensed schedule: daily tablets, two-weekly or monthly depot injections, and 20 short-acting doses a year for acute agitation. Every injection is a clinic visit that also counts as monitoring, so a two-weekly depot (risperidone LAI, given as Risperdal Consta or its generics) carries twice the staff time of a monthly one. The interval is shown on the Products page.", source: "Product labels (FDA, SmPC); CHAI demand estimate model", where: { screen: "products", label: "Products" } },
  { topic: "How much medicine is taken", plain: "Not everyone takes every dose. The model assumes 60% of oral doses are taken, 85% of long-acting injections and all acute injections; Cobenfy is assumed to be taken like other oral medicines. Untaken doses are not paid for, and only taken doses produce benefit.", source: "Ascher-Svanum 2008; Einarson 2012; product trials", where: { screen: "setup", label: "Setup → Adherence" } },
  { topic: "How well each medicine works", plain: "Trial results measure how much symptoms improve on each medicine compared with a dummy pill. The model converts that improvement into healthy time regained, using a published conversion rule, and never credits more improvement than the gap between acute and stable schizophrenia.", source: "Huhn 2019 network meta-analysis; Andrews 2003; Global Burden of Disease", where: { screen: "sources", label: "Sources → Efficacy", src: "efficacy" } },
  { topic: "Side-effects", plain: "Every medicine causes some harm (weight gain, movement problems, sedation). The model subtracts a small amount of healthy time for the class of medicine and adds the yearly cost of managing those side-effects. Acute-agitation injections are costed per episode, so they carry no yearly side-effect management cost.", source: "Huhn 2019; Pillinger 2020; published quality-of-life studies", where: { screen: "sources", label: "Sources → Side-effects", src: "side-effects" } },
  { topic: "Staff time", plain: "Each visit uses minutes of nurse, doctor or psychiatrist time, priced from national salary scales. Injections are given at a visit that also counts as monitoring.", source: "National salary scales; country clinical pathways (Sep 2026)", where: { screen: "sources", label: "Sources → Staffing costs & Clinical protocols", src: "staffing" } },
  { topic: "Hospital admissions", plain: "Some people are admitted each year; the model counts the days in hospital and what a bed-day costs. People on treatment are admitted less often than people who are not (about 43% as often in trials), and taking more of the medicine gives more of that protection.", source: "Cochrane review (Ceraso 2020); country facility data", where: { screen: "sources", label: "Sources → Inpatient & effect chain", src: "inpatient" } },
  { topic: "Deaths", plain: "The main results include a survival benefit for people on any antipsychotic compared with no treatment, from large observational studies. Because it applies to every treated product it only matters when a product is compared with no treatment. An extra survival benefit reported for long-acting injections and for clozapine is switched off in the main results, because it largely reflects people staying on treatment, which the model already counts through adherence; it can be switched on to see the observational view.", source: "Correll 2022; Taipale 2020; Aymerich 2024", where: { screen: "setup", label: "Setup → Method assumptions" } },
  { topic: "Currency", plain: "Everything is calculated in US dollars. Choosing local currency converts every money figure once at one national exchange rate; health results do not change.", source: "National exchange rates (Sep 2026)", where: { screen: "setup", label: "Setup → Currency" } },
  { topic: "Budget impact", plain: "Takes the number of people expected to be on treatment (from the national demand estimate), the mix of medicines used, their prices, how much is actually taken and a wastage allowance, and adds it up to a one-year medicine budget. Staff and hospital costs are not included here.", source: "CHAI Demand Estimate Model (country funnels; v6.2 checked Sep 2026)", where: { screen: "bia", label: "Budget Impact" } },
  { topic: "Cost-effective price", plain: "The highest price at which a product would still be judged good value against its comparator, with everything else unchanged. Useful for price negotiations.", source: "—", where: { screen: "scen", label: "Scenario" } },
  { topic: "Sensitivity", plain: "Each key assumption is moved to a low and a high value, one at a time, to show which ones matter most for the result.", source: "—", where: { screen: "sens", label: "Sensitivity" } },
];

export const INTERPRET: [string, string][] = [
  ["Cost per DALY", "The yearly cost of a product for one person, divided by the healthy time it gains for that person. Lower is better. It is compared with the country's threshold: below the threshold is good value, below a third of it is very good value."],
  ["Current treatment", "The medicine used most today for that purpose. Other products are judged against it: by how much more (or less) they cost and how much more (or less) health they deliver."],
  ["Dominant (cost-saving)", "Cheaper and at least as effective as current treatment. Switching saves money without losing health."],
  ["SW quadrant", "Cheaper but less effective. The model reports it but never recommends it automatically, because it trades health for savings."],
  ["Dominated", "Costs more and delivers less than current treatment. Not worth buying at today's prices."],
  ["Drug cabinet", "For each clinical purpose, the single product that gives the most health for the money at the current settings. When nothing beats current treatment, current treatment stays."],
  ["Cost-effective price (EJP)", "The most that could be paid per unit for a product before it stops being good value. If it is above today's price there is headroom; if below, the price would need to fall. “No break-even” means even a free supply would not be good value, because of the staff, hospital and side-effect costs that come with it or because it delivers no more health than its comparator."],
  ["Budget headroom", "The gap between what the chosen medicines would cost for a year and the current medicine budget. Positive means the budget covers it."],
];

export const NOT_DONE = "The model looks at one year at a time, so long-term gains such as fewer relapses over a lifetime are not counted in the main results. A survival benefit of treatment from observational studies is included and can be switched off; the extra survival benefit reported for injections and clozapine is off by default. It costs medicines, staff time, hospital stays and side-effect care from the health system's point of view; family costs and lost work are not included. Prices, admission rates and bed-day costs vary between facilities, and several default prices are benchmarks rather than local tenders, so results should be checked against local figures before procurement decisions.";
