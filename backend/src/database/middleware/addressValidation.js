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

async function validateAddress(address) {
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
    };
  }

  if (!hasAllAddressFields(cleaned)) {
    return {
      shouldValidate: true,
      isValid: false,
      message: "Street address, city, province, and postal code are required.",
      cleaned,
    };
  }

  const fullAddress = buildFullAddress(cleaned);
  const geocoded = await geocodeAddress(fullAddress);

  if (!geocoded || geocoded.latitude == null || geocoded.longitude == null) {
    return {
      shouldValidate: true,
      isValid: false,
      message: "Address could not be validated. Please enter a complete, real address.",
      cleaned,
    };
  }

  return {
    shouldValidate: true,
    isValid: true,
    cleaned,
    latitude: geocoded.latitude,
    longitude: geocoded.longitude,
  };
}

module.exports = {
  validateAddress,
  hasAnyAddressField,
};