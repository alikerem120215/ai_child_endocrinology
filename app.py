import os
import sqlite3
import json
from flask import Flask, request, jsonify, render_template
import google.generativeai as genai
import typing_extensions as typing
from dotenv import load_dotenv

# Load environment variables (e.g. from .env file if present)
load_dotenv()

app = Flask(__name__)

# Configure Gemini API
api_key = os.environ.get("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)
else:
    print("UYARI: GEMINI_API_KEY bulunamadı. Yapay zeka özellikleri çalışmayabilir.")

# Database file location
DATABASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'database.db')

# Typing schemas for Gemini Structured Output
class ExtractedData(typing.TypedDict):
    age: typing.Optional[int]
    gender: typing.Optional[str]  # "Erkek" veya "Kız"
    height: typing.Optional[str]  # e.g., "125 cm"
    weight: typing.Optional[str]  # e.g., "28 kg"
    diagnosis: typing.Optional[str]  # e.g., "Boy kısalığı", "Halsizlik"
    notes: typing.Optional[str]  # Klinik notlar, bulgular veya takip planı

class GeminiResponse(typing.TypedDict):
    reply: str
    extracted_data: ExtractedData

# System instructions to anchor Gemini's medical persona and data extraction behavior
system_instruction = (
    "Sen çocuk endokrinolojisi uzmanı olan bir hekime yardımcı olan, alanında uzman bir Yapay Zeka Klinik Danışmanısın. "
    "Doktor seninle hastaları hakkında konuşacaktır. Görevin, doktorun mesajlarına çocuk endokrinolojisi bağlamında "
    "bilimsel, tıbbi, yönlendirici ve profesyonel cevaplar vermektir.\n\n"
    "Ayrıca, konuşma esnasında geçen hasta bilgilerini (yaş, cinsiyet, boy, kilo, ön tanı/şikayet ve önemli notlar) tespit edip "
    "yapılandırılmış JSON formatında çıkartmalısın. Eğer bu bilgilerden biri konuşmada geçmiyorsa veya belirsizse, o alanı "
    "null bırakmalısın. Sadece kesinleşen veya doktor tarafından doğrudan belirtilen/güncellenen bilgileri doldur.\n\n"
    "Önemli kurallar:\n"
    "1. Cinsiyet alanı yalnızca 'Erkek' veya 'Kız' değerlerini almalıdır.\n"
    "2. Boy ve kilo alanlarını birimleri ile (örn: '128 cm', '32 kg') kaydet.\n"
    "3. Tanı/Şikayet kısmını özetle (örn: 'Boy kısalığı', 'Erken püberte şüphesi').\n"
    "4. Tıbbi cevabını (reply) her zaman Türkçe, profesyonel bir üslupla ve Markdown formatında ver."
)

def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create patients table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS patients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            gender TEXT DEFAULT NULL,
            age INTEGER DEFAULT NULL,
            height TEXT DEFAULT NULL,
            weight TEXT DEFAULT NULL,
            diagnosis TEXT DEFAULT NULL,
            notes TEXT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Create messages table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER NOT NULL,
            sender TEXT NOT NULL, -- 'doctor' veya 'ai'
            text TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE
        )
    ''')
    
    conn.commit()
    conn.close()

# Initialize DB when module loads
init_db()

@app.route('/')
def index():
    return render_template('index.html')

# API: Get all patients
@app.route('/api/patients', methods=['GET'])
def get_patients():
    conn = get_db_connection()
    patients = conn.execute('SELECT * FROM patients ORDER BY id DESC').fetchall()
    conn.close()
    return jsonify([dict(row) for row in patients])

# API: Add a new patient
@app.route('/api/patients', methods=['POST'])
def add_patient():
    data = request.json
    name = data.get('name')
    if not name or not name.strip():
        return jsonify({"error": "Hasta adı soyadı gereklidir."}), 400
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('INSERT INTO patients (name) VALUES (?)', (name.strip(),))
    conn.commit()
    patient_id = cursor.lastrowid
    
    patient = conn.execute('SELECT * FROM patients WHERE id = ?', (patient_id,)).fetchone()
    conn.close()
    
    return jsonify(dict(patient)), 201

# API: Get a single patient
@app.route('/api/patients/<int:patient_id>', methods=['GET'])
def get_patient(patient_id):
    conn = get_db_connection()
    patient = conn.execute('SELECT * FROM patients WHERE id = ?', (patient_id,)).fetchone()
    conn.close()
    if not patient:
        return jsonify({"error": "Hasta bulunamadı."}), 404
    return jsonify(dict(patient))

# API: Delete a patient and their messages
@app.route('/api/patients/<int:patient_id>', methods=['DELETE'])
def delete_patient(patient_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Verify patient exists
    patient = conn.execute('SELECT * FROM patients WHERE id = ?', (patient_id,)).fetchone()
    if not patient:
        conn.close()
        return jsonify({"error": "Hasta bulunamadı."}), 404
        
    # Explicitly clear message history, then delete patient
    cursor.execute('DELETE FROM messages WHERE patient_id = ?', (patient_id,))
    cursor.execute('DELETE FROM patients WHERE id = ?', (patient_id,))
    conn.commit()
    conn.close()
    
    return jsonify({"status": "success", "message": "Hasta ve tüm geçmiş sohbetleri başarıyla silindi."})

# API: Get chat messages for a patient
@app.route('/api/patients/<int:patient_id>/messages', methods=['GET'])
def get_messages(patient_id):
    conn = get_db_connection()
    messages = conn.execute('SELECT * FROM messages WHERE patient_id = ? ORDER BY id ASC', (patient_id,)).fetchall()
    conn.close()
    return jsonify([dict(row) for row in messages])

# API: Send message to Gemini and extract patient details
@app.route('/api/patients/<int:patient_id>/messages', methods=['POST'])
def send_message(patient_id):
    data = request.json or {}
    message_text = data.get('text')
    if not message_text or not message_text.strip():
        return jsonify({"error": "Mesaj içeriği boş olamaz."}), 400
    
    conn = get_db_connection()
    patient = conn.execute('SELECT * FROM patients WHERE id = ?', (patient_id,)).fetchone()
    if not patient:
        conn.close()
        return jsonify({"error": "Hasta bulunamadı."}), 404
    
    # 1. Save doctor's message to DB
    cursor = conn.cursor()
    cursor.execute('INSERT INTO messages (patient_id, sender, text) VALUES (?, ?, ?)',
                   (patient_id, 'doctor', message_text.strip()))
    conn.commit()
    
    # 2. Retrieve history for context
    history_rows = conn.execute('SELECT sender, text FROM messages WHERE patient_id = ? ORDER BY id ASC', (patient_id,)).fetchall()
    
    history_str = ""
    # Exclude the very last row which is the user's current message, as we feed that as prompt
    for row in history_rows[:-1]:
        sender_label = "Doktor" if row['sender'] == 'doctor' else "Yapay Zeka Danışmanı"
        history_str += f"{sender_label}: {row['text']}\n"
    
    profile_str = (
        f"Mevcut Hasta Bilgileri:\n"
        f"- İsim: {patient['name']}\n"
        f"- Yaş: {patient['age'] if patient['age'] else 'Bilinmiyor'}\n"
        f"- Cinsiyet: {patient['gender'] if patient['gender'] else 'Bilinmiyor'}\n"
        f"- Boy: {patient['height'] if patient['height'] else 'Bilinmiyor'}\n"
        f"- Kilo: {patient['weight'] if patient['weight'] else 'Bilinmiyor'}\n"
        f"- Tanı/Şikayet: {patient['diagnosis'] if patient['diagnosis'] else 'Bilinmiyor'}\n"
        f"- Notlar: {patient['notes'] if patient['notes'] else 'Bilinmiyor'}\n"
    )
    
    full_prompt = (
        f"{profile_str}\n"
        f"Geçmiş Sohbet:\n{history_str if history_str else '(Henüz geçmiş konuşma yok)'}\n"
        f"Yeni Doktor Mesajı (Bunu yanıtla ve yeni verileri çıkar): {message_text}\n"
    )
    
    ai_reply = ""
    extracted_data = {}
    
    # 3. Resolve API Key (header has priority, fallback to environment variable)
    req_api_key = request.headers.get('X-Gemini-API-Key')
    resolved_api_key = req_api_key.strip() if req_api_key and req_api_key.strip() else os.environ.get("GEMINI_API_KEY")

    if resolved_api_key:
        try:
            # Configure genai dynamically with the resolved API key
            genai.configure(api_key=resolved_api_key)
            
            model = genai.GenerativeModel(
                model_name="gemini-2.5-flash",
                system_instruction=system_instruction,
                generation_config={
                    "response_mime_type": "application/json",
                    "response_schema": GeminiResponse
                }
            )
            response = model.generate_content(full_prompt)
            
            # Parse Structured Output JSON
            response_json = json.loads(response.text)
            ai_reply = response_json.get('reply', '')
            extracted_data = response_json.get('extracted_data', {})
        except Exception as e:
            print(f"Gemini API Hatası: {e}")
            ai_reply = f"**Sistem Notu:** Gemini API Hatası oluştu. Lütfen girdiğiniz API anahtarının geçerliliğini ve internet bağlantınızı kontrol edin.\n\nHata detayı: {str(e)}"
            extracted_data = {}
    else:
        # Warning if no API key is supplied either in header or environment
        ai_reply = "**Sistem Notu:** Gemini API anahtarı bulunamadı. Lütfen sol taraftaki alana geçerli bir Gemini API Key girin."
        extracted_data = {}
    
    # 4. Save AI's response to DB
    cursor.execute('INSERT INTO messages (patient_id, sender, text) VALUES (?, ?, ?)',
                   (patient_id, 'ai', ai_reply))
    conn.commit()
    
    # 5. If any data was extracted, update patient details in DB
    if extracted_data:
        update_fields = []
        params = []
        
        for field in ['age', 'gender', 'height', 'weight', 'diagnosis', 'notes']:
            val = extracted_data.get(field)
            # Only update fields that are not null and not empty
            if val is not None and str(val).strip() != "" and str(val).lower() != 'none':
                update_fields.append(f"{field} = ?")
                params.append(val)
        
        if update_fields:
            params.append(patient_id)
            cursor.execute(f"UPDATE patients SET {', '.join(update_fields)} WHERE id = ?", params)
            conn.commit()
            
    # Retrieve the final updated patient record
    updated_patient = conn.execute('SELECT * FROM patients WHERE id = ?', (patient_id,)).fetchone()
    conn.close()
    
    return jsonify({
        "status": "success",
        "reply": ai_reply,
        "extracted_data": extracted_data,
        "patient": dict(updated_patient)
    })

if __name__ == '__main__':
    # Initialize DB (safety check)
    init_db()
    # Run server
    app.run(debug=True, port=5001)
