// Vercel 서버리스 함수: 접속한 클라이언트의 IP/기기/브라우저를 Firestore에 기록한다.
// 정적 페이지(index.html)는 브라우저에서 자신의 IP를 알 수 없기 때문에,
// 요청이 실제로 거쳐가는 이 서버 쪽에서 헤더를 읽어 기록한다.

const FIREBASE_API_KEY = "AIzaSyCTwOAC_LrrKH8CKepUOTf0pyd9qRv4y_8"; // index.html에도 이미 공개되어 있는 Firebase 웹 API 키
const FIRESTORE_PROJECT_ID = "cnation-project";
const VISITS_COLLECTION = "cnation-msyh-sgd-visits";

function parseUserAgent(ua) {
    ua = ua || '';
    let browser = 'Unknown';
    if (/Edg\//.test(ua)) browser = 'Edge';
    else if (/CriOS\//.test(ua)) browser = 'Chrome(iOS)';
    else if (/FxiOS\//.test(ua)) browser = 'Firefox(iOS)';
    else if (/MicroMessenger/i.test(ua)) browser = 'WeChat';
    else if (/KAKAOTALK/i.test(ua)) browser = 'KakaoTalk';
    else if (/NAVER\(/i.test(ua)) browser = 'Naver App';
    else if (/OPR\//.test(ua)) browser = 'Opera';
    else if (/Chrome\//.test(ua)) browser = 'Chrome';
    else if (/Firefox\//.test(ua)) browser = 'Firefox';
    else if (/Version\/.*Safari\//.test(ua)) browser = 'Safari';
    else if (/Safari\//.test(ua)) browser = 'Safari';

    let device = 'Unknown';
    if (/iPhone/.test(ua)) device = 'iPhone';
    else if (/iPad/.test(ua)) device = 'iPad';
    else if (/Android/.test(ua)) device = /Mobile/.test(ua) ? 'Android Phone' : 'Android Tablet';
    else if (/Macintosh/.test(ua)) device = 'Mac';
    else if (/Windows/.test(ua)) device = 'Windows PC';
    else if (/CrOS/.test(ua)) device = 'Chromebook';
    else if (/Linux/.test(ua)) device = 'Linux PC';

    return { browser, device };
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }
    try {
        const xRealIp = req.headers['x-real-ip'];
        const xForwardedFor = req.headers['x-forwarded-for'];
        const ip = xRealIp || (xForwardedFor ? xForwardedFor.split(',')[0].trim() : null) || req.socket?.remoteAddress || 'unknown';
        const ua = req.headers['user-agent'] || '';
        const { browser, device } = parseUserAgent(ua);

        const body = {
            fields: {
                ip: { stringValue: String(ip).slice(0, 100) },
                ua: { stringValue: ua.slice(0, 300) },
                browser: { stringValue: browser },
                device: { stringValue: device },
                timestamp: { timestampValue: new Date().toISOString() },
            },
        };

        const url = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/${VISITS_COLLECTION}?key=${FIREBASE_API_KEY}`;
        const firestoreRes = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!firestoreRes.ok) {
            const errText = await firestoreRes.text().catch(() => '');
            res.status(200).json({ ok: false, detail: errText.slice(0, 200) });
            return;
        }
        res.status(204).end();
    } catch (e) {
        // 접속 기록 실패가 사용자 경험을 막으면 안 되므로 항상 200으로 응답한다.
        res.status(200).json({ ok: false, error: String(e) });
    }
};
