export function getApiUrl(wikiUrl: string): string {
    let url = wikiUrl.trim().replace(/\/+$/, '');

    // Already an api.php URL
    if (url.includes('api.php')) {
        return url;
    }

    // Fandom: https://typemoon.fandom.com/wiki/Saber -> https://typemoon.fandom.com/api.php
    if (url.includes('fandom.com')) {
        const match = url.match(/(https?:\/\/[^/]+\.fandom\.com)/);
        if (match) return match[1] + '/api.php';
    }

    // Generic MediaWiki: try /w/api.php first (Wikipedia-style), then /api.php
    if (url.includes('/wiki/')) {
        const base = url.split('/wiki/')[0];
        return base + '/w/api.php';
    }

    // Fallback: just append /api.php
    return url + '/api.php';
}

export async function fetchAllPages(
    apiUrl: string,
    limit: number = 5000,
    onProgress?: (count: number) => void
): Promise<string[]> {
    let pages: string[] = [];
    let apfrom: string | undefined = undefined;

    while (pages.length < limit) {
        const params = new URLSearchParams({
            action: 'query',
            list: 'allpages',
            aplimit: 'max',
            format: 'json',
            origin: '*',
        });
        if (apfrom) params.append('apfrom', apfrom);

        const resp = await fetch(`${apiUrl}?${params}`);
        if (!resp.ok) {
            throw new Error(`Wiki API Error: ${resp.status}`);
        }

        const data = await resp.json();

        if (data.query && data.query.allpages) {
            pages.push(...data.query.allpages.map((p: any) => p.title));
            if (onProgress) onProgress(pages.length);
        }

        if (data.continue && data.continue.apcontinue) {
            apfrom = data.continue.apcontinue;
        } else {
            break;
        }
    }

    return pages.slice(0, limit);
}
