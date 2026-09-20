// Firebase Storage의 PDF를 서버에서 받아 같은 Vercel 도메인으로 전달한다.
// 허용된 Google Storage 호스트의 읽기 요청만 처리한다.

const ALLOWED_HOSTS = new Set([
    'firebasestorage.googleapis.com',
    'storage.googleapis.com'
]);

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }

    const rawUrl = typeof req.query?.url === 'string' ? req.query.url : '';
    if (!rawUrl) {
        res.status(400).json({ error: 'Missing url' });
        return;
    }

    let target;
    try {
        target = new URL(rawUrl);
    } catch {
        res.status(400).json({ error: 'Invalid url' });
        return;
    }

    if (target.protocol !== 'https:' || !ALLOWED_HOSTS.has(target.hostname)) {
        res.status(403).json({ error: 'Host not allowed' });
        return;
    }

    try {
        const upstream = await fetch(target.toString(), {
            headers: { Accept: 'application/pdf,*/*' },
            redirect: 'follow'
        });

        if (!upstream.ok) {
            res.status(upstream.status).json({ error: 'Upstream download failed' });
            return;
        }

        const contentType = upstream.headers.get('content-type') || '';
        if (!contentType.toLowerCase().includes('application/pdf')) {
            res.status(502).json({ error: 'Upstream response is not a PDF' });
            return;
        }

        const buffer = Buffer.from(await upstream.arrayBuffer());
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Length', String(buffer.length));
        res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=600');
        res.status(200).send(buffer);
    } catch (error) {
        console.error('PDF proxy error:', error);
        res.status(502).json({ error: 'PDF proxy error' });
    }
};
