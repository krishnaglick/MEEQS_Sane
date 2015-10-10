/**
 * RestaurantsController
 *
 * @description :: I am a giant google wrapper.
 * @help        :: https://www.npmjs.com/package/googleplaces
 */

var unwantedProperties = [
  'rating',
  'scope',
  'reference',
  'id',
  'adr_address',
  'formatted_address',
  'international_phone_number',
  'reviews',
  'user_ratings_total',
  'isDeleted',
  'types',

  //Unwanted Types
  'establishment',
  'point_of_interest',
  'food',
  'restaurant'
];
var googleRequestParams = [
  'location',
  'radius',
  'rankby',
  'keyword',
  'language',
  'minprice',
  'maxprice',
  'name',
  'opennow',
  'types',
  'pagetoken',
  'zagatselected'
];

module.exports = {
  find : (req, res) => {
    let googleSearchOptions = _.pick(req.allParams(), googleRequestParams);
    googleSearchOptions.location = req.cookies.location || req.allParams().location || googleSearchOptions.location;

    Google.getPlacesNearMe(googleSearchOptions, (err, gRes) => {
      if (err) return res.serverError(err);
      if(!gRes || !gRes.results) return res.notFound();

      var place_ids = _.pluck(gRes.results, 'place_id');

      RestaurantLocation.find({ where: { place_id: place_ids }})
      .populate('tags')
      //.populate('ratings')
      .exec((err, matchingRecords) => {

        if (err)
          return res.serverError(err);

        if(!matchingRecords || _.isEmpty(matchingRecords))
          return res.ok({restaurants: Utils.removePropertiesByBlacklist(gRes.results, unwantedProperties)});

        let recordsWithRatings = _.map(matchingRecords, (matchingRecord) => {
          return new Promise((res, rej) => {
            matchingRecord.getAverageRatings(res);
          });
        });

        Promise.all(recordsWithRatings).then(() => {
          let mergedResults = Utils.mergeOnAsProperty(matchingRecords, gRes.results, 'place_id', 'restaurantLocation');
          return res.ok({ restaurants: Utils.removePropertiesByBlacklist(mergedResults, unwantedProperties) });
        });
      });
    });
  },

  optionsFind : (req, res) => {
    var optionsObject = {
      'Request Details': {
        'Type': 'get',
        'Allowed Query String Parameters': googleRequestParams,
        'Required Cookies': { 'Sample Location': Google.getDefaultLocation() },
        'Example Routes': [
          '/api/v1/Restaurants',
          '/api/v1/Restaurants?keyword=Mexican',
          '/api/v1/Restaurants?maxprice=10'
        ]
      },
      'Response Details': {
        restaurants: [
          {
            geometry: {
              location: {
                lat: 'A Number',
                lng: 'A Number'
              }
            },
            icon: 'https://maps.gstatic.com/mapfiles/place_api/icons/restaurant-##.png',
            name: 'A Restaurant',
            opening_hours: {
              open_now: true,
              weekday_text: []
            },
            place_id: 'some google place id',
            vicinity: 'Street Address, City',
            restaurantLocation:
              {
                restaurantLocationID: 1,
                name: 'A Restaurant',
                rating: {
                  menuSelection: 2.5,
                  environment: 1.2,
                  costEfficiency: 2.9,
                  productQuality: 3,
                  service: 0.9,
                  averageRating: 2.1
                },
                place_id: 'some google place id'
              }
          },
          {
            geometry: {
              location: {
                lat: 'A Number',
                lng: 'A Number'
              }
            },
            icon: 'https://maps.gstatic.com/mapfiles/place_api/icons/restaurant-##.png',
            name: 'Another Restaurant',
            place_id: 'some other google place id',
            vicinity: 'Street Address, City',
          }
        ]
      }
    };

    return res.ok(optionsObject);
  },

  findOne : (req, res) => {
    let queryOptions = {
      where: {}
    };
    if(isNaN(req.params)) {
      queryOptions.where.place_id = req.params;
    }
    else {
      queryOptions.where.restaurantLocationID = req.params;
    }
    RestaurantLocation.findOne(queryOptions)
    .populate('tags')
    .populate('ratings')
    .exec((err, restaurantLocation) => {
      if(err) return res.serverError(err);

      //I shouldn't have to do this.
      restaurantLocation = restaurantLocation.toJSON();

      let improvedRatings = _.map(restaurantLocation.ratings, (rating) => {
        return new Promise((res, rej) => {
          if(!rating || _.isEmpty(rating)) res();
          User.findOne({where: {userID: rating.user}}).exec((err, user) => {
            if(!err) rating.user = user.displayName;
            res();
          });
        });
      });

      Promise.all(improvedRatings).then(() => {
        if(restaurantLocation.ratings) {
          //TODO: This should be part of the query, but...
          var avgRating = {
            menuSelection: 0,
            environment: 0,
            costEfficiency: 0,
            productQuality: 0,
            service: 0,
            averageRating: 0
          };
          _.each(restaurantLocation.ratings, (rating) => {
            avgRating.menuSelection += rating.menuSelection;
            avgRating.environment += rating.environment;
            avgRating.costEfficiency += rating.costEfficiency;
            avgRating.productQuality += rating.productQuality;
            avgRating.service += rating.service;
            avgRating.averageRating += rating.averageRating;
          });
          avgRating = _.each(avgRating, (ratingValue, ratingType, obj) => {
            obj[ratingType] = ratingValue / (restaurantLocation.ratings || []).length;
          });
          restaurantLocation.avgRating = avgRating;
        }
        return res.ok({ restaurantLocation: Utils.removePropertiesByBlacklist(restaurantLocation, unwantedProperties) });
      });
    });
  },

  optionsFindOne : (req, res) => {
    var optionsObject = {
      'Request Details': {
        'Type': 'get',
        'Route Value': 'A Google Place ID or Restaurant Location ID',
        'Example Routes': [
          '/api/v1/Restaurants/1',
          '/api/v1/Restaurants/ChIJV-L5JFq15YgRLmUkD-SkpuA',
        ]
      },
      'Response Details': {
        restaurantLocation: {
          restaurantLocationID: 1,
          name: 'A Restaurant',
          ratings: [
            {
              menuSelection: 2.5,
              environment: 1.2,
              costEfficiency: 2.9,
              productQuality: 3,
              service: 0.9,
              averageRating: 2.1,
              comment: 'A Comment',
              user: 'A user\'s display name',
              language: 'en-US'
            },
            {
              menuSelection: 4,
              environment: 3,
              costEfficiency: 2,
              productQuality: 1,
              service: 0,
              averageRating: 2,
              comment: 'Another Comment',
              user: 'Another user\'s display name',
              language: 'en-US'
            }
          ],
          avgRating: {
            menuSelection: 4,
            environment: 3,
            costEfficiency: 2,
            productQuality: 1,
            service: 0,
            averageRating: 2
          },
          place_id: 'some google place id',
          tags: [
            {name: 'A tag'},
            {name: 'Another Tag'},
            {name: 'A Third Tag'}
          ]
        }
      }
    };

    return res.ok(optionsObject);
  },
};
