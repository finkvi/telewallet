var gcloud = require('google-cloud')({
  projectId: 'telewallet-165615',
  // Specify a path to a keyfile.
  keyFilename: 'telewallet-ec6cce7499e9.json'
});


const speechClient = gcloud.speech();

// // Imports the Google Cloud client library
// const Speech = require('@google-cloud/speech');

// // Your Google Cloud Platform project ID
// const projectId = 'YOUR_PROJECT_ID';

// // Instantiates a client
// const speechClient = Speech({
//   projectId: projectId
// });

// The name of the audio file to transcribe
const fileName = './voicepath/queue/audio.raw';

// The audio file's encoding, sample rate in hertz, and BCP-47 language code
const options = {
  encoding: 'LINEAR16',
  sampleRateHertz: 16000,
  languageCode: 'en-US'
};

// Detects speech in the audio file
speechClient.recognize(fileName, options)
  .then((results) => {
    const transcription = results[0];
    console.log(`Transcription: ${transcription}`);
  })
  .catch((err) => {
    console.error('ERROR:', err);
  });

// var backups = gcs.bucket('backups');
// backups.upload('db.zip', function(err, file) {
//   // file.createReadStream();
//   // file.getMetadata();
//   // ...
// });