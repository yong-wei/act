const COURSE_COVER = 'df8b6ef5e4c122f2eae9ec21320a55df26d193f895a65d6b5c2edda39a91508d';
const PUBLIC_RASTER = /^\/teaching-media\/sha256\/([a-f0-9]{64})\/asset\.(?:png|jpe?g)$/u;

function acceptsWebp(value: string | null): boolean {
  return (value ?? '').split(',').some(entry => {
    const [type, ...parameters] = entry.toLowerCase().trim().split(';');
    if (type.trim() !== 'image/webp') return false;
    const quality = parameters.map(part => part.trim()).find(part => part.startsWith('q='));
    return quality === undefined || Number(quality.slice(2)) > 0;
  });
}

export function publicImageDeliveryRedirect(request: Request, source: string): Response {
  const url = new URL(source);
  const raster = PUBLIC_RASTER.exec(url.pathname);
  const query = new URL(request.url).searchParams;
  if (process.env.ACT_PUBLIC_TEACHING_MEDIA_WEBP_ENABLED !== '0'
    && url.origin === 'https://static.adapt-learn.online' && !url.search && raster
    && request.headers.get('sec-fetch-dest') === 'image' && acceptsWebp(request.headers.get('accept'))
    && !request.headers.has('range') && !query.has('download') && !query.has('raw')) {
    const processImage = raster[1] === COURSE_COVER
      ? 'image/resize,w_1280,limit_1/format,webp/quality,Q_82'
      : 'image/format,webp/quality,lossless';
    url.searchParams.set('x-oss-process', processImage);
  }
  return new Response(null, { status: 307, headers: {
    Location: url.href,
    'Cache-Control': 'no-store',
    Vary: 'Accept, Sec-Fetch-Dest',
  } });
}
