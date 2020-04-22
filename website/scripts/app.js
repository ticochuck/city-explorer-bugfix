'use strict';

let __API_URL__;
let GEOCODE_API_KEY;

function setEventListeners() {
  $('#url-form').on('submit', handleURL);
  $('#geocode-form').on('submit', handleKey);
  $('#getMoreYelps').on('click', getMoreYelps);
  $('#search-form').on('submit', fetchCityData);
}

function handleURL(event) {
  event.preventDefault();
  __API_URL__ = $('#back-end-url').val();
  $('#url-form').hide();
  manageForms();
}

function handleKey(event) {
  event.preventDefault();
  GEOCODE_API_KEY = $('#api-key').val();
  storeKey(GEOCODE_API_KEY);
  $('#geocode-form').hide();
  manageForms();
}

function getKey() {
  if (localStorage.getItem('geocode')) return localStorage.getItem('geocode');
}

function storeKey(key) {
  localStorage.setItem('geocode', JSON.stringify(key));
}

function manageForms() {
  if (__API_URL__ && GEOCODE_API_KEY) { $('#search-form').show(); }
}

function fetchCityData(event) {

  event.preventDefault();

  // start off by clearing everything
  clearScreen();

  let searchQuery = $('#input-search').val().toLowerCase();

  const ajaxSettings = {
    method: 'GET',
    data: { city: searchQuery },
  };

  $.ajax(`${__API_URL__}/location`, ajaxSettings)
    .then(location => {
      showTitle(location);
      displayMap(location);
      getResource('weather', location);
      getResource('movies');
      getResource('yelp');
      getResource('trails');
    })
    .catch(error => {
      showError(error);

    });
}

function showTitle(location) {
  $('.query-placeholder').text(`Here are the results for ${location.formatted_query}`);
}

function displayMap(location) {

  let mapData = {
    key: GEOCODE_API_KEY,
    lat: location.latitude,
    lon: location.longitude,
    width: 800,
    height: 400,
  };

  render( [mapData], '#map', '#map-template');

  $('#map').show();
}

function getResource(resource, location) {
  const ajaxSettings = {
    method: 'get',
    dataType: 'json',
    data: location,
  };

  $.ajax(`${__API_URL__}/${resource}`, ajaxSettings)
    .then(result => {
      render(result, `.${resource}-results`, `#${resource}-results-template`);
    })
    .catch(error => {
      showError(error);
    });
}

function showError(error) {
  render([error], '.error-container', '#error-template');
}

function clearScreen() {
  $('section ul').empty();
  $('section').hide();
  $('#map').hide();
}

function render(data, target, templateId) {

  const template = $(templateId);

  data.forEach(obj => {
    let html = Mustache.render(template, obj);
    $(target).append(html);
  });

}

$(() => {
  clearScreen();
  setEventListeners();
  GEOCODE_API_KEY = getKey();
  if (GEOCODE_API_KEY) { $('#geocode-form').addClass('hide'); }
});
