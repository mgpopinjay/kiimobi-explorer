# PEV Data Explorer

Simple data visualizer for Denso data from the MIT Media Lab PEV team powered by Node+Express and MongoDB.

A Heroku compatible Procfile is bundled with the code. If you add a Mongo database via the Heroku console it should just work.

And a test server is running on Heroku at: http://pev-explorer.herokuapp.com

### Getting Started

First install dependencies: `npm install`

Trip data is stored in denso_anjo_cleaned.csv, but this needs to be imported into Mongo:

```
nmeyer$ cd tools; node importCsv.js
    Connecting to mongodb://localhost:27017/pev-explorer
    Connected to mongodb://localhost:27017/pev-explorer
    Importing trips from CSV
    Parsing ../denso_anjo_cleaned.csv
    Inserted 4053 new trips
    Import complete!
nmeyer$
```

Then start the server:

`node server.js`

And navigate to:

```
http://localhost:3000
http://localhost:3000/trips
```

### MongoDB

By default we look for a Mongo instance running locally, but you can set `MONGODB_URI` env var to override this behavior.

### Based on Hubway Trip Explorer

Originally forked from https://github.com/awoodruff/hubway-explorer
