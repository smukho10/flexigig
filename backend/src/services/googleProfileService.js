const https = require('https');

const GOOGLE_PEOPLE_API_URL = 'https://people.googleapis.com/v1/people/me?personFields=names,photos,phoneNumbers';

const pickPrimary = (items = []) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  return items.find((item) => item.metadata?.primary) || items[0] || null;
};

const fetchJson = (url, accessToken) => new Promise((resolve, reject) => {
  const req = https.get(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  }, (res) => {
    let body = '';
    res.on('data', (chunk) => {
      body += chunk;
    });
    res.on('end', () => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        return reject(new Error(`Google People API request failed with status ${res.statusCode}: ${body}`));
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
  });

  req.on('error', reject);
});

const getGoogleProfileDetails = async (accessToken) => {
  if (!accessToken) {
    return { firstName: '', lastName: '', picture: null, phoneNumber: null };
  }

  try {
    const data = await fetchJson(GOOGLE_PEOPLE_API_URL, accessToken);
    const primaryName = pickPrimary(data.names);
    const primaryPhoto = pickPrimary(data.photos);
    const primaryPhone = pickPrimary(data.phoneNumbers);

    return {
      firstName: primaryName?.givenName || '',
      lastName: primaryName?.familyName || '',
      picture: primaryPhoto?.url || null,
      phoneNumber: primaryPhone?.value || null,
    };
  } catch (error) {
    console.warn('Error fetching Google People profile details:', error.message || error);
    return { firstName: '', lastName: '', picture: null, phoneNumber: null };
  }
};

module.exports = {
  getGoogleProfileDetails,
};
