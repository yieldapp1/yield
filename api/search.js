// Serverless proxy to the Seats.aero Partner API.
//
// This exists so the Seats.aero API key never reaches the browser: it's read
// here from a server-side environment variable (SEATS_AERO_API_KEY, set in
// Vercel's Project Settings -> Environment Variables) and attached to the
// upstream request. The client only ever talks to /api/search.
//
// Docs: https://developers.seats.aero/reference/cached-search

module.exports = async function handler(req, res) {
  const apiKey = process.env.SEATS_AERO_API_KEY;
  if (!apiKey) {
    res.status(503).json({
      error: 'Live search isn\'t configured yet — SEATS_AERO_API_KEY is missing on the server.',
    });
    return;
  }

  const { origin, destination, cabin, startDate, endDate } = req.query;
  if (!origin || !destination) {
    res.status(400).json({ error: 'origin and destination are required (comma-separated IATA codes).' });
    return;
  }

  const params = new URLSearchParams({
    origin_airport: String(origin).toUpperCase(),
    destination_airport: String(destination).toUpperCase(),
    order_by: 'lowest_mileage',
    take: '50',
  });
  if (cabin) params.set('cabins', String(cabin));
  if (startDate) params.set('start_date', String(startDate));
  if (endDate) params.set('end_date', String(endDate));

  try {
    const upstream = await fetch(`https://seats.aero/partnerapi/search?${params.toString()}`, {
      headers: { 'Partner-Authorization': apiKey },
    });
    const body = await upstream.json();

    if (!upstream.ok) {
      res.status(upstream.status).json({
        error: (body && body.error) || `Seats.aero returned ${upstream.status}`,
        detail: body,
      });
      return;
    }

    // Cache briefly at the edge -- Seats.aero's cached-search results don't
    // change every second, and this keeps us well under the 1,000/day cap.
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');
    res.status(200).json(body);
  } catch (err) {
    res.status(502).json({ error: 'Failed to reach Seats.aero', detail: String(err && err.message || err) });
  }
};
