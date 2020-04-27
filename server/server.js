'use strict';

// Load Environment Variables from the .env file
require('dotenv').config();

// Application Dependencies
const express = require('express');
const cors = require('cors');
const pg = require('pg');
const superagent = require('superagent');

// Application Setup
const PORT = process.env.PORT;
const app = express();
const client = new pg.Client(process.env.DATABASE_URL);
// client.on('error', (error) => console.error('Connection Failure', error));

app.use(cors());

// Route Definitions
app.get('/location', locationHandler);
app.get('/weather', weatherHandler);
app.get('/yelp', yelpHandler);
app.get('/movies', moviesHandler);
app.get('/trails', trailsHandler);

app.use('*', notFoundHandler);
app.use(errorHandler);

// -------------------------------------------
// LOCATIONS
// -------------------------------------------

function locationHandler(request, response) {
  const city = request.query.city;
  // Alternatively: const {city} = request.query;
  getLocationData(city)
    .then(data => sendJson(data, response))
    .catch((error) => errorHandler(error, request, response));
}

function getLocationData(city) {

  const SQL = `SELECT * FROM locations WHERE search_query = $1`;
  const values = [city];

  return client.query(SQL, values)
    .then(results => {
      if (results.rowCount >= 1) { return results.rows[0]; }
      else {

        const url = `https://us1.locationiq.com/v1/search.php`;

        const queryParams = {
          key: process.env.GEOCODE_API_KEY,
          q:city,
          format:'json',
          limit:1,
        };

        return superagent.get(url)
          .query(queryParams)
          .then(data => cacheLocation(city, data.body));
      }
    });
}

function cacheLocation(city, data) {
  const location = new Location(data[0]);
  const SQL = `
    INSERT INTO locations (search_query, formatted_query, latitude, longitude)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `;
  const values = [city, location.formatted_query, location.latitude, location.longitude];
  return client.query(SQL, values)
    .then(results => results.rows[0]);
}

function Location(data) {
  this.formatted_query = data.display_name;
  this.latitude = data.lat;
  this.longitude = data.lon;
}

// -------------------------------------------
// WEATHER
// -------------------------------------------
function weatherHandler(request, response) {
  const latitude = request.query.latitude;
  const longitude = request.query.longitude;
  // Alternatively: const {latitude, longitude} = request.query;

  getWeather(latitude, longitude)
    .then(summaries => sendJson(summaries, response))
    .catch((error) => errorHandler(error, request, response));
}

function getWeather(latitude, longitude) {
  const url = 'http://api.weatherbit.io/v2.0/forecast/daily';
  const queryParams = {
    key: process.env.WEATHER_API_KEY,
    lang: 'en',
    lat: latitude,
    lon: longitude,
    days: 5,
  };
  return superagent.get(url)
    .query( queryParams )
    .then(data => parseWeatherData(data.body));
}

function parseWeatherData(weatherData) {
  try {
    const weatherSummaries = weatherData.data.map(day => {
      return new Weather(day);
    });
    return Promise.resolve(weatherSummaries);
  } catch (e) {
    return Promise.reject(e);
  }
}

function Weather(day) {
  this.forecast = day.weather.description;
  this.time = day.datetime;
}

// -------------------------------------------
// YELP
// -------------------------------------------


function yelpHandler(request, response) {
  const location = request.query.search_query;
  getYelp(location)
    .then(reviews => sendJson(reviews, response))
    .catch((error) => errorHandler(error, request, response));
}


function getYelp(location) {

  const url = 'https://api.yelp.com/v3/businesses/search';

  const queryParams = {
    location:location,
  };

  return superagent.get(url)
    .set ('Authorization', `Bearer ${process.env.YELP_API_KEY}`)
    .query(queryParams)
    .then(data => parseYelpData(data.body));
}

// Helpers
function parseYelpData(data) {
  try {
    const yelpSummaries = data.businesses.map(business => {
      return new Yelp(business);
    });
    return Promise.resolve(yelpSummaries);
  } catch (e) {
    return Promise.reject(e);
  }
}

function Yelp(business) {
  this.tableName = 'yelps';
  this.name = business.name;
  this.image_url = business.image_url;
  this.price = business.price;
  this.rating = business.rating;
  this.url = business.url;
  this.created_at = Date.now();
}

// -------------------------------------------
// TRAILS
// -------------------------------------------

function trailsHandler(request, response) {
  const latitude = request.query.latitude;
  const longitude = request.query.longitude;
  // Alternatively: const {latitude, longitude} = request.query;
  getTrails(latitude, longitude)
    .then(trailsList => sendJson(trailsList))
    .catch((error) => errorHandler(error, request, response));
}

function getTrails(latitude, longitude) {

  const url = 'https://www.hikingproject.com/data/get-trails';

  const queryParams = {
    lat: latitude,
    lon: longitude,
    maxDistance: 200,
    key: process.env.TRAIL_API_KEY,
  };

  return superagent.get(url)
    .query(queryParams)
    .then(data => parseTrailsData(data));
}

function parseTrailsData(data) {
  try {
    const trails = data.trails.map(trail => {
      return new Trail(trail);
    });
    return Promise.resolve(trails);
  } catch (e) {
    return Promise.reject(e);
  }
}

function Trail(trail) {
  this.tableName = 'trails';
  this.name = trail.name;
  this.location = trail.location;
  this.length = trail.length;
  this.stars = trail.stars;
  this.star_votes = trail.starVotes;
  this.summary = trail.summary;
  this.trail_url = trail.url;
  this.conditions = trail.conditionDetails;
  this.condition_date = trail.conditionDate.slice(0, 10);
  this.condition_time = trail.conditionDate.slice(12);
  this.created_at = Date.now();
}


// -------------------------------------------
// MOVIES`
// -------------------------------------------

function moviesHandler(request, response) {
  const location = request.query.search_query;
  getMovies(location)
    .then(trailsList => sendJson(trailsList, response))
    .catch((error) => errorHandler(error, request, response));
}


function getMovies(location) {

  const url = 'https://api.themoviedb.org/3/search/movie';

  const queryParams = {
    api_key: process.env.MOVIE_API_KEY,
    language: 'en-US',
    page: 1,
    query: location,
  };

  return superagent.get(url)
    .query(queryParams)
    .then(data => parseMoviesData(data.body));

}

function parseMoviesData(data) {
  try {
    const movies = data.results.map(movie => {
      return new Movie(movie);
    });
    return Promise.resolve(movies);
  } catch (e) {
    return Promise.reject(e);
  }
}

function Movie(movie) {
  this.tableName = 'movies';
  this.title = movie.title;
  this.overview = movie.overview;
  this.average_votes = movie.vote_average;
  this.total_votes = movie.vote_count;
  this.image_url = 'https://image.tmdb.org/t/p/w500' + movie.poster_path;
  this.popularity = movie.popularity;
  this.released_on = movie.release_date;
  this.created_at = Date.now();
}


// -------------------------------------------
// EXPRESS RENDERERS
// -------------------------------------------

function sendJson(data, response) {
  response.status(200).json(data);
}

function notFoundHandler(request, response) {
  response.status(404).send('huh?');
}

function errorHandler(error, request, response) {
  response.status(500).send(error);
}

function startServer() {
  app.listen(PORT, () => console.log(`Server up on ${PORT}`));
}

// Start Up the Server after the database is connected and cache is loaded
client.connect()
  .then(startServer)
  .catch(err => console.error(err));
