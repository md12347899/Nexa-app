// دالة Vercel الوسيطة للذكاء الاصطناعي (Gemini API)
// احصل على مفتاح مجاني من: https://aistudio.google.com/app/apikey
// ثم أضفه في Vercel Settings → Environment Variables باسم: GEMINI_API_KEY

export default async function handler(req, res) {
  // السماح بطلبات CORS من التطبيق
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "مفتاح الذكاء الاصطناعي غير مُعدّ على الخادم. أضف GEMINI_API_KEY في إعدادات Vercel." });
    return;
  }

  try {
    const { contents, systemInstruction, tools } = req.body;

    const body = { contents: contents || [] };
    if (systemInstruction) body.systemInstruction = { parts: [{ text: systemInstruction }] };
    if (tools) body.tools = tools;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    );

    const data = await response.json();
    if (!response.ok) {
      res.status(response.status).json({ error: data.error?.message || "خطأ من خدمة Gemini" });
      return;
    }
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: "تعذّر الاتصال بخدمة الذكاء الاصطناعي: " + e.message });
  }
}
