// db/kindergartenRepository.js
const Kindergarten = require('../models');
const stringSimilarity = require("string-similarity");
const crypto = require('crypto');

/**
 * Creates a unique identifier for a spot based on its characteristics
 */
function createSpotId(kindergartenName, ageGroup, availabilityDate) {
  const str = `${kindergartenName}-${ageGroup}-${availabilityDate}`;
  return crypto.createHash('md5').update(str).digest('hex');
}

/**
 * Updates availability records for a set of scraped entries.
 * Maintains historical records of spot availability.
 */
async function updateAvailabilityForEntries(entries) {
  const allKindergartens = await Kindergarten.find({});
  const dbNames = allKindergartens.map(kg => kg.navn);
  const mappingErrors = [];
  const now = new Date();

  // Keep track of which spots we've seen in this scrape
  const seenSpots = new Set();

  console.log("=== Processing Available Spots ===");
  
  for (const entry of entries) {
    // Use fuzzy matching to find the best candidate
    const match = stringSimilarity.findBestMatch(entry.kindergarten, dbNames);
    if (match.bestMatch.rating < 0.7) {
      const errorMsg = `Fuzzy match error: Could not confidently match "${entry.kindergarten}". Best match: "${match.bestMatch.target}" with rating ${match.bestMatch.rating}`;
      console.error(errorMsg);
      mappingErrors.push(errorMsg);
      continue;
    }

    // Find the corresponding kindergarten document
    const kindergarten = allKindergartens.find(kg => kg.navn === match.bestMatch.target);
    if (!kindergarten) {
      const errorMsg = `No matching kindergarten found for "${entry.kindergarten}"`;
      console.error(errorMsg);
      mappingErrors.push(errorMsg);
      continue;
    }

    // Generate a unique ID for this spot listing
    const spotId = createSpotId(kindergarten.navn, entry.ageGroup, entry.availabilityDate);
    seenSpots.add(`${kindergarten.navn}-${spotId}`);

    // Look for existing spot history entry
    const existingSpotIndex = kindergarten.spotHistory.findIndex(
      spot => spot.spotId === spotId && spot.status === 'available'
    );

    if (existingSpotIndex === -1) {
      // This is a new spot - add it to history
      kindergarten.spotHistory.push({
        region: entry.region,
        discoveredAt: now,
        lastSeenAt: now,
        spots: entry.spots,
        ageGroup: entry.ageGroup,
        availabilityDate: entry.availabilityDate,
        status: "available",
        spotId: spotId
      });
      console.log(`New spot discovered at "${kindergarten.navn}": ${entry.spots} spot(s) for ${entry.ageGroup}`);
    } else {
      // Update last seen time for existing spot
      kindergarten.spotHistory[existingSpotIndex].lastSeenAt = now;
      console.log(`Updated existing spot at "${kindergarten.navn}": ${entry.spots} spot(s) for ${entry.ageGroup}`);
    }

    await kindergarten.save();
  }

  // Mark spots as taken if they weren't seen in this scrape
  console.log("\n=== Processing Disappeared Spots ===");
  
  for (const kindergarten of allKindergartens) {
    let updated = false;
    
    for (const spot of kindergarten.spotHistory) {
      if (spot.status === 'available' && 
          !seenSpots.has(`${kindergarten.navn}-${spot.spotId}`)) {
        spot.status = 'taken';
        spot.lastSeenAt = now;
        updated = true;
        console.log(`Marked spot as taken at "${kindergarten.navn}": ${spot.spots} spot(s) for ${spot.ageGroup}`);
      }
    }
    
    if (updated) {
      await kindergarten.save();
    }
  }

  return mappingErrors;
}

module.exports = {
  updateAvailabilityForEntries
};