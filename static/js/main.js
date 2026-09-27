// State Management
let allPatients = [];
let activePatientId = null;

// DOM Elements
const elements = {
    // Modal Elements
    openModalBtn: document.getElementById('btn-open-modal'),
    closeModalBtn: document.getElementById('btn-close-modal'),
    cancelModalBtn: document.getElementById('btn-cancel-modal'),
    modal: document.getElementById('add-patient-modal'),
    addPatientForm: document.getElementById('add-patient-form'),
    newPatientNameInput: document.getElementById('new-patient-name'),
    modalError: document.getElementById('modal-error'),

    // API Key Input
    apiKeyInput: document.getElementById('api-key-input'),
    toggleApiKeyBtn: document.getElementById('btn-toggle-api-key'),

    // Search & Sidebar
    patientSearch: document.getElementById('patient-search'),
    patientList: document.getElementById('patient-list'),
    patientCount: document.getElementById('patient-count'),

    // Chat Layout
    emptyChat: document.getElementById('empty-chat'),
    activeChat: document.getElementById('active-chat'),
    chatPatientName: document.getElementById('chat-patient-name'),

    // Quick Stats Badges
    statGender: document.getElementById('stat-gender'),
    statAge: document.getElementById('stat-age'),
    statHeight: document.getElementById('stat-height'),
    statWeight: document.getElementById('stat-weight'),

    // Chat Box Elements
    chatMessages: document.getElementById('chat-messages'),
    chatForm: document.getElementById('chat-form'),
    chatInput: document.getElementById('chat-input'),
    sendBtn: document.getElementById('btn-send')
};

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', () => {
    // Fetch and display initial patient directory
    loadPatients();
    
    // Load stored API Key from localStorage
    const storedApiKey = localStorage.getItem('gemini_api_key');
    if (storedApiKey) {
        elements.apiKeyInput.value = storedApiKey;
    }

    // Save API key on input change
    elements.apiKeyInput.addEventListener('input', (e) => {
        localStorage.setItem('gemini_api_key', e.target.value.trim());
    });

    // Eye icon toggle listener for show/hide API key
    elements.toggleApiKeyBtn.addEventListener('click', () => {
        if (elements.apiKeyInput.type === 'password') {
            elements.apiKeyInput.type = 'text';
            elements.toggleApiKeyBtn.innerHTML = `
                <svg class="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
            `;
        } else {
            elements.apiKeyInput.type = 'password';
            elements.toggleApiKeyBtn.innerHTML = `
                <svg class="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                </svg>
            `;
        }
    });
    
    // Modal Event Listeners
    elements.openModalBtn.addEventListener('click', openModal);
    elements.closeModalBtn.addEventListener('click', closeModal);
    elements.cancelModalBtn.addEventListener('click', closeModal);
    elements.modal.addEventListener('click', (e) => {
        if (e.target === elements.modal) closeModal();
    });
    elements.addPatientForm.addEventListener('submit', handleAddPatient);

    // Search Input Listener for Instant Dynamic Filtering
    elements.patientSearch.addEventListener('input', handleSearch);

    // Chat Form Submission Listener
    elements.chatForm.addEventListener('submit', handleSendMessage);
});

// ================= MODAL CONTROL FUNCTIONS =================
function openModal() {
    elements.modal.classList.add('active');
    elements.newPatientNameInput.focus();
    elements.modalError.style.display = 'none';
}

function closeModal() {
    elements.modal.classList.remove('active');
    elements.addPatientForm.reset();
    elements.modalError.style.display = 'none';
}

// Add Patient Submission API Call
async function handleAddPatient(e) {
    e.preventDefault();
    const name = elements.newPatientNameInput.value.trim();
    if (!name) return;

    try {
        const response = await fetch('/api/patients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });

        const data = await response.json();

        if (response.ok) {
            closeModal();
            // Reload all patients, and automatically select the newly created one!
            await loadPatients();
            selectPatient(data.id);
        } else {
            elements.modalError.textContent = data.error || 'Hasta eklenirken bir hata oluştu.';
            elements.modalError.style.display = 'block';
        }
    } catch (err) {
        console.error('Hasta ekleme hatası:', err);
        elements.modalError.textContent = 'Sunucuyla bağlantı kurulamadı.';
        elements.modalError.style.display = 'block';
    }
}

// ================= SIDEBAR & DIRECTORY FUNCTIONS =================
async function loadPatients() {
    try {
        const response = await fetch('/api/patients');
        if (response.ok) {
            allPatients = await response.json();
            renderPatientList(allPatients);
        }
    } catch (err) {
        console.error('Hastaları yükleme hatası:', err);
    }
}

function renderPatientList(patients) {
    elements.patientList.innerHTML = '';
    
    // Update total count badge
    elements.patientCount.textContent = `${patients.length} Hasta`;

    if (patients.length === 0) {
        elements.patientList.innerHTML = `
            <div class="list-placeholder">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                <p>Aranan kriterlere uygun hasta bulunamadı.</p>
            </div>
        `;
        return;
    }

    patients.forEach(patient => {
        const card = document.createElement('div');
        card.className = `patient-card ${patient.id === activePatientId ? 'active' : ''}`;
        card.dataset.id = patient.id;
        
        // Build metadata indicators
        const ageVal = patient.age ? `${patient.age} Yaş` : 'Belirtilmedi';
        const genderVal = patient.gender || 'Belirtilmedi';
        const heightVal = patient.height || 'Belirtilmedi';
        const weightVal = patient.weight || 'Belirtilmedi';
        
        // Diagnosis tag display
        const diagnosisMarkup = patient.diagnosis 
            ? `<div class="patient-diagnosis-tag" title="${patient.diagnosis}">
                <svg class="diagnosis-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
                <span>${patient.diagnosis}</span>
               </div>`
            : '';

        card.innerHTML = `
            <div class="card-header">
                <h3 class="patient-name" title="${patient.name}">${patient.name}</h3>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <span class="badge" style="font-size: 0.65rem;">ID: ${patient.id}</span>
                    <button class="btn-delete-patient" title="Hastayı Sil">
                        <svg class="delete-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                    </button>
                </div>
            </div>
            
            <div class="patient-meta-grid">
                <div class="meta-item">
                    <span class="meta-label">Cinsiyet:</span>
                    <span class="meta-value">${genderVal}</span>
                </div>
                <div class="meta-item">
                    <span class="meta-label">Yaş:</span>
                    <span class="meta-value">${ageVal}</span>
                </div>
                <div class="meta-item">
                    <span class="meta-label">Boy:</span>
                    <span class="meta-value">${heightVal}</span>
                </div>
                <div class="meta-item">
                    <span class="meta-label">Kilo:</span>
                    <span class="meta-value">${weightVal}</span>
                </div>
            </div>
            
            ${diagnosisMarkup}
            
            <div class="card-actions">
                <button class="btn-card-chat">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <span>Sohbeti Görüntüle</span>
                </button>
            </div>
        `;

        // Bind delete button listener with stopPropagation to prevent opening chat
        const deleteBtn = card.querySelector('.btn-delete-patient');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`"${patient.name}" isimli hastayı ve tüm sohbet geçmişini silmek istediğinize emin misiniz?`)) {
                deletePatient(patient.id);
            }
        });

        // Click event on card triggers selection
        card.addEventListener('click', (e) => {
            // Prevent duplicate clicks or bubbles if clicking button specifically
            selectPatient(patient.id);
        });

        elements.patientList.appendChild(card);
    });
}

// Delete Patient API Call
async function deletePatient(patientId) {
    try {
        const response = await fetch(`/api/patients/${patientId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            // Reset active chat if we deleted the open patient
            if (activePatientId === patientId) {
                activePatientId = null;
                elements.activeChat.style.display = 'none';
                elements.emptyChat.style.display = 'flex';
            }
            // Reload sidebar patient directory
            await loadPatients();
        } else {
            const data = await response.json();
            alert(data.error || 'Hasta silinirken bir hata oluştu.');
        }
    } catch (err) {
        console.error('Hasta silme hatası:', err);
        alert('Sunucuyla bağlantı kurulamadı.');
    }
}

// Filter Directory by Name (Client-side instant filter)
function handleSearch(e) {
    const query = e.target.value.toLowerCase().trim();
    if (!query) {
        renderPatientList(allPatients);
        return;
    }

    const filtered = allPatients.filter(p => p.name.toLowerCase().includes(query));
    renderPatientList(filtered);
}

// ================= ACTIVE CHAT & PATIENT MANAGEMENT =================
async function selectPatient(patientId) {
    if (activePatientId === patientId) return;

    activePatientId = patientId;

    // Highlight active card in sidebar
    document.querySelectorAll('.patient-card').forEach(card => {
        if (parseInt(card.dataset.id) === patientId) {
            card.classList.add('active');
        } else {
            card.classList.remove('active');
        }
    });

    // Reveal Chat Window
    elements.emptyChat.style.display = 'none';
    elements.activeChat.style.display = 'flex';
    elements.chatInput.focus();

    // Fetch and populate active patient data & conversation history
    await refreshPatientProfileHeader(patientId);
    await loadChatHistory(patientId);
}

// Fetch active profile metrics and update header stats
async function refreshPatientProfileHeader(patientId) {
    try {
        const response = await fetch(`/api/patients/${patientId}`);
        if (response.ok) {
            const patient = await response.json();
            
            // Name Header
            elements.chatPatientName.textContent = patient.name;

            // Stats Quick Badges
            updateBadge(elements.statGender, 'Cinsiyet', patient.gender);
            updateBadge(elements.statAge, 'Yaş', patient.age ? `${patient.age} Yaş` : null);
            updateBadge(elements.statHeight, 'Boy', patient.height);
            updateBadge(elements.statWeight, 'Kilo', patient.weight);
        }
    } catch (err) {
        console.error('Profil kartı güncelleme hatası:', err);
    }
}

function updateBadge(badgeElement, label, value) {
    const valSpan = badgeElement.querySelector('.val');
    if (value && value !== 'Bilinmiyor') {
        valSpan.textContent = value;
        badgeElement.classList.add('filled');
    } else {
        valSpan.textContent = 'Belirtilmedi';
        badgeElement.classList.remove('filled');
    }
}

// Fetch message logs for active patient
async function loadChatHistory(patientId) {
    elements.chatMessages.innerHTML = '';
    
    try {
        const response = await fetch(`/api/patients/${patientId}/messages`);
        if (response.ok) {
            const messages = await response.json();
            
            if (messages.length === 0) {
                // Initial welcoming AI bubble if chat history is empty
                appendMessageBubble('ai', `Merhaba! Ben çocuk endokrinolojisi yapay zeka klinik danışmanıyım. **${elements.chatPatientName.textContent}** hakkında klinik sorularınızı yanıtlayabilir ve muayene verilerini takip kartına otomatik olarak çıkarabilirim.\n\nSohbete başlamak için hastanın değerlerini yazabilirsiniz.`);
            } else {
                messages.forEach(msg => {
                    appendMessageBubble(msg.sender, msg.text);
                });
            }
            scrollToBottom();
        }
    } catch (err) {
        console.error('Mesajları yükleme hatası:', err);
    }
}

// Append a single message node to the DOM
function appendMessageBubble(sender, text) {
    const wrapper = document.createElement('div');
    wrapper.className = `msg-wrapper ${sender}`;

    const avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    avatar.textContent = sender === 'ai' ? 'AI' : 'DR';

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    
    // Parse formatting if AI (to render markdown lists, bullet points, and bold tags beautifully)
    if (sender === 'ai') {
        bubble.innerHTML = formatMarkdown(text);
    } else {
        bubble.textContent = text;
    }

    wrapper.appendChild(avatar);
    wrapper.appendChild(bubble);
    elements.chatMessages.appendChild(wrapper);
}

// Scroll chat panel to bottom
function scrollToBottom() {
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

// ================= TRANSMISSION (SEND MESSAGE) =================
async function handleSendMessage(e) {
    e.preventDefault();
    if (!activePatientId) return;

    const messageText = elements.chatInput.value.trim();
    if (!messageText) return;

    // 1. Immediately render doctor message in UI & clear text input
    appendMessageBubble('doctor', messageText);
    elements.chatInput.value = '';
    scrollToBottom();

    // 2. Trigger loading indicators (Pulsing Typing Bubble)
    const typingIndicator = showTypingIndicator();

    const apiKey = elements.apiKeyInput.value.trim();

    try {
        const response = await fetch(`/api/patients/${activePatientId}/messages`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Gemini-API-Key': apiKey
            },
            body: JSON.stringify({ text: messageText })
        });

        const data = await response.json();
        
        // Remove typing indicator bubble
        typingIndicator.remove();

        if (response.ok) {
            // 3. Render AI Response
            appendMessageBubble('ai', data.reply);
            scrollToBottom();

            // 4. Update Header Metrics
            updateBadge(elements.statGender, 'Cinsiyet', data.patient.gender);
            updateBadge(elements.statAge, 'Yaş', data.patient.age ? `${data.patient.age} Yaş` : null);
            updateBadge(elements.statHeight, 'Boy', data.patient.height);
            updateBadge(elements.statWeight, 'Kilo', data.patient.weight);

            // 5. Instantly refresh patient card in the left list without reloading page!
            const patientIndex = allPatients.findIndex(p => p.id === activePatientId);
            if (patientIndex !== -1) {
                allPatients[patientIndex] = data.patient;
                
                // Keep search query active if any
                const query = elements.patientSearch.value.toLowerCase().trim();
                if (query) {
                    const filtered = allPatients.filter(p => p.name.toLowerCase().includes(query));
                    renderPatientList(filtered);
                } else {
                    renderPatientList(allPatients);
                }
            }
        } else {
            appendMessageBubble('ai', `Sistem hatası: ${data.error || 'Bilinmeyen bir hata oluştu.'}`);
            scrollToBottom();
        }
    } catch (err) {
        console.error('Mesaj gönderme hatası:', err);
        typingIndicator.remove();
        appendMessageBubble('ai', 'Hata: Sunucuyla bağlantı kurulamadı. Lütfen sunucunun çalıştığından emin olun.');
        scrollToBottom();
    }
}

function showTypingIndicator() {
    const wrapper = document.createElement('div');
    wrapper.className = 'msg-wrapper ai typing-indicator-wrapper';

    const avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    avatar.textContent = 'AI';

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';

    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.innerHTML = `
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
    `;

    bubble.appendChild(indicator);
    wrapper.appendChild(avatar);
    wrapper.appendChild(bubble);
    elements.chatMessages.appendChild(wrapper);
    scrollToBottom();
    return wrapper;
}

// ================= CUSTOM REGEX MARKDOWN CONVERTER =================
function formatMarkdown(text) {
    if (!text) return "";
    
    // Escape HTML tags to prevent XSS
    let html = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    
    // Bold Syntax: **text**
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Bullet Lists: Line starts with * or -
    const lines = html.split('\n');
    let inList = false;
    let resultLines = [];
    
    for (let line of lines) {
        const trimmed = line.trim();
        // Check list tags
        if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
            if (!inList) {
                resultLines.push('<ul>');
                inList = true;
            }
            resultLines.push(`<li>${trimmed.substring(2)}</li>`);
        } else {
            if (inList) {
                resultLines.push('</ul>');
                inList = false;
            }
            resultLines.push(line);
        }
    }
    if (inList) {
        resultLines.push('</ul>');
    }
    
    html = resultLines.join('\n');
    
    // Handle remaining newlines outside of lists with <br>
    html = html.replace(/\n/g, '<br>');
    
    // Clean up empty lines or duplicate breaks surrounding lists
    html = html.replace(/<br><ul>/g, '<ul>').replace(/<\/ul><br>/g, '</ul>');
    html = html.replace(/<br><li>/g, '<li>').replace(/<\/li><br>/g, '</li>');
    
    return html;
}
