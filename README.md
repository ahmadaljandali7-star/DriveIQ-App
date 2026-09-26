# DriveIQ 🚗

تطبيق لتحليل القيادة: يتتبع رحلاتك عبر GPS، يحسب السرعة والمسافة، يكتشف الفرملة المفاجئة والتسارع الحاد وتجاوز السرعة، ويعطيك نقاطاً لكل رحلة. كل البيانات محفوظة على الجهاز.

## التثبيت

كل دفعة (push) إلى GitHub تبني التطبيق تلقائياً عبر GitHub Actions وتنشر الملفات في صفحة **Releases** بالمستودع.

### أندرويد
1. افتح صفحة **Releases** من هاتفك ونزّل `DriveIQ.apk`.
2. افتح الملف، واسمح بـ "تثبيت التطبيقات من مصادر غير معروفة" عند الطلب.
3. عند التشغيل امنح صلاحية الموقع واختر **"السماح طوال الوقت"** ليستمر التتبع في الخلفية.

### آيفون
أبل لا تسمح بتثبيت تطبيق بدون توقيع، لذلك يوجد خياران:

**أ) مجاناً (Sideloadly / AltStore):**
1. نزّل `DriveIQ-unsigned.ipa` من صفحة **Releases** على الكمبيوتر.
2. ثبّت [Sideloadly](https://sideloadly.io) أو [AltStore](https://altstore.io) وصِل الآيفون بالكابل.
3. اسحب ملف الـ IPA وسجّل بحساب Apple ID الخاص بك، فيوقّعه ويثبّته.
4. على الآيفون: الإعدادات ← عام ← VPN وإدارة الجهاز ← ثق بالمطوّر. (مع حساب مجاني يجب إعادة التوقيع كل 7 أيام.)

**ب) رسمياً (حساب Apple Developer مدفوع):**
```bash
npm install -g eas-cli
eas login
eas build -p ios --profile preview     # للتثبيت المباشر على أجهزة مسجلة
eas build -p ios --profile production && eas submit -p ios   # TestFlight / App Store
```

## التطوير

```bash
npm install
npx expo start          # شغّل على المحاكي أو جهاز فيه development build
npx tsc --noEmit        # فحص الأنواع
```

- الشاشات في `app/` (Expo Router).
- مهمة تتبع الموقع في الخلفية معرفة في `lib/locationTask.ts` ويتم تحميلها من `index.js` قبل بدء التطبيق.
- مجلدات `android/` و `ios/` تُولَّد تلقائياً بـ `npx expo prebuild` ولا تُحفظ في المستودع.
