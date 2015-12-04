// Create course objects from model data
var course = function(data) {
  var self = this;
  self.name = ko.observable(data.name);
  self.address = ko.observable(data.address);
  self.latLng = ko.observable(new google.maps.LatLng(data.lat, data.lng));
  self.yelpID = ko.observable(data.yelpID);
  self.foursquareID = ko.observable(data.foursquareID);

  // Generate map marker and set custom icon
  self.marker = new google.maps.Marker({
      position: self.latLng(),
      map: null,
      title: self.name(),
      icon: "img/flag1.png"
  });

  // Adding a click event listener to the marker
  self.marker.addListener('click', function() {
    self.marker.setIcon("img/flag2.png");
  });

  // Dispaly and remove marker
  self.toggleMarker = function(value) {
    if (value === map) {
      if (self.marker.map === null) {
        self.marker.setMap(map);
      }
    } else {
      self.marker.setMap(null);
    }
  };
};


var map;

function initMap() {
  // Generate map of Metro Atlanta
  map = new google.maps.Map(document.getElementById('course-map'), {
    zoom: 11,
    center: {
    lat: 33.748795,
    lng: -84.388342
    }
  });

  ko.applyBindings( new ViewModel() );
}

// Handlebar Template - Information Window
var source = $("#info-template").html();
var template = Handlebars.compile(source);

// Knockout.js
var ViewModel = function() {
  var self = this;

  self.searchString = ko.observable('');

  // Course Objects
  self.locations = ko.observableArray([]);
  courses.forEach(function(courseData) {
    self.locations.push(new course(courseData));
  });

  // Click handlers for map markers
  self.locations().forEach(function(course) {
    google.maps.event.addListener(course.marker, 'click', function() {
      self.handleClick(course);
    });
  });

  // Filter the list when searched
  self.filteredLocations = ko.computed(function() {
    var searchedCourses = [],
        locationLength = self.locations().length;

    for (i = 0; i < locationLength; i++) {
        if (self.locations()[i].name().toLowerCase().indexOf(self.searchString().toLowerCase()) != -1) {
          searchedCourses.push(self.locations()[i]);
          self.locations()[i].toggleMarker(map);
        } else {
          self.locations()[i].toggleMarker();
        }
    }
    return searchedCourses.sort(function (l, r) { return l.name() > r.name() ? 1 : -1;});
  });

  // Generate info window with Handlebars template for the courses when clicked
  self.infowindow = new google.maps.InfoWindow({
    content: '<div style="width: 250px; height: 150px;"></div>'
  });

  // Set zoom on marker, animate and position to center
  self.handleClick = function(course) {
    map.setZoom(14);
    map.setCenter(course.latLng());
    course.marker.setAnimation(google.maps.Animation.BOUNCE);
    setTimeout(function(){ course.marker.setAnimation(null); }, 750);
    // Async calls to get course ratings
    self.getYelpInfo(course);

    // Display the info window
    self.infowindow.open(map, course.marker);
  };

  // Pull from Yelp
  self.getYelpInfo = function(course) {
    // AJAX Call
    var httpMethod = 'GET';
    var builtURL = 'http://api.yelp.com/v2/business/' + course.yelpID();

    // Oauth settings
    var nonceMaker =  function() {
        return (Math.floor(Math.random() * 1e12).toString());
    };
    var parameters =
      {
        oauth_consumer_key : '8g-8KUSDN-k2VnZHM3txGQ',
        oauth_token : 'JGElGpgAssjRlZXar75nFglXbtirLVDZ',
        oauth_nonce : nonceMaker(),
        oauth_timestamp : Math.floor(Date.now()/1000),
        oauth_signature_method : 'HMAC-SHA1',
        oauth_version : '1.0',
        callback: 'callback'
      };
    var consumerSecret = '0GUk4kWXxnNluSVppFRC24frdGk';
    var tokenSecret = 'fCl8T9p3kJ97d1R755KCGeDGnEw';
    var encodedSignature = oauthSignature.generate(httpMethod, builtURL, parameters, consumerSecret, tokenSecret);
    parameters.oauth_signature = encodedSignature;

    // Settings for AJAX call
    var foursquareRequestTimeout = setTimeout(function(){
      alert("Error: An error occurred while trying to retrieve requested Yelp information.");
    }, 6000);
    var settings = {
      url: builtURL,
      data: parameters,
      cache: true,
      dataType: 'jsonp',
      // Populate the Handlebars template
      success: function(results) {
        // Display an FPO image if one is not is returned
        var courseimage = (results.image_url !== undefined) ? results.image_url : "img/fpo.jpg";
        var context = {
          name: results.name,
          street: results.location.address.join('<br>'),
          city: results.location.city,
          state: results.location.state_code,
          zip: results.location.postal_code,
          phone: results.phone,
          image: courseimage,
          yelpRating: results.rating_img_url,
          yelpRatingStars: results.rating,
        };
        // Call Foursquare after success
        self.getFoursquareInfo(course, context);
        clearTimeout(foursquareRequestTimeout);
      }
    };

    // AJAX
    $.ajax(settings);
  };

  // Pull from Foursquare
  self.getFoursquareInfo = function(course, context) {
    var d = new Date();
    var foursquareDate = d.getFullYear().toString() + ("0" + (d.getMonth() + 1)).slice(-2) + ("0" + d.getDate()).slice(-2);
    var foursquareClientID = 'ODEKNZLBXG0NJMHSSW32R1ULPDJIXGFD0MQEC4R2GJEZUM1J';
    var foursquareClientSecret = 'QWOO1CEQ54NM15W344UPDIVJYPIBJGSXLVTCYLNT0REGDIJK';
    var builtURL = 'https://api.foursquare.com/v2/venues/' + course.foursquareID() + '?&client_id=' + foursquareClientID + '&client_secret=' + foursquareClientSecret + '&v=' + foursquareDate;

    // Create settings object for ajax call
    var settings = {
      url: builtURL,
      // Diplay and error alert if call fails
      error: function(XMLHttpRequest, textStatus, errorThrown) {
        alert("Error: An error occurred while trying to retrieve requested Foursquare information.");
      },
      // Populate the rating
      success: function(results) {
        context.foursquareRating = results.response.venue.rating;

        // Update the info window
        var html = template(context);
        self.infowindow.setContent(html);
      }
    };

    // AJAX
    $.ajax(settings);

  };
};
