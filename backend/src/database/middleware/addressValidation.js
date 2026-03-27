const { geocodeAddress } = require("../../services/geocodingService");

const clean = (value) => (typeof value === "string" ? value.trim() : "");

const normalizePostalCode = (postalCode = "") =>
  clean(postalCode).toUpperCase();

const hasAnyAddressField = ({ streetAddress, city, province, postalCode }) => {
  return [streetAddress, city, province, postalCode].some(
    (value) => clean(value) !== ""
  );
};

const hasAllAddressFields = ({ streetAddress, city, province, postalCode }) => {
  return [streetAddress, city, province, postalCode].every(
    (value) => clean(value) !== ""
  );
};

const buildFullAddress = ({ streetAddress, city, province, postalCode }) => {
  return [
    clean(streetAddress),
    clean(city),
    clean(province),
    normalizePostalCode(postalCode),
  ]
    .filter(Boolean)
    .join(", ");
};

async function validateAddress(address = {}) {
  const cleaned = {
    streetAddress: clean(address.streetAddress),
    city: clean(address.city),
    province: clean(address.province),
    postalCode: normalizePostalCode(address.postalCode),
  };

  const anyProvided = hasAnyAddressField(cleaned);

  if (!anyProvided) {
    return {
      shouldValidate: false,
      isValid: true,
      cleaned,
      latitude: null,
      longitude: null,
      geocodingStatus: "not_requested",
    };
  }

  if (!hasAllAddressFields(cleaned)) {
    return {
      shouldValidate: true,
      isValid: false,
      message: "Street address, city, province, and postal code are required.",
      cleaned,
      latitude: null,
      longitude: null,
      geocodingStatus: "skipped_incomplete_address",
    };
  }

  const fullAddress = buildFullAddress(cleaned);

  try {
    const geocoded = await geocodeAddress(fullAddress);

    if (geocoded && geocoded.latitude != null && geocoded.longitude != null) {
      return {
        shouldValidate: true,
        isValid: true,
        cleaned,
        latitude: geocoded.latitude,
        longitude: geocoded.longitude,
        geocodingStatus: "success",
      };
    }

    // Geocoding returned no result, but do not block the request
    return {
      shouldValidate: true,
      isValid: true,
      cleaned,
      latitude: null,
      longitude: null,
      geocodingStatus: "no_result",
    };
  } catch (error) {
    console.error("Geocoding failed during address validation:", {
      address: fullAddress,
      error: error.message,
    });

    // Allow submission even if geocoding fails
    return {
      shouldValidate: true,
      isValid: true,
      cleaned,
      latitude: null,
      longitude: null,
      geocodingStatus: "failed",
    };
  }
}

module.exports = {
  validateAddress,
  hasAnyAddressField,
};