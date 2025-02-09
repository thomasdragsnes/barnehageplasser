// scrapers/initKindergartens.js
const fetch = require("node-fetch");

async function fetchKindergartenList() {
  const apiUrl = "https://www.barnehagefakta.no/api/Location/kommune/0301";
  const response = await fetch(apiUrl);
  const kindergartens = await response.json();
  return kindergartens;
}

async function fetchKindergartenDetails(orgnr) {
  const apiUrl = `https://www.barnehagefakta.no/api/Barnehage/orgnr/${orgnr}`;
  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`API returned ${response.status} for ${orgnr}`);
    }
    const details = await response.json();
    return details;
  } catch (error) {
    console.error(`Error fetching details for ${orgnr}:`, error.message);
    return null;
  }
}

function mapKindergartenData(baseData, detailsData) {
  if (!detailsData) {
    return {
      orgnr: baseData.orgnr,
      navn: baseData.navn,
      koordinatLatLng: baseData.koordinatLatLng,
      fylkesnummer: baseData.fylkesnummer,
      kommunenummer: baseData.kommunenummer,
      spotHistory: []
    };
  }

  // Handle pedagogiskProfil which can be null, string, or array
  let pedagogiskProfil = [];
  if (detailsData.pedagogiskProfil) {
    pedagogiskProfil = Array.isArray(detailsData.pedagogiskProfil) 
      ? detailsData.pedagogiskProfil 
      : [detailsData.pedagogiskProfil];
  }

  return {
    // Basic info
    orgnr: baseData.orgnr,
    navn: baseData.navn,
    koordinatLatLng: detailsData.koordinatLatLng,
    fylkesnummer: detailsData.fylke.fylkesnummer,
    kommunenummer: detailsData.kommune.kommunenummer,
    
    // Additional info
    type: detailsData.type,
    alder: detailsData.alder,
    eierform: detailsData.eierform,
    erPrivatBarnehage: detailsData.erPrivatBarnehage,
    besoksAdresse: detailsData.kontaktinformasjon?.besoksAdresse,
    malform: detailsData.malform,
    apningstidFra: detailsData.apningstidFra,
    apningstidTil: detailsData.apningstidTil,
    kostpenger: detailsData.kostpenger,
    pedagogiskProfil, // Using the processed array
    
    // Statistics
    antallBarn: detailsData.indikatorDataBarnehage?.antallBarn,
    antallBarnPerAnsatt: detailsData.indikatorDataBarnehage?.antallBarnPerAnsatt,
    antallBarnPerBarnehagelaerer: detailsData.indikatorDataBarnehage?.antallBarnPerBarnehagelaerer,
    lekeOgOppholdsarealPerBarn: detailsData.indikatorDataBarnehage?.lekeOgOppholdsarealPerBarn,
    totalAntallKvadratmeter: detailsData.totalAntallKvadratmeter,
    
    // Staff percentages
    andelAnsatteBarnehagelarer: detailsData.indikatorDataBarnehage?.andelAnsatteBarnehagelarer,
    andelAnsatteMedBarneOgUngdomsarbeiderfag: detailsData.indikatorDataBarnehage?.andelAnsatteMedBarneOgUngdomsarbeiderfag,
    andelAnsatteTilsvarendeBarnehagelaerer: detailsData.indikatorDataBarnehage?.andelAnsatteTilsvarendeBarnehagelaerer,
    andelAnsatteMedAnnenHoyereUtdanning: detailsData.indikatorDataBarnehage?.andelAnsatteMedAnnenHoyereUtdanning,
    andelAnsatteMedAnnenPedagogiskUtdanning: detailsData.indikatorDataBarnehage?.andelAnsatteMedAnnenPedagogiskUtdanning,
    andelAnsatteMedAnnenFagarbeiderutdanning: detailsData.indikatorDataBarnehage?.andelAnsatteMedAnnenFagarbeiderutdanning,
    andelAnsatteMedAnnenBakgrunn: detailsData.indikatorDataBarnehage?.andelAnsatteMedAnnenBakgrunn,
    
    // Parent survey results
    foreldreundersokelseResultater: {
      uteOgInneMiljo: detailsData.indikatorDataBarnehage?.foreldreundersokelsenUteOgInneMiljo,
      barnetsUtvikling: detailsData.indikatorDataBarnehage?.foreldreundersokelsenBarnetsUtvikling,
      barnetsTrivsel: detailsData.indikatorDataBarnehage?.foreldreundersokelsenBarnetsTrivsel,
      informasjon: detailsData.indikatorDataBarnehage?.foreldreundersokelsenInformasjon,
      tilfredshet: detailsData.indikatorDataBarnehage?.foreldreundersokelsenTilfredshet,
      antallInviterte: detailsData.indikatorDataBarnehage?.foreldreundersokelsenAntallInviterte,
      antallBesvarte: detailsData.indikatorDataBarnehage?.foreldreundersokelsenAntallBesvarte,
      svarprosent: detailsData.indikatorDataBarnehage?.foreldreundersokelsenSvarprosent,
      argang: detailsData.indikatorDataBarnehage?.foreldreundersokelsenArgang
    },
    
    // Initialize empty spot history
    spotHistory: []
  };
}

async function initializeKindergartens() {
  try {
    // Fetch the list of kindergartens
    const kindergartensList = await fetchKindergartenList();
    console.log(`Fetched ${kindergartensList.length} kindergartens from initial API`);

    // Fetch details for each kindergarten
    const processedKindergartens = [];
    for (const kg of kindergartensList) {
      console.log(`Fetching details for ${kg.navn} (${kg.orgnr})`);
      const details = await fetchKindergartenDetails(kg.orgnr);
      const mappedData = mapKindergartenData(kg, details);
      processedKindergartens.push(mappedData);
      
      // Add a small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return processedKindergartens;
  } catch (error) {
    console.error('Error in initialization:', error);
    throw error;
  }
}

module.exports = { initializeKindergartens };