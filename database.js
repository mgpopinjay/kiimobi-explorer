// Code relating to interacting with MongoDB

var _ = require('lodash');
var util = require('util');
var assert = require('assert');
var client = require('mongodb').MongoClient;
var emitter = new (require('events').EventEmitter)();

// Heroku passes DB config via environment vars
var MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pev-explorer';
var DB = {};

// Automatically connect when this module is required
console.log("Connecting to " + MONGODB_URI);

client.connect(MONGODB_URI, function(err, db) {
    assert.equal(null, err);
    console.log("Connected to " + MONGODB_URI);

    // Configure our database and collections
    DB = db;
    DB.trips = DB.collection('trips');
    DB.trips.ensureIndex({ 'rsrv_no': 1}, { unique: true });

    // Tell anyone listening we're connected.
    emitter.emit('connect');
})

// Generate a JSON blog in the format Hubway Explorer wants it
function genTripMap(trips) {

    var tripMap = { /*
        station_in: {
            station_out_1: n trips,
            station_out_2: m trips,
            ...: ...,
            name: station_name_in,
            lat: lat_in,
            lng: lng_in
        }
    */};

    trips.forEach(function (trip) {
        let station_in = trip.station_in;
        let station_out = trip.station_out;

        // Station details for easy access from frontend.
        if (!tripMap[station_in]) {
            tripMap[station_in] = {
                name: trip.station_name_in,
                lat: trip.lat_in,
                lng: trip.lng_in
            }
        }

        // Increment trip count between stations,
        // And make sure to init to 0 correctly.
        var tripsFromInToOut = tripMap[station_in][station_out] || 0;
        tripMap[station_in][station_out] = tripsFromInToOut + 1;
    });

    return tripMap;
}

// Queries

function allTrips(callback) {
    DB.trips.find({}).toArray(function (err, trips) {
        assert.equal(null, err);
        callback(null, genTripMap(trips));
    });
}

function filteredTrips(reqQuery, callback) {

    // Loop through all the filters in the query (temp, age, etc)
    // and generate a mongo query we can add into the $match stage
    // of the Mongo aggregate pipeline.

    var $andArray = [];
    for (var p in queryParamToFilter) {
        if (reqQuery.hasOwnProperty(p)) {
            let mongoQuery = queryParamToFilter[p](reqQuery[p]);
            $andArray.push(mongoQuery);
        }
    }

    DB.trips.aggregate([{
        $project: {
            station_in: 1,
            station_out: 1,
            station_name_in: 1,
            lat_in: 1,
            lng_in: 1,
            time_rsrv: 1,
            day: { '$dayOfWeek': '$time_rsrv' },
            month: { '$month': '$time_rsrv' },
            hour: { '$hour': '$time_rsrv' },
            time_dep: 1,
            time_pln_arr: 1,
            duration: { $subtract: ['$time_pln_arr', '$time_dep'] },
            gender: 1,
            age_driver: 1,
            tempCelcius: 1,
            rainfall_mm: 1
        }
    }, {
        $match: { $and: $andArray }
    }]).toArray(function (err, trips) {
        assert.equal(err, null);
        console.log('Found '+trips.length+' trips with those filters.');
        console.log(' > for example:');
        console.log(trips[0]);
        callback(null, genTripMap(trips));
    });

}

// Filters

let queryParamToFilter = {
    starttime: queryForHour,
    days: queryForDay,
    months: queryForMonth,
    duration: queryForDuration,
    gender: queryForGender,
    age: queryForAge,
    precip: queryForRain,
    temp: queryForTemp
};

function queryForHour(queryVal) {
    // starttime=01:00:00,15:00:00
    var dateRegex = /(\d{2}):(\d{2}):(\d{2}),(\d{2}):(\d{2}):(\d{2})/;
    var m = queryVal.match(dateRegex);

    if (m == null)
        throw new Error('Invalid time format: ' + queryVal);

    let lowHour = parseInt(m[1], 10);
    let lowMinute = parseInt(m[2], 10);
    let highHour = parseInt(m[4], 10);
    let highMinute = parseInt(m[5], 10);

    return { 'hour': { $gte: lowHour, $lt: highHour }};
}

function queryForMonth(queryVal) {
    // months (queryVal) = 3,4,5,6,8,9,10,11
    var months = _.map(queryVal.split(','), function (m) { return parseInt(m, 10) + 1 });
    var orArray = _.map(months, function (m) { return { 'month': m } });

    return { $or: orArray };
}

function queryForDay(queryVal) {
    // days=1,3,4,5,6,7
    var days = _.map(queryVal.split(','), function (d) { return parseInt(d, 10) });
    var orArray = _.map(days, function (d) { return { 'day': d } });
    // orArray = [{day:1}, {day:3}, {day:7}]
    return { $or: orArray };
}

function queryForDuration(queryVal) {
    // duration=0,21600
    // duration is range in minutes with max 6 hours: 6 * 60min * 60sec
    let parts = queryVal.split(',');
    let lowDuration = parseInt(parts[0], 10);
    let highDuration = parseInt(parts[1], 10);
    return { 'duration': { $gte: lowDuration * 1000, $lte: highDuration * 1000 }};
}

function queryForGender(queryVal) {
    // gender=Female
    let genderRegex = (queryVal === 'Male' ? /^male/ : /^female/);
    return { gender: { $regex: genderRegex }};
}
function queryForAge(queryVal) {
    // age=17,71
    let parts = queryVal.split(',');
    let lowAge = parseInt(parts[0], 10);
    let highAge = parseInt(parts[1], 10);
    return { 'age_driver': { $gte: lowAge, $lte: highAge }};
}

function queryForRain(queryVal) {
    // precip=0 (or 1)
    let cmp = (queryVal === '0' ? { $eq: 0 } : { $gt: 0 });
    return { rainfall_mm: cmp};
}

function queryForTemp(queryVal) {
    // temp=17,71
    let parts = queryVal.split(',');
    let lowTemp = parseInt(parts[0], 10);
    let highTemp = parseInt(parts[1], 10);
    return { 'tempCelcius': { $gte: lowTemp, $lte: highTemp }};
}

// Importing from CSV

// Drop the trips collection. Used for:
// # node importCsv.js --reset
// To do a clean import.
function reset(cb) {
    DB.trips.remove(cb);
}

function insertTrips(trips, callback) {
    DB.trips.insertMany(trips, { ordered: false }, function(err, result) {
        assert.equal(err, null);
        console.log('Inserted '+result.result.n+' new trips');
        callback(null, result);
    });
}

// Public API

module.exports = {
    DB: DB,
    client: client,
    events: emitter,
    allTrips: allTrips,
    filteredTrips: filteredTrips,
    insertTrips: insertTrips,
    reset: reset
}
