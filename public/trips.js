const START_LAT = 34.9486365;
const START_LNG = 137.0933813;
const DEFAULT_ZOOM = 14;
const DEFAULT_STATION = "STN-00204";

$(function(){

	resize();
	$(window).resize(resize);

	var hoursFilter,
		durationFilter = [],
		ageFilter = [],
		tempFilter = [];

	var filterTimeout;

	$("#months p, #days p").addClass("selected");

	$(".text-filter").click(function(){
		$(this).siblings().removeClass("selected");
		$(this).addClass("selected");
		updateFilters();
	});

	$("#months p, #days p").click(function(){
		clearTimeout(filterTimeout);
		if ( $(this).hasClass("selected") ) $(this).removeClass("selected");
		else $(this).addClass("selected");
		filterTimeout = setTimeout(updateFilters,500);
	});

	$("#duration-slider").slider({
		min:0,
		max:21600,
		values:[0,21600],
		step:300,
		range: true
	}).on("slide", function() {
		var vals = $(this).slider("values");
		if ( vals[0] == 0 && vals[1] == 21600 ) {
			durationFilter = [];
			$(this).next().html(formatDuration(vals));
		} else {
			durationFilter = vals;
			$(this).next().html(formatDuration(vals))
		};
	}).on("slidestop", updateFilters);

	$("#duration-check").change(function(){
		updateFilters();
	});

	$("#age-slider").slider({
		min:17,
		max:80,
		values:[17,80],
		range: true
	}).on("slide",function(){
		var vals = $(this).slider("values");
		if ( vals[0] == 17 && vals[1] == 80 ){ ageFilter = []; $(this).next().html("0 to 80 years") }
		else { ageFilter = vals; $(this).next().html(vals[0] + " to " + vals[1] + ' years') };
	}).on("slidestop",updateFilters);

	$("#temp-slider").slider({
		min:0,
		max:30,
		values:[0,30],
		range: true
	}).on("slide",function(){
		var vals = $(this).slider("values");
		if ( vals[0] == 0 && vals[1] == 30 ){ tempFilter = []; $(this).next().html("0&deg;C to 30&deg;C"); }
		else { tempFilter = vals; $(this).next().html(vals[0] + "&deg;C to " + vals[1] + '&deg;C')};
	}).on("slidestop",updateFilters);

	$(".plus").click( function(){
		clearTimeout(filterTimeout);
		var next = $(this).next(),
			val;
		if ( next.hasClass("hour") ){
			val = parseInt( next.html() );
			if ( ++val > 12 ) val = 1;
			next.html(val);
		} else if ( next.hasClass("minute") ){
			val = parseInt( next.html() );
			val += 5;
			if ( val == 60 ) val = 0;
			val = val.toString();
			if ( val.length == 1 ) val = "0"+val;
			next.html(val);
		} else {
			if ( next.html() == "AM" ) next.html("PM");
			else next.html("AM");
		}
		filterTimeout = setTimeout(updateFilters, 500);
	});
	$(".minus").click( function(){
		clearTimeout(filterTimeout);
		var next = $(this).prev(),
			val;
		if ( next.hasClass("hour") ){
			val = parseInt( next.html() );
			if ( --val < 1 ) val = 12;
			next.html(val);
		} else if ( next.hasClass("minute") ){
			val = parseInt( next.html() );
			val -= 5;
			if ( val < 0 ) val = 55;
			val = val.toString();
			if ( val.length == 1 ) val = "0"+val;
			next.html(val);
		} else {
			if ( next.html() == "AM" ) next.html("PM");
			else next.html("AM");
		}
		filterTimeout = setTimeout(updateFilters,1000);
	});

	function formatDuration(vals)
	{
		var min = [ parseInt(vals[0]/3600), (vals[0] % 3600)/60 ],
			max = [ parseInt(vals[1]/3600), (vals[1] % 3600)/60 ];
		var minStr = ( !min[0] && !min[1] ) ? "0 min" : (min[0] ? min[0] + " hr"+(min[0]>1?"s":"") : "");
		minStr += ( !min[0] && min[1] ) ? min[1] + " min" : (min[1] ? " " + min[1] + " min" : "");
		var maxStr = max[0] ? max[0] + " hr" + (max[0]>1?"s":""): "";
		maxStr += ( !max[0] && max[1] ) ? max[1] + " min" : (max[1] ? " " + max[1] + " min" : "");
		return minStr + " to " + maxStr;
	}

	var map = L.map('map', {
		center: [START_LAT, START_LNG],
		zoom: DEFAULT_ZOOM
	});
	var TILESET_URL = 'https://api.mapbox.com/styles/v1/mapbox/dark-v9/tiles/256/{z}/{x}/{y}?access_token=pk.eyJ1Ijoibm1leWVybWl0IiwiYSI6ImNpc2o5MTMwZzAyODkydnB1ejk4Z2hyMmgifQ.G5cDqZNN5MYW97DrxYxYEA';
	var base = L.tileLayer(TILESET_URL); // The Map
	var mg = new L.LayerGroup(); // Station "Markers"
	var g = new L.LayerGroup(); // Trip Arcs
	var busStops = new L.LayerGroup();

	map.addLayer(base)
		.addLayer(g)
		.addLayer(mg);
		.addLayer(busStops);

	var originalData,
		trips,
		stations,
		markers = {},
		selected,
		total,
		p0,p1,p2,p3,p4,p5,p6,p7;

	console.log('Requesting bus stops');
	$.getJSON("bus-stops.json", function(data) {
		for (var i in data) {
			var stops = new L.CircleMarker( new L.LatLng(data[i].lat, data[i].lng), {
				opacity: 0,
				weight: 8,
				fillColor: "#F1416F",
				fillOpacity: .8

			}).setRadius(2);
			busStops.addLayer(stops);

		}
	});




	$.getJSON("trips",function(data){
		originalData = data;
		trips = data;
		stations = {};
		for ( var i in data ){
			stations[i] = {
				lat: data[i].lat,
				lng: data[i].lng,
				name: data[i].name
			};
			var m = new L.CircleMarker( new L.LatLng(data[i].lat,data[i].lng), {opacity:0,weight:8,fillColor:"#FFF", fillOpacity: .8} )
				.setRadius(4)
				.on("click",function(){
					hideProbe();
					drawStation(getId(this));
					if ( $("#mode-toggle").hasClass("overview") ){
						$("#mode-toggle").removeClass("overview");
						$('#legend').show();
					}
				})
				.on("mouseover",showProbe)
				.on("mouseout",hideProbe);
			markers[i] = m;
			mg.addLayer( m );
		}

		drawStation(DEFAULT_STATION);
	});

	$("#mode-toggle").click( function(){
		if ( $(this).hasClass("overview") ) {
			return;
		}
		$('#legend').hide();
		$("#mode-toggle").addClass("overview");
		selected = null;
		$("#selected-label p#label").hide();
		drawAll();
	});

	var requestURL;
	function updateFilters()
	{
		var url = "trips";
		var pre = function(){ return url == "trips" ? "?" : "&" };
		if ($("#gender .text-filter.selected").html() != "All") url += (pre() + "gender="+$("#gender .text-filter.selected").html());
		if ( durationFilter.length && !(durationFilter[0] == 0 && durationFilter[1] == 21600)) {
			url += (pre() + "duration="+durationFilter[0]+"," + durationFilter[1]);
		}
		if ( ageFilter.length )  url += (pre() + "age="+ageFilter[0]+","+ageFilter[1]);
		if ( tempFilter.length )  url += (pre() + "temp="+tempFilter[0]+","+tempFilter[1]);
		var months = [];
		$("#months p").each(function(index){
			if ( $(this).hasClass("selected") ) months.push(index);
		});
		if ( months.length < 12) url += pre() + "months=" + months.toString();
		var days = [];
		$("#days p").each(function(index){
			if ( $(this).hasClass("selected") ) days.push(index+1);
		});
		if ( days.length < 7) url += pre() + "days=" + days.toString();
		if ( $("#daylight .text-filter").index($("#daylight p.selected")) !=2 ){
			url += pre() + "dark=" + $("#daylight .text-filter").index($("#daylight p.selected"));
			// disable time filter
		} else if ( !($("#start-hour").html() == $("#end-hour").html() &&
				$("#start-minute").html() == $("#end-minute").html() &&
				$("#start-am").html() == $("#end-am").html()) ){
			var hr = parseInt($("#start-hour").html());
			if ( $("#start-am").html() == "PM" ) hr += 12;
			if ( hr == 24 || hr == 12 && $("#start-am").html() == "AM" ) hr = 0;
			hr = hr.toString();
			if ( hr.length == 1 ) hr = "0" + hr;
			var startTime = hr + ":" + $("#start-minute").html() + ":00";
			hr = parseInt($("#end-hour").html());
			if ( $("#end-am").html() == "PM" ) hr += 12;
			if ( hr == 24 || hr == 12 && $("#end-am").html() == "AM" ) hr = 0;
			hr = hr.toString();
			if ( hr.length == 1 ) hr = "0" + hr;
			var endTime = hr + ":" + $("#end-minute").html() + ":00";
			var t = $("#time .text-filter").index("#time p.selected") == 0 ? "starttime=" : "endtime=";
			url += pre() + t + startTime + "," + endTime;
		}
		if ( $("#precip .text-filter").index($("#precip p.selected")) !=2 ) url += pre() + "precip=" + $("#precip .text-filter").index($("#precip p.selected"));


		if ( url == requestURL ) return;
		requestURL = url;
		$.getJSON(url, function(data) {
			trips = data;
			if ( selected )
				drawStation(selected);
			else
				drawAll();
		});
	}

	function showProbe()
	{
		var id = getId(this);
		if ( !id ) return;
		if ( !selected ){
			var to = getTotalTo(id);
			var from = getTotalFrom(id);
			$("#probe").html("<p><strong>"+stations[id].name+"</strong></p><p>Outbound: <strong>" + from + "</strong></p><p>Inbound: <strong>" + to + "</strong></p>");
			$("#probe").css({
				display:"block",
				left:Math.min($(this._container).offset().left + 10,$(window).width()-$("#probe").outerWidth()-10)+"px",top:Math.max(5,$(this._container).offset().top - $("#probe").outerHeight()-10)+"px"
			});
		} else {
			to = getTotalBetween(selected, id);
			from = getTotalBetween(id, selected);
			$("#probe").html("<p><strong>"+stations[id].name+"</strong></p><p>From " + stations[selected].name+": <strong>" + to + "</strong></p><p>To " + stations[selected].name+": <strong>" + from + "</strong></p>");
			$("#probe").css({
				display:"block",
				left:Math.min($(this._container).offset().left + 10,$(window).width()-$("#probe").outerWidth()-10)+"px",top:Math.max(5,$(this._container).offset().top - $("#probe").outerHeight()-10)+"px"
			});
		}
	}
	function hideProbe()
	{
		$("#probe").css("display","none");
	}

	function drawAll()
	{
		g.clearLayers();
		var arr = [];
		for ( var i in stations ){
			if ( !trips[i] ) continue;
			for ( var j in trips[i] ){
				if ( j=="lat" || j=="lng" || j=="name" ) continue;
				var line = new L.Arc(
					[
						new L.LatLng(stations[i].lat,stations[i].lng),
						new L.LatLng(stations[j].lat,stations[j].lng)
					],
					{
						color: '#A9C113',
						weight: lineWidth(trips[i][j]),
						clickable: false
					}
				);
				arr.push(line);
			}
		}
		arr.sort( function(){ return .5- Math.random() } );
		for ( i in arr ){
			g.addLayer(arr[i]);
		}
		map.removeLayer(mg);
		map.addLayer(mg);
	}
	function drawStation(i)
	{
		selected = i;
		g.clearLayers();
		var a = getTotalFrom(i),
			t = getTotalTo(i),
			line;

		// Update legend with trip details:
		const $stationName = $('#station-name');
		const $outboundCount = $('#outbound-count');
		const $inboundCount = $('#inbound-count');

		$stationName.text(stations[i].name || 'Selected Station');
		$outboundCount.text(a);
		$inboundCount.text(t);

		var arr = [];
		for ( var j in trips[i] ){
			if ( j=="lat" || j=="lng" || j=="name" ) continue;
			line = new L.Arc([
					new L.LatLng(stations[i].lat,stations[i].lng),
					new L.LatLng(stations[j].lat,stations[j].lng)
				], {
					color: '#F4D804',
					opacity: .75,
					weight: lineWidth(trips[i][j]),
					clickable: false
				});
			arr.push(line);
		}
		for ( j in trips ){
			if ( trips[j][i] ){
				line = new L.Arc([
					new L.LatLng(stations[j].lat,stations[j].lng),
					new L.LatLng(stations[i].lat,stations[i].lng)
				], {
					color: '#00C0EF',
					opacity: .75,
					weight: lineWidth(trips[j][i]),
					clickable: false
				});
				arr.push(line);
			}
		}
		// randomize order of line drawing
		arr.sort( function(){ return .5- Math.random() } );
		for ( i in arr ){
			g.addLayer(arr[i]);
		}
		map.removeLayer(mg);
		map.addLayer(mg);
	}

	var buckets = [
		2,
		4,
		8,
		16,
		32,
		64,
		128,
		256,
		512
	];

	function lineWidth(n)
	{
		if ( n < buckets[0] ) return .25;
		if ( n < buckets[1] ) return .25;
		if ( n < buckets[2] ) return .5;
		if ( n < buckets[3] ) return 1;
		if ( n < buckets[4] ) return 2;
		if ( n < buckets[5] ) return 3;
		if ( n < buckets[6] ) return 4;
		if ( n < buckets[7] ) return 5;
		if ( n < buckets[8] ) return 6;
		return 7;
	}

	function getTotalTo(dest)
	{
		var tripCount = 0;
		for (var orig in trips) {
			if (trips[orig][dest])
				tripCount += trips[orig][dest];
		}
		return tripCount;
	}

	function getTotalFrom(orig)
	{
		var num = 0;
		for (var dest in trips[orig]) {
			if (dest != "lat" && dest != "lng" && dest!= "name")
				num += trips[orig][dest];
		}
		return num;
	}

	function getTotalBetween(orig, dest) {
		return trips[orig][dest] || 0;
	}

	function getId(m)
	{
		for (var i in markers) {
			if (markers[i] == m)
				return i;
		}
	}

	function resize()
	{
		$("#map").height( $(window).height() - $("#header").outerHeight() - $("#footer").outerHeight() );
		$("#left").height( $(window).height() - $("#header").outerHeight() );
		$("#footer").width( $(window).width() - $("#left").outerWidth() );
	}
});
