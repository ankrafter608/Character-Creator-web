import { useState } from 'react';
import type { FC } from 'react';
import type { KBFile } from '../types';

interface WikiScraperProps {
    onFilesAdd: (files: KBFile[]) => void;
    wikiUrl: string;
    onWikiUrlChange: (url: string) => void;
    queue: QueueItem[];
    onQueueChange: (queue: QueueItem[]) => void;
}

interface SearchResult {
    pageid: number;
    title: string;
    snippet: string;
}

export interface QueueItem {
    pageid: number;
    title: string;
    status: 'pending' | 'downloading' | 'done' | 'error';
    content?: string;
    error?: string;
}

// Extracts the API base URL from various wiki URL formats
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
    // e.g. https://en.wikipedia.org/wiki/Saber -> https://en.wikipedia.org/w/api.php
    if (url.includes('/wiki/')) {
        const base = url.split('/wiki/')[0];
        return base + '/w/api.php';
    }

    // Fallback: just append /api.php
    return url + '/api.php';
}

// Strips HTML tags and cleans wiki text
function cleanHtml(html: string): string {
    const doc = new DOMParser().parseFromString(html, 'text/html');

    // Remove unwanted elements
    const removeSelectors = [
        'script', 'style', 'table.infobox', '.navbox', '.mw-editsection',
        '.reference', '.reflist', '.toc', '.mw-empty-elt', 'sup.reference',
        '.noprint', '.mbox-small', '.ambox', '.metadata', '.sistersitebox',
        '.side-box', '.portal', 'figure', '.thumb', '.gallery',
    ];
    removeSelectors.forEach(sel => {
        doc.querySelectorAll(sel).forEach(el => el.remove());
    });

    // Get text content and clean up whitespace
    let text = doc.body.textContent || '';
    text = text.replace(/\[\d+\]/g, ''); // Remove [1], [2] etc.
    text = text.replace(/\n{3,}/g, '\n\n'); // Collapse multiple newlines
    text = text.replace(/[ \t]+/g, ' '); // Collapse spaces
    text = text.trim();
    return text;
}

export async function searchWiki(apiUrl: string, query: string): Promise<SearchResult[]> {
    const params = new URLSearchParams({
        action: 'query',
        list: 'search',
        srsearch: query,
        srlimit: '50',
        format: 'json',
        origin: '*',
    });

    const resp = await fetch(`${apiUrl}?${params}`);
    const data = await resp.json();
    return (data.query?.search || []).map((r: any) => ({
        pageid: r.pageid,
        title: r.title,
        snippet: r.snippet,
    }));
}

export async function fetchPageContent(apiUrl: string, pageid: number): Promise<string> {
    const params = new URLSearchParams({
        action: 'parse',
        pageid: pageid.toString(),
        prop: 'text',
        format: 'json',
        origin: '*',
    });

    const resp = await fetch(`${apiUrl}?${params}`);
    const data = await resp.json();
    const html = data.parse?.text?.['*'] || '';
    return cleanHtml(html);
}

async function fetchCategoryMembers(apiUrl: string, category: string): Promise<SearchResult[]> {
    const params = new URLSearchParams({
        action: 'query',
        list: 'categorymembers',
        cmtitle: category.startsWith('Category:') ? category : `Category:${category}`,
        cmlimit: '50',
        format: 'json',
        origin: '*',
    });

    const resp = await fetch(`${apiUrl}?${params}`);
    const data = await resp.json();
    return (data.query?.categorymembers || []).map((m: any) => ({
        pageid: m.pageid,
        title: m.title,
        snippet: '',
    }));
}

export const WikiScraper: FC<WikiScraperProps> = ({ onFilesAdd, wikiUrl, onWikiUrlChange, queue, onQueueChange }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [searchError, setSearchError] = useState('');
    const [mode, setMode] = useState<'search' | 'category'>('search');

    const apiUrl = getApiUrl(wikiUrl);

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setSearching(true);
        setSearchError('');
        setSearchResults([]);

        try {
            let results: SearchResult[];
            if (mode === 'category') {
                results = await fetchCategoryMembers(apiUrl, searchQuery);
            } else {
                results = await searchWiki(apiUrl, searchQuery);
            }
            setSearchResults(results);
            if (results.length === 0) {
                setSearchError('No results found.');
            }
        } catch (e: any) {
            setSearchError(`Search failed: ${e.message}. Check the wiki URL.`);
        }
        setSearching(false);
    };

    const addToQueue = (result: SearchResult) => {
        if (queue.find(q => q.pageid === result.pageid)) return;
        onQueueChange([...queue, { pageid: result.pageid, title: result.title, status: 'pending' }]);
    };

    const addAllToQueue = () => {
        const newItems = searchResults
            .filter(r => !queue.find(q => q.pageid === r.pageid))
            .map(r => ({ pageid: r.pageid, title: r.title, status: 'pending' as const }));
        onQueueChange([...queue, ...newItems]);
    };

    const removeFromQueue = (pageid: number) => {
        onQueueChange(queue.filter(q => q.pageid !== pageid));
    };

    const clearQueue = () => onQueueChange([]);

    const downloadAll = async () => {
        if (downloading) return;
        setDownloading(true);

        const pendingItems = queue.filter(q => q.status === 'pending');

        for (const item of pendingItems) {
            onQueueChange(queue.map(q =>
                q.pageid === item.pageid ? { ...q, status: 'downloading' } : q
            ));

            try {
                const content = await fetchPageContent(apiUrl, item.pageid);
                onQueueChange(queue.map(q =>
                    q.pageid === item.pageid ? { ...q, status: 'done', content } : q
                ));
            } catch (e: any) {
                onQueueChange(queue.map(q =>
                    q.pageid === item.pageid ? { ...q, status: 'error', error: e.message } : q
                ));
            }
        }

        setDownloading(false);
    };

    const saveToFiles = () => {
        const doneItems = queue.filter(q => q.status === 'done' && q.content);
        if (doneItems.length === 0) return;

        const newFiles: KBFile[] = doneItems.map(item => ({
            id: `wiki-${item.pageid}-${Date.now()}`,
            name: `${item.title}.txt`,
            content: item.content!,
            enabled: true,
            tokens: Math.floor(item.content!.length / 4),
        }));

        onFilesAdd(newFiles);
        // Remove saved items from queue
        onQueueChange(queue.filter(q => q.status !== 'done'));
    };

    const doneCount = queue.filter(q => q.status === 'done').length;
    const pendingCount = queue.filter(q => q.status === 'pending').length;

    return (
        <div className="page-content">
            {/* Wiki URL & Search */}
            <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                <div className="card-body">
                    <h3 style={{ margin: 0, marginBottom: 'var(--space-md)' }}>🌐 Wiki Scraper</h3>
                    <p style={{ margin: 0, marginBottom: 'var(--space-md)', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        Scrape pages from Fandom, Wikipedia, and other MediaWiki sites. Pages are downloaded as plain text files.
                    </p>

                    {/* Wiki URL */}
                    <div style={{ marginBottom: 'var(--space-md)' }}>
                        <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-xs)', display: 'block' }}>
                            Wiki URL
                        </label>
                        <input
                            type="text"
                            className="input"
                            value={wikiUrl}
                            onChange={e => onWikiUrlChange(e.target.value)}
                            placeholder="https://typemoon.fandom.com"
                            style={{ width: '100%' }}
                        />
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            API: {apiUrl}
                        </span>
                    </div>

                    {/* Search Mode Toggle */}
                    <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
                        <button
                            className={`btn btn-sm ${mode === 'search' ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setMode('search')}
                        >
                            🔍 Search
                        </button>
                        <button
                            className={`btn btn-sm ${mode === 'category' ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setMode('category')}
                        >
                            📁 Category
                        </button>
                    </div>

                    {/* Search Input */}
                    <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                        <input
                            type="text"
                            className="input"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder={mode === 'search' ? 'Search pages...' : 'Category name (e.g. Characters)'}
                            style={{ flex: 1 }}
                            onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
                        />
                        <button
                            className="btn btn-primary"
                            onClick={handleSearch}
                            disabled={searching || !searchQuery.trim()}
                        >
                            {searching ? '⏳...' : mode === 'search' ? '🔍 Search' : '📁 List'}
                        </button>
                    </div>

                    {searchError && (
                        <div style={{ marginTop: 'var(--space-sm)', color: 'var(--color-error)', fontSize: '0.85rem' }}>
                            {searchError}
                        </div>
                    )}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)' }}>
                {/* Search Results */}
                <div className="card">
                    <div className="card-body">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                            <h4 style={{ margin: 0 }}>
                                Results ({searchResults.length})
                            </h4>
                            {searchResults.length > 0 && (
                                <button className="btn btn-ghost btn-sm" onClick={addAllToQueue}>
                                    ➕ Add All
                                </button>
                            )}
                        </div>

                        <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                            {searchResults.length === 0 && !searching && (
                                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 'var(--space-xl)' }}>
                                    Search for pages to scrape
                                </p>
                            )}
                            {searchResults.map(result => {
                                const inQueue = !!queue.find(q => q.pageid === result.pageid);
                                return (
                                    <div
                                        key={result.pageid}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: 'var(--space-sm) var(--space-md)',
                                            borderBottom: '1px solid var(--border-subtle)',
                                            opacity: inQueue ? 0.5 : 1,
                                        }}
                                    >
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{result.title}</div>
                                            {result.snippet && (
                                                <div
                                                    style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}
                                                    dangerouslySetInnerHTML={{ __html: result.snippet }}
                                                />
                                            )}
                                        </div>
                                        <button
                                            className="btn btn-ghost btn-sm"
                                            onClick={() => addToQueue(result)}
                                            disabled={inQueue}
                                            style={{ marginLeft: 'var(--space-sm)', flexShrink: 0 }}
                                        >
                                            {inQueue ? '✓' : '➕'}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Download Queue */}
                <div className="card">
                    <div className="card-body">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                            <h4 style={{ margin: 0 }}>
                                Queue ({queue.length})
                            </h4>
                            <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                                {doneCount > 0 && (
                                    <button className="btn btn-primary btn-sm" onClick={saveToFiles}>
                                        💾 Save {doneCount} to Files
                                    </button>
                                )}
                                {pendingCount > 0 && (
                                    <button
                                        className="btn btn-primary btn-sm"
                                        onClick={downloadAll}
                                        disabled={downloading}
                                    >
                                        {downloading ? '⏳ Downloading...' : `⬇️ Download ${pendingCount}`}
                                    </button>
                                )}
                                {queue.length > 0 && (
                                    <button className="btn btn-ghost text-danger btn-sm" onClick={clearQueue} disabled={downloading}>
                                        🗑️ Clear All
                                    </button>
                                )}
                            </div>
                        </div>

                        <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                            {queue.length === 0 && (
                                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 'var(--space-xl)' }}>
                                    Add pages from search results
                                </p>
                            )}
                            {queue.map(item => (
                                <div
                                    key={item.pageid}
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: 'var(--space-sm) var(--space-md)',
                                        borderBottom: '1px solid var(--border-subtle)',
                                    }}
                                >
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{item.title}</div>
                                        <div style={{ fontSize: '0.8rem', marginTop: '2px' }}>
                                            {item.status === 'pending' && <span style={{ color: 'var(--text-muted)' }}>⏸ Pending</span>}
                                            {item.status === 'downloading' && <span style={{ color: 'var(--color-primary)' }}>⏳ Downloading...</span>}
                                            {item.status === 'done' && (
                                                <span style={{ color: 'var(--color-success)' }}>
                                                    ✅ {item.content ? `${Math.floor(item.content.length / 4)} tokens` : 'Done'}
                                                </span>
                                            )}
                                            {item.status === 'error' && <span style={{ color: 'var(--color-error)' }}>❌ {item.error}</span>}
                                        </div>
                                    </div>
                                    <button
                                        className="btn btn-ghost btn-sm"
                                        onClick={() => removeFromQueue(item.pageid)}
                                        disabled={item.status === 'downloading'}
                                        style={{ marginLeft: 'var(--space-sm)', flexShrink: 0 }}
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
