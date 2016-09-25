var _ = require('lodash');
var express = require('express');
var database = require('./database');

var app = express();
app.use(express.static('public'));

app.get('/', function (req, res) {
    res.sendFile('index.html', { root: __dirname });
});

app.get('/trips', function (req, res) {

    /*
    Optional Query Params:
    starttime=01:15:00,15:15:00
    months=3,4,5,6,8,9,10,11
    days=1,3,4,5,6,7
    duration=0,21600
    gender=Female
    age=17,71
    precip=0 (or 1)
    temp=29,90
    */

    if (_.isEmpty(req.query)) {

        database.allTrips(function (err, trips) {
            if (err) return res.send(500, err);
            res.send(trips);
        });

    } else {

        database.filteredTrips(req.query, function (err, trips) {
            if (err) return res.send(500, err);
            res.send(trips);
        });

    }

});

app.listen(process.env.PORT || 3000, function () {
  console.log('Server up and running...');
});
