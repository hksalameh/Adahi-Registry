
"use client";

// This is a diagnostic page.
// It does NOT include any authentication logic or redirects.
// Its only purpose is to see if a very basic Next.js page can render.

export default function HomePage() {
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', textAlign: 'center', direction: 'rtl' }}>
      <h1>صفحة اختبار بسيطة جدًا</h1>
      <p style={{color: 'blue', fontSize: '18px'}}>إذا رأيت هذه الرسالة، فهذا يعني أن Next.js قادر على عرض هذه الصفحة البسيطة.</p>
      <p>هذا يعني أن المشكلة الأساسية التي تمنع التطبيق من العمل بشكل كامل تكمن في:</p>
      <ul>
        <li>المنطق الموجود في `AuthContext` (ربما لا يزال لا يضبط حالة التحميل بشكل صحيح).</li>
        <li>أو، أن الصفحات التي يتم التوجيه إليها (مثل `/dashboard` أو `/admin`) بها خطأ يمنع تحميلها (مما قد يكون سبب خطأ `502` الذي رأيناه سابقًا).</li>
      </ul>
      <p>الرجاء التحقق من وحدة التحكم (Console) في المتصفح بحثًا عن أي أخطاء أخرى، وإعادة تشغيل خادم التطوير.</p>
      <p style={{marginTop: '20px', border: '1px solid red', padding: '10px'}}>
        <strong>ملاحظة:</strong> هذه الصفحة لا تقوم بأي عمليات مصادقة أو توجيه. هي فقط للعرض.
      </p>
    </div>
  );
}
