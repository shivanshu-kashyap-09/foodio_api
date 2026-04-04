const config = require('./config');
const swaggerAutogen = require("swagger-autogen")();

const doc = {
 info: {
    title: 'FOODIO API',
    description: 'FOODIO API Swagger documentation for the food delivery platform.',
    version: config.app.version,
    contact: {
      name: 'FOODIO API Team',
      email: 'support@foodio.example',
    },
  },
  servers: [
    {
      url: config.app.url || 'http://localhost:3000',
      description: 'Primary server',
    },
  ],
};

const outputFile = "./swagger-output.json";
const endpointsFiles = ["../../index.js"]; // your main file

swaggerAutogen(outputFile, endpointsFiles, doc);

