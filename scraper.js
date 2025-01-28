const puppeteer = require("puppeteer");
const fs = require("fs");

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  const url = "https://www.oslo.kommune.no/barnehage/ledige-barnehageplasser/#gref"; // Replace with the target URL
  await page.goto(url);

  const results = await page.evaluate(() => {
    const container = document.querySelector(".ods-content");
    if (!container) return { data: [], errors: [] };

    const data = [];
    const errors = [];
    const regions = container.querySelectorAll("h3");

    const monthMapping = {
      januar: "January",
      februar: "February",
      mars: "March",
      april: "April",
      mai: "May",
      juni: "June",
      juli: "July",
      august: "August",
      september: "September",
      oktober: "October",
      november: "November",
      desember: "December",
    };

    regions.forEach((region) => {
      const regionMatch = region.textContent.match(/Bydel\s([ÆØÅæøåA-Za-zäöüÄÖÜ.\s-]+?)\s*\(oppdatert\s(\d{1,2}\.\s*\w+\s*\d{4})\)/i);
      const regionName = regionMatch ? regionMatch[1].trim() : "Unknown Region";
      const lastUpdated = regionMatch
        ? regionMatch[2]
            .replace(/\.\s*/, ".") // Handle inconsistent spacing in dates
            .replace(/(\w+)\s+/, (m, p1) => `${monthMapping[p1.toLowerCase()] || p1} `) // Map Norwegian months
        : "Unknown Date";

      if (!regionMatch) {
        errors.push({
          type: "RegionError",
          message: `Failed to parse region name or update date`,
          content: region.textContent,
        });
        return;
      }

      let sibling = region.nextElementSibling;
      while (sibling && sibling.tagName !== "H3") {
        if (sibling.tagName === "UL") {
          const listItems = sibling.querySelectorAll("li");

          listItems.forEach((item) => {
            const link = item.querySelector("a");
            const kindergartenName = link ? link.textContent.trim().replace(/:$/, "") : "Unknown Kindergarten";
            const detailsText = item.textContent.replace(`${kindergartenName}:`, "").trim();

            if (!link) {
              errors.push({ type: "KindergartenError", message: `Missing kindergarten name or link`, region: regionName });
              return;
            }

            const matches = [];
            const spotRegex = /(\d+)\s*(plass(?:er)?|småbarnsplass(?:er)?|småbarnplass(?:er)?|storebarnsplass(?:er)?|storbarnsplass(?:er)?|storebarnplass(?:er)?|ledige\s+plasser|ledig\s+plass|plass)/gi;
            const dateRegex = /ledig\s+fra\s+((\w+)(\d{4})|\d{1,2}\.\d{1,2}\.\d{4}|januar|februar|mars|april|mai|juni|juli|august|september|oktober|november|desember|nå|d\.d)/gi;
            const ageGroupRegex = /\b(alder(?:en)?\s+)?(0-3|3-6|2-6|under\s3|over\s3|2\s+-\s+6)\s+år\b/gi;

            let match;
            while ((match = spotRegex.exec(detailsText))) {
              const count = match[1] ? parseInt(match[1], 10) : 1; // Default to 1 if "ledig plass" is matched
              let type = "unknown";

              let ageGroupMatch;
              if ((ageGroupMatch = ageGroupRegex.exec(detailsText))) {
                const ageGroup = ageGroupMatch[2].toLowerCase().replace(/\s+/g, "");
                if (ageGroup === "3-6" || ageGroup === "over3") {
                  type = "over 3 years";
                } else if (ageGroup === "0-3" || ageGroup === "under3") {
                  type = "under 3 years";
                } else if (ageGroup === "2-6" || ageGroup === "2-6") {
                  type = "2-6 years";
                }
              } else {
                type = match[2]
                  ? match[2].toLowerCase().includes("storebarns") || match[2].includes("storbarns") || match[2].includes("storebarn")
                    ? "over 3 years"
                    : match[2].toLowerCase().includes("småbarns") || match[2].includes("småbarn")
                    ? "under 3 years"
                    : "unknown"
                  : "unknown";
              }

              let date = "now"; // Default to "now" if no date is specified
              let dateMatch;
              while ((dateMatch = dateRegex.exec(detailsText))) {
                const matchedDate = dateMatch[1].toLowerCase();
                if (monthMapping[matchedDate]) {
                  date = `${monthMapping[matchedDate]} 2025`; // Default year if not specified
                } else if (dateMatch[2] && dateMatch[3]) {
                  date = `${monthMapping[dateMatch[2].toLowerCase()]} ${dateMatch[3]}`;
                } else {
                  date = matchedDate;
                }
              }

              matches.push({
                count,
                type,
                date,
              });
            }

            if (matches.length === 0) {
              errors.push({
                type: "NoMatchError",
                message: `No matches found`,
                kindergarten: kindergartenName,
                region: regionName,
                lastUpdated,
                details: detailsText,
              });
            } else {
              matches.forEach((entry) => {
                if (entry.type === "unknown" || !entry.date) {
                  errors.push({
                    type: "FieldError",
                    message: `Incomplete or unknown field value`,
                    kindergarten: kindergartenName,
                    region: regionName,
                    lastUpdated,
                    field: entry,
                  });
                }

                data.push({
                  region: regionName,
                  lastUpdated,
                  kindergarten: kindergartenName,
                  spots: entry.count,
                  ageGroup: entry.type,
                  availabilityDate: entry.date,
                });
              });
            }
          });
        }
        sibling = sibling.nextElementSibling;
      }
    });

    return { data, errors };
  });

  // Write results to `data.json`
  fs.writeFileSync("data.json", JSON.stringify(results.data, null, 2));

  // Write errors to `errors.json`
  fs.writeFileSync("errors.json", JSON.stringify(results.errors, null, 2));

  console.log("Results saved to data.json and errors saved to errors.json");
  await browser.close();
})();
