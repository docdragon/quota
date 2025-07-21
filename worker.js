// @ts-nocheck
// Mã nguồn Cloudflare Worker đã được sửa lỗi và cải thiện
// Sao chép toàn bộ nội dung file này và dán vào trình "Quick Edit" trên Cloudflare.
import { GoogleGenAI } from "https://esm.sh/@google/genai@^1.10.0";

// Xử lý CORS để trình duyệt không chặn request
function getCorsHeaders(request) {
    const headers = new Headers();
    // Trong môi trường production, bạn nên thay thế '*' bằng domain của bạn
    // Ví dụ: headers.set("Access-Control-Allow-Origin", "https://your-app.pages.dev");
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
    return headers;
}

// Xử lý request OPTIONS (preflight)
function handleOptions(request) {
    return new Response(null, { headers: getCorsHeaders(request) });
}

export default {
    async fetch(request, env, ctx) {
        // Luôn xử lý OPTIONS trước
        if (request.method === "OPTIONS") {
            return handleOptions(request);
        }

        const headers = getCorsHeaders(request);
        headers.set("Content-Type", "application/json");

        if (request.method !== "POST") {
            return new Response(JSON.stringify({ error: "Method Not Allowed. Expected POST." }), { status: 405, headers });
        }

        if (!request.headers.get("Content-Type")?.includes("application/json")) {
            return new Response(JSON.stringify({ error: "Unsupported Media Type. Expected Content-Type: application/json." }), { status: 415, headers });
        }

        try {
            const body = await request.json();
            const { prompt } = body;

            if (!prompt) {
                return new Response(JSON.stringify({ error: 'Missing "prompt" in request body' }), {
                    status: 400,
                    headers,
                });
            }

            if (!env.GEMINI_API_KEY) {
                const errorMsg = "Chưa cấu hình biến môi trường GEMINI_API_KEY trong Worker. Vui lòng vào Settings > Variables và thêm khóa API của bạn.";
                return new Response(JSON.stringify({ error: errorMsg }), {
                    status: 500,
                    headers,
                });
            }

            const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

            const genAIResponse = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
            });

            const responseBody = JSON.stringify({ text: genAIResponse.text });
            return new Response(responseBody, { status: 200, headers });

        } catch (e) {
            console.error(e);
            return new Response(JSON.stringify({ error: e.message }), {
                status: 500,
                headers,
            });
        }
    },
};
