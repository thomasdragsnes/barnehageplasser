// scrapers/scrapeAvailability.js
const puppeteer = require("puppeteer");

async function scrapeAvailability() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  const url = "https://www.oslo.kommune.no/barnehage/ledige-barnehageplasser/#gref";
  await page.goto(url);

  const results = await page.evaluate(() => {
    // Month mapping for later conversion
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

    // Function to normalize the "last updated" date string
    function normalizeDate(dateStr) {
      // Replace a dot after the day with a space
      dateStr = dateStr.replace(/(\d+)\.\s*(\w+)\s+(\d+)/, "$1 $2 $3");
      // Split into parts; if we have a Norwegian month, convert it
      const parts = dateStr.split(" ");
      if (parts.length === 3) {
        const day = parts[0];
        const monthNor = parts[1];
        const year = parts[2];
        const monthEn = monthMapping[monthNor.toLowerCase()] || monthNor;
        return `${day} ${monthEn} ${year}`;
      }
      return dateStr;
    }

    // Function to determine age group from text
    function determineAgeGroup(text) {
      // Convert text to lowercase for consistent matching
      const lowerText = text.toLowerCase();
      
      // Define regex for various age group formats
      const ageGroupRegex = /\b(?:barn\s+)?(?:i\s+)?(?:alder(?:en)?\s+)?(0-3|3-6|2-6|2\s*-\s*6|under\s*3|over\s*3)\s*år\b|(?:småbarns?|storebarns?|stobarns?)(?:plass(?:er)?)?/gi;
      
      // First check for explicit age ranges
      const ageMatches = [...lowerText.matchAll(ageGroupRegex)];
      for (const match of ageMatches) {
        const ageGroup = match[1] || match[0];
        
        // Handle various age group formats
        if (ageGroup.includes('0-3') || ageGroup.includes('under 3') || 
            ageGroup.includes('småbarns') || ageGroup.includes('småbarn')) {
          return 'under 3 years';
        }
        if (ageGroup.includes('3-6') || ageGroup.includes('over 3') || 
            ageGroup.includes('storebarns') || ageGroup.includes('stobarns')) {
          return 'over 3 years';
        }
        if (ageGroup.includes('2-6') || ageGroup.includes('2 - 6')) {
          return '2-6 years';
        }
      }

      // Fallback checks for specific terms
      if (lowerText.includes('storebarnsplass') || lowerText.includes('storbarnsplass')) {
        return 'over 3 years';
      }
      if (lowerText.includes('småbarnsplass')) {
        return 'under 3 years';
      }

      return 'unknown';
    }

    const container = document.querySelector(".ods-content");
    if (!container) return { data: [], errors: [] };

    const data = [];
    const errors = [];

    // Use a regex that expects a header like "Bydel <RegionName> (oppdatert <Date>)"
    const regionRegex = /^Bydel\s+(.+?)\s+\(oppdatert\s+(.+?)\)$/i;
    const regions = container.querySelectorAll("h3");

    regions.forEach((regionElem) => {
      const headerText = regionElem.textContent.trim();
      const matchHeader = headerText.match(regionRegex);
      let regionName = "Unknown Region";
      let lastUpdated = "Unknown Date";
      if (matchHeader) {
        regionName = matchHeader[1].trim();
        lastUpdated = normalizeDate(matchHeader[2].trim());
      } else {
        errors.push({
          type: "RegionError",
          message: "Failed to parse region name or update date",
          content: headerText,
        });
      }

      let sibling = regionElem.nextElementSibling;
      while (sibling && sibling.tagName !== "H3") {
        if (sibling.tagName === "UL") {
          const listItems = sibling.querySelectorAll("li");
          listItems.forEach((item) => {
            const link = item.querySelector("a");
            const kindergartenName = link ? link.textContent.trim().replace(/:$/, "") : "Unknown Kindergarten";
            const detailsText = item.textContent.replace(`${kindergartenName}:`, "").trim();

            // Skip Hoff anomaly
            if (detailsText.indexOf("¨") !== -1) {
              return;
            }

            const matches = [];
            const spotRegex = /(\d+)\s*(plass(?:er)?|småbarnsplass(?:er)?|småbarnplass(?:er)?|storebarnsplass(?:er)?|storbarnsplass(?:er)?|storebarnplass(?:er)?|ledig(?:e)?\s+plasser|ledig(?:e)?\s+plass|plass)/gi;
            const dateRegex = /ledig\s+fra\s+((\w+)(\d{4})|\d{1,2}\.\d{1,2}\.\d{4}|januar|februar|mars|april|mai|juni|juli|august|september|oktober|november|desember|nå|d\.d)|fra\s+(\d{1,2}\.\d{1,2}\.\d{4})|fra\s+(\w+)/gi;

            let match;
            while ((match = spotRegex.exec(detailsText))) {
              const count = match[1] ? parseInt(match[1], 10) : 1;
              const ageGroup = determineAgeGroup(detailsText);
              
              let dateVal = 'now';
              let dateMatch;
              while ((dateMatch = dateRegex.exec(detailsText))) {
                const matchedDate = (dateMatch[1] || dateMatch[4] || dateMatch[5] || '').toLowerCase();
                if (monthMapping[matchedDate]) {
                  dateVal = `${monthMapping[matchedDate]} 2025`;
                } else if (matchedDate.includes('.')) {
                  // Handle dot-formatted dates
                  dateVal = matchedDate;
                } else if (matchedDate === 'nå' || matchedDate === 'd.d') {
                  dateVal = 'now';
                } else {
                  dateVal = matchedDate;
                }
              }

              matches.push({
                count,
                type: ageGroup,
                date: dateVal,
              });
            }

            if (matches.length === 0) {
              errors.push({
                type: "NoMatchError",
                message: "No matches found",
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
                    message: "Incomplete or unknown field value",
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

  await browser.close();
  return results;
}

module.exports = { scrapeAvailability };