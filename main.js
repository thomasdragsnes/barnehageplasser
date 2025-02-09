// main.js
require('dotenv').config();
const mongoose = require("mongoose");
const { scrapeAvailability } = require("./scrapers/scrapeAvailability");
const { initializeKindergartens } = require("./scrapers/initKindergartens");
const { updateAvailabilityForEntries } = require("./db/kindergartenRepository");
const Kindergarten = require("./models");

async function main() {
  // Connect to MongoDB first
  const MONGO_URI = process.env.MONGO_URI;
  try {
    await mongoose.connect(MONGO_URI);
    console.log("MongoDB Connected");

    const mode = process.argv[2]; // "init" or "scrape"
    
    if (mode === "init") {
      try {
        // Get the processed kindergarten data
        const kindergartensData = await initializeKindergartens();
        console.log(`Processing ${kindergartensData.length} kindergartens`);

        // Insert or update each kindergarten
        for (const kgData of kindergartensData) {
          await Kindergarten.findOneAndUpdate(
            { orgnr: kgData.orgnr },
            kgData,
            { upsert: true, new: true }
          );
          console.log(`Processed kindergarten: ${kgData.navn}`);
        }
        
        console.log("Initialization complete.");
      } catch (err) {
        console.error("Error during initialization:", err);
      }
    } else if (mode === "scrape") {
      try {
        const results = await scrapeAvailability();
        console.log("Scraped Data:", JSON.stringify(results.data, null, 2));
        console.log("Scraped Errors:", JSON.stringify(results.errors, null, 2));
        
        const mappingErrors = await updateAvailabilityForEntries(results.data);
        if (mappingErrors.length > 0) {
          console.error("Mapping errors occurred:", mappingErrors);
        }
        console.log("Scraping complete.");
      } catch (err) {
        console.error("Error during scraping:", err);
      }
    } else {
      console.log("Please specify mode: 'init' or 'scrape'");
    }
  } catch (err) {
    console.error("MongoDB Connection Error:", err);
  } finally {
    // Close the MongoDB connection
    await mongoose.connection.close();
    console.log("MongoDB connection closed.");
  }
}

// Run the main function
main().catch(console.error);