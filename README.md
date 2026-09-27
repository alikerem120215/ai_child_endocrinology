# 🩺 AI Child Endocrinology — Çocuk Endokrinoloji Teşhis & Takip Asistanı

Çocuk sağlığı ve hastalıkları ile çocuk endokrinolojisi alanında hekimlerin büyüme eğrilerini, boy/kilo persentillerini, kemik yaşını ve hormon parametrelerini hızlıca değerlendirmesini sağlayan **Google Gemini AI** destekli klinik karar destek web uygulaması.

---

## 🌟 Öne Çıkan Özellikler
- **Yapılandırılmış Veri Çıkarımı (Structured JSON Extraction):** Hekimin girdiği serbest metinli hasta epikrizinden boy, kilo, doğum haftası, puberte evresi ve tahlil sonuçlarını Pydantic/TypedDict şemasıyla hatasız çeker.
- **Klinik Değerlendirme:** Büyüme geriliği, erken/geç ergenlik, tiroid ve büyüme hormonu anormalliklerine dair klinik ipuçları sunar.
- **SQLite Yerel Veritabanı:** Hasta kayıtlarını güvenli, yerel ve KVKK uyumlu biçimde saklar.
- **Modern Web Paneli:** Flask ve Bootstrap 5 ile hekim dostu, hızlı ve responsive arayüz.

---

## 🛠️ Kurulum & Çalıştırma

1. **Gereksinimleri yükleyin:**
   ```bash
   pip install flask google-generativeai python-dotenv typing-extensions
   ```

2. **API Anahtarınızı Ayarlayın:**
   `.env` dosyasında veya ortam değişkeninde:
   ```bash
   export GEMINI_API_KEY="your_gemini_api_key"
   ```

3. **Uygulamayı başlatın:**
   ```bash
   python3 app.py
   ```
   Tarayıcınızda `http://127.0.0.1:5000` adresine gidin.
