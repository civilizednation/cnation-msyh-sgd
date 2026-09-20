// Firebase Storage PDF를 서버에서 받아 동일 출처로 전달한다.
// 브라우저 PDF.js의 CORS 문제를 피하기 위한 읽기 전용 프록시다.

const ALLOWED_HOSTS = new Set([
    'firebasestorage.googleapis.com',
    'storage.googleapis.com'
]);

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
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
            headers: { 'Accept': 'application/pdf,*/*' },
            redirect: 'follow'
        });

        if (!upstream.ok) {
            const detail = await upstream.text().catch(() => '');
            res.status(upstream.status).json({
                error: 'Upstream download failed',
                detail: detail.slice(0, 200)
            });
            return;
        }

        const contentType = upstream.headers.get('content-type') || 'application/pdf';
        const contentLength = upstream.headers.get('content-length');
        const buffer = Buffer.from(await upstream.arrayBuffer());

        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
        if (contentLength) res.setHeader('Content-Length', contentLength);
        res.status(200).send(buffer);
    } catch (e) {
        res.status(502).json({ error: 'PDF proxy error', detail: String(e).slice(0, 200) });
    }
};
