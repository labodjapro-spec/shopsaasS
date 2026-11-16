import { NextRequest, NextResponse } from 'next/server';

const APIFY_TOKEN = process.env.APIFY_API_TOKEN;

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!APIFY_TOKEN) {
    return NextResponse.json(
      { error: 'Clé Apify manquante. Ajoutez APIFY_API_TOKEN dans .env.local' },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const searchTerms = searchParams.get('search_terms') || 'livraison gratuite';
  const countriesRaw = searchParams.get('countries') || 'ALL';
  const mediaType = searchParams.get('media_type') || '';

  const countryCode = (countriesRaw === 'ALL' || !countriesRaw)
    ? 'ALL'
    : countriesRaw.split(',')[0].toUpperCase();

  let fbMediaType = 'all';
  if (mediaType === 'IMAGE') fbMediaType = 'image';
  if (mediaType === 'VIDEO') fbMediaType = 'video';

  // URL Meta Ad Library — active_status=active = pubs actives en ce moment
  const targetFbUrl = [
    'https://www.facebook.com/ads/library/',
    `?active_status=active`,
    `&ad_type=all`,
    `&country=${countryCode}`,
    `&q=${encodeURIComponent(searchTerms)}`,
    `&search_type=keyword_unordered`,
    `&media_type=${fbMediaType}`,
  ].join('');

  console.log(`[SPY PUBS] country=${countryCode} | keyword="${searchTerms}" | url=${targetFbUrl}`);

  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/curious_coder~facebook-ads-library-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls: [{ url: targetFbUrl }],
          count: 100,
        }),
        cache: 'no-store',
      }
    );

    const data = await res.json();

    if (data.error) {
      return NextResponse.json({ error: String(data.error) }, { status: 400 });
    }

    const items: any[] = Array.isArray(data) ? data : (data.items || []);
    const totalInCountry: number = items[0]?.total || items.length;

    const adsRaw = items.map((ad: any) => {
      const adId = String(ad.ad_archive_id || ad.ad_id || Math.random());
      const snap = ad.snapshot || {};
      const firstCard = snap.cards?.[0] || {};

      // Durée de diffusion
      let daysRunning: number | null = null;
      let startDateStr: string | null = ad.start_date_formatted || null;
      if (ad.start_date) {
        const startDate = new Date(ad.start_date * 1000);
        startDateStr = startDate.toISOString();
        daysRunning = Math.floor((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      }

      // Type de média + URL
      let snapshotUrl: string | null = null;
      let detectedMediaType = 'IMAGE';

      if (snap.display_format === 'VIDEO' || snap.videos?.length > 0 || firstCard.video_sd_url) {
        detectedMediaType = 'VIDEO';
        snapshotUrl = firstCard.video_sd_url || snap.videos?.[0]?.video_sd_url || null;
      } else if (snap.display_format === 'CAROUSEL' || snap.display_format === 'DPA') {
        detectedMediaType = 'MULTI_MEDIA';
        snapshotUrl = firstCard.resized_image_url || firstCard.original_image_url || null;
      } else {
        snapshotUrl = firstCard.resized_image_url
          || firstCard.original_image_url
          || snap.images?.[0]?.resized_image_url
          || null;
      }

      // Collecter TOUS les médias
      const allImageUrls: string[] = [];
      const allVideoUrls: string[] = [];

      if (snap.cards?.length > 0) {
        snap.cards.forEach((card: any) => {
          if (card.video_sd_url) allVideoUrls.push(card.video_sd_url);
          if (card.video_hd_url) allVideoUrls.push(card.video_hd_url);
          if (card.resized_image_url) allImageUrls.push(card.resized_image_url);
          else if (card.original_image_url) allImageUrls.push(card.original_image_url);
        });
      }
      if (snap.videos?.length > 0) {
        snap.videos.forEach((v: any) => {
          if (v.video_sd_url) allVideoUrls.push(v.video_sd_url);
          if (v.video_hd_url) allVideoUrls.push(v.video_hd_url);
          if (v.video_preview_image_url) allImageUrls.push(v.video_preview_image_url);
        });
      }
      if (snap.images?.length > 0) {
        snap.images.forEach((img: any) => {
          if (img.resized_image_url) allImageUrls.push(img.resized_image_url);
          else if (img.original_image_url) allImageUrls.push(img.original_image_url);
        });
      }
      if (snapshotUrl && !allImageUrls.includes(snapshotUrl) && !allVideoUrls.includes(snapshotUrl)) {
        if (detectedMediaType === 'VIDEO') allVideoUrls.unshift(snapshotUrl);
        else allImageUrls.unshift(snapshotUrl);
      }

      const uniqueImages = [...new Set(allImageUrls)].filter(Boolean);
      const uniqueVideos = [...new Set(allVideoUrls)].filter(Boolean);
      const targetedCountries: string[] = ad.targeted_or_reached_countries || [];

      return {
        id: adId,
        body: snap.body?.text || firstCard.body || null,
        linkTitle: snap.title || firstCard.title || null,
        linkDescription: snap.link_description || firstCard.link_description || null,
        linkCaption: snap.caption || firstCard.caption || null,
        ctaText: snap.cta_text || firstCard.cta_text || null,
        mediaType: detectedMediaType,
        snapshotUrl,
        allImageUrls: uniqueImages,
        allVideoUrls: uniqueVideos,
        pageName: ad.page_name || snap.page_name || 'Page inconnue',
        pageUrl: snap.page_profile_uri || null,
        profileImage: snap.page_profile_picture_url || null,
        siteUrl: firstCard.link_url || snap.link_url || null,
        targetedCountries,
        startDate: startDateStr,
        daysRunning,
        impressions: null,
        originalUrl: ad.ad_library_url || null,
      };
    });

    // Filtre 1 : minimum 7 jours actif
    let ads = adsRaw.filter((ad: any) => ad.daysRunning === null || ad.daysRunning >= 7);

    // Filtre 2 : pays strict (si un pays spécifique est sélectionné)
    if (countryCode !== 'ALL') {
      ads = ads.filter((ad: any) => {
        if (!ad.targetedCountries || ad.targetedCountries.length === 0) return true;
        return ad.targetedCountries.includes(countryCode);
      });
    }

    const response = NextResponse.json({
      ads,
      hasMore: false,
      totalInCountry,
      country: countryCode,
      keyword: searchTerms,
    });

    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Surrogate-Control', 'no-store');

    return response;

  } catch (err: any) {
    console.error('[APIFY FETCH ERROR]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
