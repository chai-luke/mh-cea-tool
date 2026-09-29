# Antipsychotic Medication Cost-Effectiveness and Budget Tool

A browser-based tool that ranks antipsychotic medicines for psychosis care by value for money and estimates the medicine budget needed to reach a coverage goal. It covers Ethiopia, Nigeria, Rwanda and South Africa, and any user can replace the inputs with their own country's data.

**Status: public version, validation release September 2026.** The model and its inputs were reviewed with country teams in September 2026 workshops. Results depend strongly on medicine prices, so enter local prices where you have them.

**Open the tool:** https://medcetool.com (also served at https://chai-luke.github.io/mh-cea-tool/). An offline copy that runs from a single file is at https://medcetool.com/mh-cea-tool-offline.html: save it and open it in any modern browser, no installation or internet connection needed.

## Who built it

The Clinton Health Access Initiative (CHAI) Mental Health team built the tool with ministries of health and clinical partners in the four focus countries, with funding from Wellcome. Contact: Clinton Health Access Initiative, Mental Health team.

## What it does

For each medicine and formulation (24 products: oral, long-acting injectable and short-acting injectable antipsychotics), the tool models one year of treatment from the health-sector perspective:

- **Costs:** medicine, health-worker time by cadre and visit type, hospital admissions, side-effect management and programme administration.
- **Health effects:** disability-adjusted life years (DALYs) averted, from trial efficacy, real-world adherence by formulation, admission risk on treatment, side-effect disability and a survival benefit of treatment.
- **Results:** a cost-effectiveness ranking against the current treatment for each clinical use, a "drug cabinet" of the best-value product per use, the price at which each product becomes cost-effective, sensitivity analysis, and a budget impact for the medicine cabinet.

The Guide page inside the tool explains the method in plain language. Full model documentation will be published in [`docs/`](docs/).

## How to use it

1. **Setup:** choose the country, the comparator (current treatment or no treatment), the cost-effectiveness threshold and the currency.
2. **Products:** include or exclude products, limit to the national essential medicines list, and type any locally known prices.
3. **Results:** read the CE Dashboard, Budget Impact, Scenario (break-even prices) and Sensitivity pages.

Everything runs in your browser. Nothing you type is sent anywhere; settings and edits are saved in your browser only.

## How to enter your own data

Every input the model uses is listed on the **Sources** pages with its source and reliability tier (T1 in-country procurement, T2 India export price, T3 another focus country's price, T4 global benchmark).

- **Edit a value:** type over any blue value. Edited cells get a teal ring and a restore button; results update everywhere at once.
- **Share or keep your edits:** on the Sources page, *Export data pack* saves your edits as a small JSON file. *Import data pack* loads one on another computer. A ministry team can keep its own data pack and load it into the public tool whenever it needs its full country view.

## Run it locally

Requires Node.js 20 or later.

```bash
npm ci
npm run dev          # http://localhost:5173
npm test             # data and engine checks
npm run build        # dist/  (the site deployed to GitHub Pages)
npm run build:single # dist-single/index.html (the offline single file)
```

The engine is in `src/engine/` (TypeScript, no dependencies), the interface in `src/app/`, and the input data in `data/public/`. The engine was checked value by value against the reference spreadsheet implementation of the model for all four countries before release.

## How to cite

Clinton Health Access Initiative (2026). *Antipsychotic Medication Cost-Effectiveness and Budget Tool*, validation version, September 2026. https://github.com/chai-luke/mh-cea-tool

Citation metadata is in [`CITATION.cff`](CITATION.cff); GitHub shows a "Cite this repository" button from it.

## Licence

- **Code** (everything outside `data/` and `docs/`): MIT licence, see [`LICENSE`](LICENSE).
- **Data and documentation** (`data/`, `docs/`, the Guide text): Creative Commons Attribution 4.0 International, see [`LICENSE-DATA.md`](LICENSE-DATA.md). Values taken from third-party publications remain subject to their publishers' terms; each value's source is shown on the Sources pages.

## Custom domain

The site is published by the GitHub Actions workflow in `.github/workflows/pages.yml` on every push to `main`. The custom domain is set in the repository's Pages settings. `public/CNAME` holds the same domain for reference.
