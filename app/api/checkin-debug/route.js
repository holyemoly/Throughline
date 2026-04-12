import { GET as checkinGet } from '../checkin/route';

export async function GET(request) {
  // Inject the manual trigger header so we can hit this from a browser
  const newHeaders = new Headers(request.headers);
  newHeaders.set('x-manual-trigger', 'true');
  const newRequest = new Request(request.url, {
    method: 'GET',
    headers: newHeaders,
  });
  return checkinGet(newRequest);
}
