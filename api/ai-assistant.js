// دالة Vercel الوسيطة (Serverless Function) — تستقبل طلبات من التطبيق وتستدعي Gemini API
// بمفتاح مجاني (بدون بطاقة) مخزّن في متغيرات بيئة Vercel، لا يظهر أبدًا في كود الواجهة.
//
// يجب إضافة متغير بيئة اسمه GEMINI_API_KEY في إعدادات المشروع على Vercel
// (Settings → Environment Variables) قبل أن تعمل هذه الدالة.
// احصل على المفتاح مجانًا من: https://aistudio.google.com/app/apikey

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "مفتاح الذكاء الاصطناعي غير مُعدّ على الخادم. أضف GEMINI_API_KEY في إعدادات Vercel." });
    return;
  }

  try {
    const { contents, systemInstruction, tools } = req.body;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: contents || [],
        systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
        tools: tools || undefined,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      res.status(response.status).json({ error: data.error?.message || "حدث خطأ من خدمة الذكاء الاصطناعي" });
      return;
    }

    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: "تعذّر الاتصال بخدمة الذكاء الاصطناعي: " + e.message });
  }
}
