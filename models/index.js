// models/index.js
const mongoose = require('mongoose');

const SpotHistorySchema = new mongoose.Schema({
  region: String,
  discoveredAt: { type: Date, required: true },
  lastSeenAt: { type: Date, required: true },
  spots: Number,
  ageGroup: String,
  availabilityDate: String,
  status: { 
    type: String, 
    enum: ["available", "taken"],
    required: true 
  },
  spotId: { 
    type: String, 
    required: true 
  }
});

const AddressSchema = new mongoose.Schema({
  adresselinje: String,
  postnr: String,
  poststed: String
});

const KindergartenSchema = new mongoose.Schema({
  // Basic info (from first API)
  orgnr: { type: String, unique: true },
  navn: { type: String, required: true },
  koordinatLatLng: {
    type: [Number],
    index: '2dsphere' // Define the index here only
  },
  fylkesnummer: String,
  kommunenummer: String,
  
  // Additional info (from second API)
  type: String,
  alder: String,
  eierform: String,
  erPrivatBarnehage: Boolean,
  besoksAdresse: AddressSchema,
  malform: {
    malformType: String,
    malformNavn: String
  },
  apningstidFra: String,
  apningstidTil: String,
  kostpenger: Number,
  pedagogiskProfil: [String], // Changed to array of strings
  
  // Statistics
  antallBarn: Number,
  antallBarnPerAnsatt: Number,
  antallBarnPerBarnehagelaerer: Number,
  lekeOgOppholdsarealPerBarn: Number,
  totalAntallKvadratmeter: Number,
  
  // Staff percentages
  andelAnsatteBarnehagelarer: Number,
  andelAnsatteMedBarneOgUngdomsarbeiderfag: Number,
  andelAnsatteTilsvarendeBarnehagelaerer: Number,
  andelAnsatteMedAnnenHoyereUtdanning: Number,
  andelAnsatteMedAnnenPedagogiskUtdanning: Number,
  andelAnsatteMedAnnenFagarbeiderutdanning: Number,
  andelAnsatteMedAnnenBakgrunn: Number,
  
  // Parent survey results
  foreldreundersokelseResultater: {
    uteOgInneMiljo: Number,
    barnetsUtvikling: Number,
    barnetsTrivsel: Number,
    informasjon: Number,
    tilfredshet: Number,
    antallInviterte: Number,
    antallBesvarte: Number,
    svarprosent: Number,
    argang: String
  },
  
  // Spot history
  spotHistory: [SpotHistorySchema]
});


module.exports = mongoose.model("Kindergarten", KindergartenSchema);