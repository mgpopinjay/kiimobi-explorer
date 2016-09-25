// Import denso_anjo_cleaned.csv data into Mongo

var _ = require('lodash');
var assert = require('assert');
var csv = require('csv');
var fs = require('fs');
var database = require('../database');

database.events.on('connect', function () {

    console.log('Checking for --reset flag...');
    console.log(process.argv);
    if (process.argv.length > 2 && process.argv[2] === '--reset') {
        database.reset(function (err, removed) {
            assert.equal(null, err);
            console.log('Trips collection removed.');
            importTrips();
        });
        return;
    }

    importTrips();
});

function importTrips() {
    console.log('Importing trips from CSV...');

    parseCsv('../denso_anjo_cleaned.csv', function (err, rows) {
        assert.equal(null, err);

        // Validate data before inserting into Mongo:
        let requiredKeys = [
            'rsrv_no'
            ,'station_in'
            ,'station_name_in'
            ,'station_out'
            ,'station_name_out'
            ,'lat_in'
            ,'lng_in'
            ,'lat_out'
            ,'lng_out'
            ,'time_rsrv'
            ,'time_dep'
            ,'time_pln_arr'
            ,'time_in'
            ,'time_out'
        ];
        rows = _.reject(rows, function (row) {
            var rejected = _.some(requiredKeys, function (key) { return row[key] === '' });
            if (rejected) { console.log(row); }
            return rejected;
        });

        for (let i=0; i<rows.length; i++) {
            // Convert date fields to javascript Date (UTC) objects
            rows[i].time_rsrv = dateFromString(rows[i].time_rsrv);
            rows[i].time_dep = dateFromString(rows[i].time_dep);
            rows[i].time_pln_arr = dateFromString(rows[i].time_pln_arr);
            rows[i].time_in = dateFromString(rows[i].time_in);
            rows[i].time_out = dateFromString(rows[i].time_out);
            // Convert number fields to native integers
            rows[i].age_driver = parseInt(rows[i].age_driver, 10);
            rows[i].tempCelcius = parseInt(rows[i].tempCelcius, 10);
            rows[i].rainfall_mm = parseFloat(rows[i]['rainfall-mm'], 10);
        }

        // Safe to insert into DB
        database.insertTrips(rows, function (err, result) {
            assert.equal(null, err);
            console.log('Import complete!');
        });

    });
}

function parseCsv(path, cb) {
    console.log('Parsing '+path);

    var csvData = fs.readFileSync(path, 'utf8');
    var csvOpts = { columns: true };

    csv.parse(csvData, csvOpts, function (err, rows) {
        assert.equal(null, err);
        cb(null, rows);
    });
}

// Convert from CSV date string to a real javascript Date object in UTC time
// Example: "2016-05-31 18:00:00" -> 2016-05-31T18:00:00.000Z
function dateFromString(s) {
    // Pull out the datetime components by hand
    // so we can create a clean UTC date.
    var dateRegex = /(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/;
    var m = s.match(dateRegex);

    if (m == null)
        return null;

    /*
    s.match(dateRegex);
    [ '2016-02-07 16:00:00',
      '2016',
      '02',
      '07',
      '16',
      '00',
      '00',
      index: 0,
      input: '2016-02-07 16:00:00' ]
     */

    return new Date(Date.UTC(m[1], m[2]-1, m[3], m[4], m[5], m[6]));
}
