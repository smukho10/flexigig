const axios = require("axios");

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

async function geocodeAddress(address) {
  try {
    const response = await axios.get(NOMINATIM_URL, {
      params: {
        q: address,
        format: "json",
        limit: 1
      },
      headers: {
        "User-Agent": "flexigig-app"
      }
    });

    if (!response.data || response.data.length === 0) {
      return null;
    }

    const location = response.data[0];

    return {
      latitude: parseFloat(location.lat),
      longitude: parseFloat(location.lon)
    };

  } catch (error) {
    console.error("Geocoding error:", error.message);
    return null;
  }
}

module.exports = { geocodeAddress };