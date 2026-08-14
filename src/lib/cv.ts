export const CV_DID = 'did:plc:nmhfq335cddnwt4ovrq4gzsm';

const FALLBACK_PDS = 'https://chaga.us-west.host.bsky.network';

export const CV_COLLECTIONS = [
  'id.career.profile',
  'id.career.education',
  'id.career.presentation',
  'id.sifa.profile.position',
  'id.career.openSourceContribution',
  'id.career.authorship',
  'id.career.award',
  'id.career.grant',
  'id.career.membership',
  'id.career.service',
  'id.career.teaching',
  'id.career.supervision',
  'id.career.patent',
  'id.career.outreach',
  'id.career.work',
  'id.career.attestation',
  'id.career.dossier'
] as const;

export type CvCollection = typeof CV_COLLECTIONS[number];
export type CvRecord = Record<string, unknown>;

export interface CvExport {
  $schema: string;
  did: string;
  exportedAt: string;
  records: Record<CvCollection, CvRecord[]>;
}

async function resolvePds() {
  const response = await fetch(`https://plc.directory/${CV_DID}`);
  if (!response.ok) return FALLBACK_PDS;

  const document = await response.json();
  return document.service?.find((service: { id?: string; type?: string }) =>
    service.id === '#atproto_pds' || service.type === 'AtprotoPersonalDataServer'
  )?.serviceEndpoint || FALLBACK_PDS;
}

async function listRecords(pds: string, collection: CvCollection) {
  const records: CvRecord[] = [];
  let cursor = '';

  do {
    const query = new URLSearchParams({ repo: CV_DID, collection, limit: '100' });
    if (cursor) query.set('cursor', cursor);

    const response = await fetch(`${pds}/xrpc/com.atproto.repo.listRecords?${query}`);
    if (!response.ok) throw new Error(`Could not fetch ${collection}: ${response.status}`);

    const page = await response.json();
    records.push(...(page.records || []).map((record: { value: CvRecord }) => record.value));
    cursor = page.cursor || '';
  } while (cursor);

  return records;
}

let cvExportPromise: Promise<CvExport> | undefined;

export function getCvExport() {
  cvExportPromise ??= (async () => {
    const pds = await resolvePds();
    const entries = await Promise.all(CV_COLLECTIONS.map(async (collection) => [
      collection,
      await listRecords(pds, collection)
    ] as const));

    return {
      $schema: 'https://minori.takeruf.workers.dev/',
      did: CV_DID,
      exportedAt: new Date().toISOString(),
      records: Object.fromEntries(entries) as Record<CvCollection, CvRecord[]>
    };
  })();

  return cvExportPromise;
}
