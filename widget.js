(function() {
    // =================================================================
    // CONFIGURATION v5.7.1
    // NEW: #1 "Talk to a Human" as quick reply button
    // NEW: #2 Typing indicator with favicon avatar
    // NEW: #3 "Email me this conversation" transcript offer
    // NEW: #4 Smart handoff after 3+ unanswered questions
    // NEW: #5 Message reactions (thumbs up/down)
    // NEW: #6 Rich card rendering [CARD:name] from bot responses
    // NEW: #9 Font size accessibility (A-/A+)
    // NEW: #10 Smooth message animations (slide-up + fade)
    // NEW: #12 Light/dark mode toggle (auto-detect or Sheets config)
    // =================================================================
    var _scriptTag = (function() { var s = document.getElementsByTagName('script'); return s[s.length - 1]; })();

    function _detectSiteColor() {
        var DEFAULT = '#4285f4';
        try {
            var tm = document.querySelector('meta[name="theme-color"]');
            if (tm && tm.content && /^#[0-9a-fA-F]{3,8}$/.test(tm.content.trim())) return tm.content.trim();
            var root = getComputedStyle(document.documentElement);
            var vars = ['--primary-color','--brand-color','--theme-color','--accent-color','--primary','--brand','--color-primary','--color-brand','--wp--preset--color--primary','--global-palette1','--ast-global-color-0'];
            for (var i = 0; i < vars.length; i++) { var v = root.getPropertyValue(vars[i]).trim(); if (v && v !== '' && v !== 'initial') { var p = _colorToHex(v); if (p && p !== '#ffffff' && p !== '#000000') return p; } }
            var sels = ['header','nav','.navbar','.site-header','#header','[role="banner"]','.btn-primary','button.primary','[class*="cta"]'];
            for (var s = 0; s < sels.length; s++) { var el = document.querySelector(sels[s]); if (!el) continue; var bg = getComputedStyle(el).backgroundColor; if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') { var hex = _colorToHex(bg); if (hex && hex !== '#ffffff' && hex !== '#000000') return hex; } }
            return DEFAULT;
        } catch (e) { return DEFAULT; }
    }

    function _colorToHex(color) {
        if (!color || color === 'transparent') return null; color = color.trim();
        if (/^#[0-9a-fA-F]{3,8}$/.test(color)) { if (color.length === 4) return '#'+color[1]+color[1]+color[2]+color[2]+color[3]+color[3]; return color.substring(0,7); }
        var m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
        if (m) return '#'+((1<<24)+(parseInt(m[1])<<16)+(parseInt(m[2])<<8)+parseInt(m[3])).toString(16).slice(1);
        try { var t=document.createElement('div'); t.style.color=color; document.body.appendChild(t); var c=getComputedStyle(t).color; document.body.removeChild(t); if(c!==color) return _colorToHex(c); } catch(e){}
        return null;
    }

    // Detect favicon URL for typing avatar (#2)
    function _detectFavicon() {
        try {
            var links = document.querySelectorAll('link[rel*="icon"]');
            for (var i = 0; i < links.length; i++) { if (links[i].href) return links[i].href; }
            return window.location.origin + '/favicon.ico';
        } catch(e) { return ''; }
    }

    // Detect if host site is light or dark for theme default (#12)
    function _detectSiteTheme() {
        try {
            var bg = getComputedStyle(document.body).backgroundColor;
            var hex = _colorToHex(bg);
            if (hex) return isLightColor(hex) ? 'light' : 'dark';
        } catch(e) {}
        return 'dark';
    }

    var CONFIG = {
        CLIENT_ID: _scriptTag.getAttribute('data-client') || 'gainwrk',
        BASE_URL: _scriptTag.getAttribute('data-server') || 'https://saas-bot-prototype.onrender.com',
        API_KEY: _scriptTag.getAttribute('data-api-key') || '',
        BRAND_COLOR: _detectSiteColor(),
        BRAND_NAME: 'Chat Assistant',
        WELCOME_MESSAGE: "Hi! How can I help you today?",
        INPUT_PLACEHOLDER: 'Type a message...',
        QUICK_REPLIES: null,
        POSITION: 'right',
        START_MINIMIZED: true,
        SESSION_TIMEOUT: 7200000,
        AUTO_OPEN_DELAY: null,
        AUTO_OPEN_PAGES: null,
        SHOW_BRANDING: true,
        BRANDING_TEXT: 'Powered by GainWRK',
        BRANDING_URL: 'https://www.gainwrk.com'
    };

    var isOpen = !CONFIG.START_MINIMIZED, unreadCount = 0, isInitialized = false, sessionId = null;
    var messageHistory = [], widgetConfig = null, currentBrandColor = CONFIG.BRAND_COLOR;
    var abVariant = null, sessionEnded = false, agentName = CONFIG.BRAND_NAME;
    var faviconUrl = _detectFavicon();
    var chatTheme = 'dark'; // 'dark' or 'light' (#12)
    var fontSize = 14; // #9 default
    var agentMsgCount = 0; // #4 track unanswered agent messages
    var humanHandoffShown = false; // #4
    var emailButtonShown = false; // Fix: prevent duplicate "Email Me This Chat" button
    var hasOpenedChat = false; // Track if user has ever opened chat (for mobile preview gating)

    function generateSessionId() { return CONFIG.CLIENT_ID + '_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11); }
    function getStoredSession() { try { var s=localStorage.getItem('chat_session_'+CONFIG.CLIENT_ID); if(s){var d=JSON.parse(s); if(Date.now()-(d.last_activity||d.created)<CONFIG.SESSION_TIMEOUT){messageHistory=d.messages||[];widgetConfig=d.widgetConfig||null;abVariant=d.abVariant||null;if(widgetConfig&&widgetConfig.avatar_url)faviconUrl=widgetConfig.avatar_url;return d.sessionId;}} } catch(e){} return null; }
    function storeSession() { try { localStorage.setItem('chat_session_'+CONFIG.CLIENT_ID, JSON.stringify({sessionId:sessionId,created:Date.now(),last_activity:Date.now(),messages:messageHistory,widgetConfig:widgetConfig,abVariant:abVariant})); } catch(e){} }
    function isLightColor(hex) { var h=hex.replace('#',''); return (parseInt(h.substring(0,2),16)*0.299+parseInt(h.substring(2,4),16)*0.587+parseInt(h.substring(4,6),16)*0.114)>160; }
    function escapeHtml(t) { var d=document.createElement('div'); d.textContent=t; return d.innerHTML; }

    function linkifyText(text) {
        var result = text.replace(/(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:underline;">$1</a>');
        result = result.replace(/(?<![="'>\/])(?<![a-zA-Z0-9])\b((?:[a-zA-Z0-9][-a-zA-Z0-9]*\.)+(?:com|org|net|io|co|ai|app|dev|biz|info|me|us|uk|ca)(?:\/[^\s<]*[^<.,:;"')\]\s])?)/g, function(match,p1,offset){
            var before=result.substring(Math.max(0,offset-50),offset);
            if(before.includes('<a ')&&!before.includes('</a>'))return match;
            if(before.includes('href=')||before.includes('">'))return match;
            return '<a href="https://'+match+'" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:underline;">'+match+'</a>';
        });
        return result;
    }

    // #12: Theme colors
    function themeColors() {
        if (chatTheme === 'light') return { bg:'#ffffff', msgBg:'#f1f5f9', border:'rgba(0,0,0,0.1)', text:'#1e293b', subtext:'rgba(0,0,0,0.5)', inputBg:'#f8fafc', inputBorder:'rgba(0,0,0,0.15)', brandingBg:'rgba(0,0,0,0.03)' };
        return { bg:'#0f172a', msgBg:'rgba(255,255,255,0.08)', border:'rgba(255,255,255,0.1)', text:'#fff', subtext:'rgba(255,255,255,0.45)', inputBg:'rgba(255,255,255,0.05)', inputBorder:'rgba(255,255,255,0.15)', brandingBg:'rgba(0,0,0,0.3)' };
    }

    function getStyles() {
        var bc=currentBrandColor, h=bc.replace('#','');
        var br=parseInt(h.substring(0,2),16), bg=parseInt(h.substring(2,4),16), bb=parseInt(h.substring(4,6),16);
        var tob = isLightColor(bc) ? '#000' : '#fff';
        var th = themeColors();
        return '#chat-widget-container * { box-sizing:border-box; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }\n' +
        '#chat-widget-bubble { position:fixed; bottom:20px; '+CONFIG.POSITION+':20px; width:60px; height:60px; background:'+bc+'; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; z-index:999998; box-shadow:0 4px 20px rgba('+br+','+bg+','+bb+',0.4); transition:transform 0.3s,box-shadow 0.3s; }\n' +
        '#chat-widget-bubble:hover { transform:scale(1.05); }\n' +
        '#chat-widget-bubble svg { width:28px; height:28px; fill:'+tob+'; transition:opacity 0.2s; }\n' +
        '#chat-widget-bubble .chat-icon { opacity:1; } #chat-widget-bubble .close-icon { position:absolute; opacity:0; }\n' +
        '#chat-widget-bubble.open .chat-icon { opacity:0; } #chat-widget-bubble.open .close-icon { opacity:1; }\n' +
        '#chat-widget-badge { position:absolute; top:-5px; right:-5px; background:#ef4444; color:white; width:20px; height:20px; border-radius:50%; font-size:12px; font-weight:bold; display:none; align-items:center; justify-content:center; }\n' +
        '#chat-widget-window { position:fixed; bottom:90px; '+CONFIG.POSITION+':20px; width:380px; height:520px; max-height:calc(100vh - 120px); background:'+th.bg+'; border:1px solid '+th.border+'; border-radius:16px; box-shadow:0 10px 40px rgba(0,0,0,0.5); z-index:999999; display:none; flex-direction:column; overflow:hidden; }\n' +
        '#chat-widget-window.open { display:flex; }\n' +
        '#chat-widget-header { background:'+bc+'; color:'+tob+'; padding:12px 16px; display:flex; align-items:center; gap:12px; }\n' +
        '.chat-widget-avatar { width:36px; height:36px; background:rgba(255,255,255,0.9); border-radius:50%; display:flex; align-items:center; justify-content:center; overflow:hidden; }\n' +
        '.chat-widget-avatar img { width:100%; height:100%; object-fit:cover; }\n' +
        '.chat-widget-avatar svg { width:20px; height:20px; fill:#1e1b4b; }\n' +
        '.chat-widget-header-text h4 { margin:0; font-size:15px; font-weight:600; color:'+tob+'; }\n' +
        '.chat-widget-header-text span { font-size:11px; opacity:0.8; display:flex; align-items:center; gap:5px; color:'+tob+'; }\n' +
        '.online-dot { width:7px; height:7px; background:'+tob+'; border-radius:50%; opacity:0.6; }\n' +
        // #9 Font size + #12 theme toggle controls in header
        '.chat-widget-controls { display:flex; align-items:center; gap:4px; margin-left:auto; }\n' +
        '.chat-widget-ctrl-btn { background:rgba(255,255,255,0.15); border:none; color:'+tob+'; width:28px; height:28px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; -webkit-tap-highlight-color:transparent; }\n' +
        '.chat-widget-ctrl-btn:active { background:rgba(255,255,255,0.3); }\n' +
        '.chat-widget-close { background:none; border:none; color:'+tob+'; font-size:20px; cursor:pointer; padding:4px 8px; opacity:0.7; }\n' +
        '.chat-widget-close:hover { opacity:1; }\n' +
        '#chat-widget-messages { flex:1; padding:16px; overflow-y:auto; display:flex; flex-direction:column; gap:4px; background:'+th.bg+'; }\n' +
        '.chat-msg-label { font-size:11px; color:'+th.subtext+'; padding:0 4px; margin-top:6px; }\n' +
        '.chat-msg-label.user-label { align-self:flex-end; } .chat-msg-label.agent-label { align-self:flex-start; }\n' +
        // Agent message with avatar row
        '.chat-msg-row { display:flex; gap:8px; align-items:flex-start; align-self:flex-start; max-width:85%; }\n' +
        '.chat-msg-avatar { width:24px; height:24px; border-radius:50%; overflow:hidden; flex-shrink:0; margin-top:2px; }\n' +
        '.chat-msg-avatar img { width:100%; height:100%; object-fit:cover; }\n' +
        // #10 Animation
        '.chat-widget-message { max-width:80%; padding:12px 14px; border-radius:14px; font-size:'+fontSize+'px; line-height:1.5; animation:msgSlideIn 0.35s ease-out; }\n' +
        '@keyframes msgSlideIn { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }\n' +
        '.chat-widget-message.user { align-self:flex-end; background:'+bc+'; color:'+tob+'; border-bottom-right-radius:4px; }\n' +
        '.chat-widget-message.agent { align-self:flex-start; background:'+th.msgBg+'; color:'+th.text+'; border:1px solid '+th.border+'; border-bottom-left-radius:4px; }\n' +
        // #5 Reactions
        '.chat-msg-reactions { display:flex; gap:4px; align-self:flex-start; padding:2px 4px; }\n' +
        '.chat-msg-reactions button { background:none; border:1px solid '+th.border+'; border-radius:12px; padding:2px 8px; font-size:13px; cursor:pointer; opacity:0.5; transition:all 0.2s; -webkit-tap-highlight-color:transparent; }\n' +
        '.chat-msg-reactions button:hover { opacity:1; } .chat-msg-reactions button.voted { opacity:1; border-color:'+bc+'; background:'+bc+'15; }\n' +
        // #6 Rich cards
        '.chat-rich-card { align-self:flex-start; max-width:80%; background:'+th.msgBg+'; border:1px solid '+th.border+'; border-radius:14px; overflow:hidden; animation:msgSlideIn 0.2s ease-out; }\n' +
        '.chat-rich-card .card-body { padding:14px; }\n' +
        '.chat-rich-card .card-title { font-size:15px; font-weight:600; color:'+th.text+'; margin-bottom:4px; }\n' +
        '.chat-rich-card .card-desc { font-size:13px; color:'+th.subtext+'; line-height:1.4; margin-bottom:10px; }\n' +
        '.chat-rich-card .card-btn { display:inline-block; background:'+bc+'; color:'+tob+'; border:none; border-radius:20px; padding:8px 20px; font-size:13px; font-weight:600; cursor:pointer; -webkit-tap-highlight-color:transparent; }\n' +
        '.chat-rich-card .card-btn:active { opacity:0.8; }\n' +
        // Typing with avatar (#2)
        '.chat-widget-typing { display:none; align-items:center; gap:8px; padding:12px 14px; background:'+th.msgBg+'; border-radius:14px; align-self:flex-start; border:1px solid '+th.border+'; }\n' +
        '.chat-widget-typing.show { display:flex; }\n' +
        '.typing-avatar { width:22px; height:22px; border-radius:50%; overflow:hidden; flex-shrink:0; }\n' +
        '.typing-avatar img { width:100%; height:100%; object-fit:cover; }\n' +
        '.typing-dots { display:flex; gap:4px; }\n' +
        '.typing-dots span { width:8px; height:8px; background:'+bc+'; border-radius:50%; animation:bounce 1.4s infinite; }\n' +
        '.typing-dots span:nth-child(2){animation-delay:0.2s;} .typing-dots span:nth-child(3){animation-delay:0.4s;}\n' +
        '@keyframes bounce { 0%,60%,100%{transform:translateY(0);} 30%{transform:translateY(-4px);} }\n' +
        '.typing-text { color:'+th.subtext+'; font-size:12px; font-style:italic; }\n' +
        '.chat-inline-btns { display:flex; flex-wrap:wrap; gap:6px; align-self:flex-start; padding:2px 0; }\n' +
        '.chat-inline-btns button { background:'+bc+'18; color:'+bc+'; border:1px solid '+bc+'40; border-radius:16px; padding:6px 16px; font-size:13px; cursor:pointer; -webkit-tap-highlight-color:transparent; }\n' +
        '.chat-inline-btns button:active { background:'+bc+'40; }\n' +
        '#chat-widget-input-area { padding:0; background:'+th.bg+'; border-top:1px solid '+th.border+'; }\n' +
        '#chat-widget-input-frame { width:100%; height:56px; border:none; display:block; background:transparent; }\n' +
        '#chat-widget-native-input { display:none; }\n' +
        '#chat-widget-native-input .native-wrap { display:flex; gap:10px; align-items:flex-end; padding:10px 14px; padding-bottom:max(10px, env(safe-area-inset-bottom)); background:'+th.bg+'; border-top:1px solid '+th.border+'; }\n' +
        '#chat-widget-native-input textarea { flex:1; padding:10px 14px; border:1px solid '+th.inputBorder+'; border-radius:20px; font-size:16px; outline:none; background:'+th.inputBg+'; color:'+th.text+'; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; resize:none; overflow-y:auto; line-height:1.4; min-height:42px; max-height:80px; -webkit-appearance:none; }\n' +
        '#chat-widget-native-input textarea:focus { border-color:'+bc+'; }\n' +
        '#chat-widget-native-input textarea::placeholder { color:'+th.subtext+'; }\n' +
        '#chat-widget-native-input button { width:42px; height:42px; border:none; background:'+bc+'; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; -webkit-appearance:none; -webkit-tap-highlight-color:transparent; }\n' +
        '#chat-widget-native-input button:disabled { background:rgba(128,128,128,0.2); }\n' +
        '#chat-widget-native-input button svg { width:20px; height:20px; fill:'+tob+'; }\n' +
        '#chat-widget-send { display:none; }\n' +
        '#chat-widget-branding { padding:8px; text-align:center; background:'+th.brandingBg+'; border-top:1px solid '+th.border+'; }\n' +
        '#chat-widget-branding a { color:'+th.subtext+'; font-size:11px; text-decoration:none; }\n' +
        '#chat-widget-branding a:hover { color:'+bc+'; }\n' +
        '#chat-widget-preview { display:none; position:fixed; bottom:85px; '+CONFIG.POSITION+':20px; max-width:320px; background:#1e293b; border:1px solid rgba(255,255,255,0.15); border-radius:12px; padding:10px 36px 10px 14px; cursor:pointer; z-index:999997; box-shadow:0 4px 15px rgba(0,0,0,0.3); }\n' +
        '#chat-widget-preview .preview-text { color:rgba(255,255,255,0.85); font-size:13px; line-height:1.4; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }\n' +
        '#chat-widget-preview .preview-name { color:'+bc+'; font-size:11px; font-weight:600; margin-bottom:2px; display:flex; align-items:center; gap:6px; }\n' +
        '#chat-widget-preview .preview-dot { width:6px; height:6px; background:#22c55e; border-radius:50%; }\n' +
        '#chat-widget-preview .preview-time { color:rgba(255,255,255,0.35); font-size:10px; margin-left:auto; font-weight:400; }\n' +
        '#chat-widget-preview .preview-close { position:absolute; top:6px; right:8px; background:none; border:none; color:rgba(255,255,255,0.4); font-size:16px; cursor:pointer; padding:2px 5px; line-height:1; }\n' +
        '#chat-widget-preview .preview-close:hover { color:rgba(255,255,255,0.8); }\n' +
        '@media (max-width:768px) {\n' +
        '  #chat-widget-input-area { display:none !important; }\n' +
        '  #chat-widget-native-input { display:block !important; flex-shrink:0; z-index:10; }\n' +
        '}\n' +
        '@media (max-width:480px) {\n' +
        '  #chat-widget-bubble { bottom:15px; '+CONFIG.POSITION+':15px; width:55px; height:55px; }\n' +
        '  #chat-widget-preview { bottom:78px; '+CONFIG.POSITION+':15px; max-width:calc(100% - 90px); }\n' +
        '  #chat-widget-container.chat-open { position:fixed !important; top:0 !important; left:0 !important; right:0 !important; bottom:0 !important; width:100% !important; height:100% !important; z-index:999999 !important; }\n' +
        '  #chat-widget-window { position:fixed !important; top:0 !important; left:0 !important; right:0 !important; bottom:0 !important; width:100% !important; height:100dvh !important; max-width:none !important; max-height:none !important; border-radius:0 !important; border:none !important; margin:0 !important; z-index:999999 !important; overflow:hidden !important; display:none; flex-direction:column; }\n' +
        '  #chat-widget-window.open { display:flex !important; }\n' +
        '  #chat-widget-header { flex-shrink:0; z-index:10; padding:14px 16px; padding-top:max(14px, env(safe-area-inset-top)); min-height:60px; }\n' +
        '  .chat-widget-close { width:36px; height:36px; display:flex !important; align-items:center; justify-content:center; font-size:28px !important; opacity:1 !important; background:rgba(255,255,255,0.2) !important; border-radius:50% !important; padding:0 !important; -webkit-tap-highlight-color:transparent; }\n' +
        '  .chat-widget-close:active { background:rgba(255,255,255,0.4) !important; }\n' +
        '  #chat-widget-messages { flex:1; min-height:0; overflow-y:auto; overflow-x:hidden; -webkit-overflow-scrolling:touch; padding-bottom:10px; overscroll-behavior:contain; }\n' +
        '  #chat-widget-branding { flex-shrink:0; padding-bottom:env(safe-area-inset-bottom, 5px); }\n' +
        '  body.chat-widget-open { overflow:hidden !important; position:fixed !important; width:100% !important; height:100% !important; top:0 !important; left:0 !important; }\n' +
        '}\n' +
        '@media (max-width:360px) { .chat-widget-message { max-width:85%; padding:10px 12px; font-size:'+fontSize+'px; } }';
    }

    // ---- Message functions ----
    function restoreMessages() {
        var c=document.getElementById('chat-widget-messages'), t=c.querySelector('.chat-widget-typing');
        c.querySelectorAll('.chat-widget-message,.chat-msg-label,.chat-inline-btns,.chat-msg-reactions,.chat-rich-card').forEach(function(m){m.remove();});
        // Re-add welcome label
        var wl = document.createElement('div'); wl.className='chat-msg-label agent-label'; wl.textContent=agentName;
        c.insertBefore(wl, t);
        var we = document.createElement('div'); we.className='chat-widget-message agent'; we.id='chat-widget-welcome';
        we.textContent = (widgetConfig && widgetConfig.welcome_message) || CONFIG.WELCOME_MESSAGE;
        c.insertBefore(we, t);
        messageHistory.forEach(function(msg){
            var l=document.createElement('div'); l.className='chat-msg-label '+(msg.type==='agent'?'agent-label':'user-label'); l.textContent=msg.type==='agent'?agentName:'You'; c.insertBefore(l,t);
            if (msg.type==='agent') {
                var row=document.createElement('div'); row.className='chat-msg-row';
                if (faviconUrl) { var av=document.createElement('div'); av.className='chat-msg-avatar'; var img=document.createElement('img'); img.src=faviconUrl; img.alt=''; img.onerror=function(){av.style.display='none';}; av.appendChild(img); row.appendChild(av); }
                var d=document.createElement('div'); d.className='chat-widget-message agent'; d.innerHTML=renderAgentText(msg.text); row.appendChild(d); c.insertBefore(row,t);
                addReactions(c,t);
            } else {
                var d=document.createElement('div'); d.className='chat-widget-message user'; d.innerHTML=escapeHtml(msg.text); c.insertBefore(d,t);
            }
        });
        c.scrollTop=c.scrollHeight;
    }

    // #6: Parse [CARD:title|desc|btnText|btnAction] from agent text
    function renderAgentText(text) {
        // Check for card syntax: [CARD:title|description|button text|action]
        var cardMatch = text.match(/\[CARD:([^\]]+)\]/);
        if (cardMatch) {
            // Remove card tag from text, render card separately
            var cleanText = text.replace(/\[CARD:[^\]]+\]/, '').trim();
            return linkifyText(escapeHtml(cleanText));
        }
        return linkifyText(escapeHtml(text));
    }

    function renderCard(text, container, typing) {
        var cardMatch = text.match(/\[CARD:([^|]+)\|([^|]+)\|([^|]+)\|([^\]]+)\]/);
        if (!cardMatch) return;
        var card = document.createElement('div'); card.className = 'chat-rich-card';
        var body = document.createElement('div'); body.className = 'card-body';
        var title = document.createElement('div'); title.className = 'card-title'; title.textContent = cardMatch[1].trim();
        var desc = document.createElement('div'); desc.className = 'card-desc'; desc.textContent = cardMatch[2].trim();
        var btn = document.createElement('button'); btn.className = 'card-btn'; btn.textContent = cardMatch[3].trim();
        var action = cardMatch[4].trim();
        btn.onclick = function() {
            if (action === 'collect_contact') {
                window.gainwrkChat.send("I'd like to get connected with someone");
            } else if (action.startsWith('url:')) {
                window.open(action.substring(4), '_blank');
            } else {
                window.gainwrkChat.send(action);
            }
        };
        body.appendChild(title); body.appendChild(desc); body.appendChild(btn);
        card.appendChild(body);
        container.insertBefore(card, typing);
        container.scrollTop = container.scrollHeight;
    }

    // #5: Add reaction buttons
    function addReactions(container, typing) {
        var rx = document.createElement('div'); rx.className = 'chat-msg-reactions';
        ['\uD83D\uDC4D','\uD83D\uDC4E'].forEach(function(emoji) {
            var b = document.createElement('button'); b.textContent = emoji;
            b.onclick = function() {
                rx.querySelectorAll('button').forEach(function(btn){btn.classList.remove('voted');});
                b.classList.add('voted');
                // Could send feedback to server here
            };
            rx.appendChild(b);
        });
        container.insertBefore(rx, typing);
    }

    function addMessage(text,type) {
        var c=document.getElementById('chat-widget-messages'), t=c.querySelector('.chat-widget-typing');
        var l=document.createElement('div'); l.className='chat-msg-label '+(type==='agent'?'agent-label':'user-label'); l.textContent=type==='agent'?agentName:'You'; c.insertBefore(l,t);
        
        if (type==='agent') {
            // Agent messages get avatar row (like Fin.ai)
            var row=document.createElement('div'); row.className='chat-msg-row';
            if (faviconUrl) {
                var av=document.createElement('div'); av.className='chat-msg-avatar';
                var img=document.createElement('img'); img.src=faviconUrl; img.alt=''; img.onerror=function(){av.style.display='none';};
                av.appendChild(img); row.appendChild(av);
            }
            var d=document.createElement('div'); d.className='chat-widget-message agent';
            d.innerHTML=renderAgentText(text);
            row.appendChild(d); c.insertBefore(row,t);
            // Rich card
            if (text.includes('[CARD:')) renderCard(text, c, t);
            // Reactions
            addReactions(c, t);
        } else {
            var d=document.createElement('div'); d.className='chat-widget-message user';
            d.innerHTML=escapeHtml(text);
            c.insertBefore(d,t);
        }

        c.scrollTop=c.scrollHeight;
        messageHistory.push({text:text,type:type}); storeSession();

        if(type==='agent'){
            var tl=text.toLowerCase(), np;
            if(tl.match(/(?:what(?:'s| is) your |share your |provide your |enter your |give (?:us |me )?your )(?:phone|number|cell|mobile)/)) np='Enter phone number...';
            else if(tl.match(/(?:what(?:'s| is) your |share your |provide your |enter your |give (?:us |me )?your )(?:email|e-mail)/)) np='Enter email address...';
            else np=(widgetConfig&&widgetConfig.placeholder)||CONFIG.INPUT_PLACEHOLDER;
            postToInputFrame({type:'chat-placeholder',value:np}); setNativePlaceholder(np);
            if(!isOpen){ unreadCount++; updateBadge(); updatePreview(text); }

            // Inline Yes/No buttons
            var isYesNo = tl.match(/would you like|shall i|want me to|do you want|interested in|connect you with|ready to|sound good|does that work|like to proceed|like to schedule|like to book|want to see|want to check|want to try|like to see|like to try|like to check|care to|how about|shall we|should i|can i show|anything else|something else|on your mind|other questions|else i can help|else on your mind|is that something|does that sound|that a concern|is that a/i);
            var isOpenEnded = tl.match(/\b(who|what|what's|how|where|when|which|tell me|share|provide|enter)\b.*\?/i);
            var isEitherOr = tl.match(/\bor\b.*\?/i);
            if(isYesNo && !isOpenEnded && !isEitherOr){
                var br2=document.createElement('div'); br2.className='chat-inline-btns';
                ['Yes','No'].forEach(function(lb){ var b=document.createElement('button'); b.textContent=lb; b.onclick=function(){window.gainwrkChat.send(lb);br2.remove();}; br2.appendChild(b); });
                c.insertBefore(br2,t); c.scrollTop=c.scrollHeight;
            }

            // #4: Smart handoff - show after 3+ agent msgs without contact OR at wrap-up
            agentMsgCount++;
            // v5.9 FIX: Expanded to catch "reaching out" (not just "reach out"),
            // standalone "bye" (not just "goodbye"/"bye for now"), and other common
            // farewell patterns the bot uses like "great chatting", "set up for you"
            // v5.10 FIX: Added question guard.  Messages like "Great chatting
            // with you!  What is the best way to reach you?" were triggering a
            // false wrap-up because "great chat" matched, even though the agent
            // is still asking a question.  If the message contains a "?" after
            // the matching phrase, it is NOT a wrap-up Ã¢â‚¬â€ it's mid-conversation.
            var wrapUpMatch = tl.match(/follow.?up|reach(?:ing)? out|be in touch|get back to you|team will (?:contact|be reaching)|have a (great|wonderful|good)|take care|good\s?bye|\bbye\b|bye for now|great chat|nice chat|pleasure chat|glad .* could help|set (?:that |this )?up for you/i);
            var isWrapUp = false;
            if (wrapUpMatch) {
                // Check if the message asks a question AFTER the farewell phrase
                var afterMatch = tl.substring(wrapUpMatch.index + wrapUpMatch[0].length);
                var hasFollowUpQuestion = afterMatch.indexOf('?') !== -1;
                isWrapUp = !hasFollowUpQuestion;
            }
            
            if (agentMsgCount >= 3 && !humanHandoffShown && !isWrapUp) {
                humanHandoffShown = true;
                var ho = document.createElement('div'); ho.className = 'chat-inline-btns';
                var hb = document.createElement('button'); hb.textContent = '\uD83D\uDC64 Talk to a Human';
                hb.style.fontWeight = '600';
                hb.onclick = function() { window.gainwrkChat.send("I'd like to speak with someone directly"); ho.remove(); };
                ho.appendChild(hb);
                c.insertBefore(ho, t); c.scrollTop = c.scrollHeight;
            }
            
            // #3: Email transcript offer - shows at conversation wrap-up (ONCE only)
            // v5.9 FIX: Calls /email-transcript API to auto-send the transcript
            // to the user's email (collected during chat), instead of sending a
            // chat message that the LLM would handle conversationally.
            if (isWrapUp && messageHistory.length >= 6 && !emailButtonShown) {
                emailButtonShown = true;
                var eo = document.createElement('div'); eo.className = 'chat-inline-btns';
                var eb = document.createElement('button'); eb.textContent = '\u2709\uFE0F Email Me This Chat';
                eb.onclick = function() {
                    eo.remove();
                    addMessage("Sending you a copy of this chat...", 'agent');
                    var emailHeaders = {'Content-Type': 'application/json'};
                    if (CONFIG.API_KEY) emailHeaders['X-API-Key'] = CONFIG.API_KEY;
                    fetchWithTimeout(CONFIG.BASE_URL + '/email-transcript', {
                        method: 'POST',
                        headers: emailHeaders,
                        body: JSON.stringify({client_id: CONFIG.CLIENT_ID, session_id: sessionId})
                    }, 15000).then(function(r) { return r.json(); }).then(function(d) {
                        if (d.success) {
                            addMessage('\u2705 Done! A copy of this chat has been sent to your email.', 'agent');
                        } else {
                            addMessage("Sorry, I wasn't able to send the email. " + (d.error || "Please try again later."), 'agent');
                        }
                    }).catch(function() {
                        addMessage("Sorry, there was a problem sending the email. Please try again later.", 'agent');
                    });
                };
                eo.appendChild(eb);
                c.insertBefore(eo, t); c.scrollTop = c.scrollHeight;
            }
        }

        if(type==='user') agentMsgCount = 0; // Reset counter when user responds

        _resetReengagementTimer();
    }

    function updateBadge(){var b=document.getElementById('chat-widget-badge');if(!b)return;if(unreadCount>0){b.textContent=unreadCount>9?'9+':unreadCount;b.style.display='flex';}else{b.style.display='none';}}
    function updatePreview(text){var p=document.getElementById('chat-widget-preview'),pt=document.getElementById('chat-widget-preview-text');if(!p||!pt)return;if(window.innerWidth<=768&&!hasOpenedChat)return;var clean=text.replace(/\[CARD:[^\]]+\]/g,'').trim();pt.textContent=clean.length>90?clean.substring(0,87)+'...':clean;var te=p.querySelector('.preview-time');if(te)te.textContent='Just now';p.style.display='block';}
    function postToInputFrame(msg){var f=document.getElementById('chat-widget-input-frame');if(f&&f.contentWindow)f.contentWindow.postMessage(msg,'*');}
    function setNativePlaceholder(t){var i=document.getElementById('chat-widget-native-textarea');if(i)i.placeholder=t||'';}
    function setNativeEnabled(e){var i=document.getElementById('chat-widget-native-textarea'),b=document.getElementById('chat-widget-native-btn');if(i)i.disabled=!e;if(b)b.disabled=!e;}
    function doNativeSend(){var i=document.getElementById('chat-widget-native-textarea');if(!i)return;var t=i.value.trim();if(!t)return;i.value='';i.style.height='auto';window.gainwrkChat.send(t);}
    function showTyping(){var t=document.querySelector('.chat-widget-typing');if(t)t.classList.add('show');var c=document.getElementById('chat-widget-messages');if(c)c.scrollTop=c.scrollHeight;}
    function hideTyping(){var t=document.querySelector('.chat-widget-typing');if(t)t.classList.remove('show');}

    // #9: Font size controls
    function changeFontSize(delta) {
        fontSize = Math.max(12, Math.min(18, fontSize + delta));
        document.querySelectorAll('.chat-widget-message').forEach(function(m) { m.style.fontSize = fontSize + 'px'; });
    }

    // #12: Theme toggle
    function toggleTheme() {
        chatTheme = chatTheme === 'dark' ? 'light' : 'dark';
        var styleEl = document.querySelector('#chat-widget-container style');
        if (styleEl) styleEl.textContent = getStyles();
        // Update iframe if desktop
        postToInputFrame({ type: 'chat-theme', theme: chatTheme });
    }

    var _reengageTimer=null,_reengageShown=false;
    function _resetReengagementTimer(){if(_reengageTimer)clearTimeout(_reengageTimer);if(_reengageShown||!isOpen)return;_reengageTimer=setTimeout(function(){if(!isOpen||_reengageShown||!isInitialized)return;if(messageHistory.length>0&&messageHistory[messageHistory.length-1].type==='agent'){_reengageShown=true;addMessage("Still there? No rush \u2014 I\u2019m here whenever you\u2019re ready! \uD83D\uDE0A",'agent');}},60000);}

    function createWidget() {
        var header=(widgetConfig&&widgetConfig.header)||CONFIG.BRAND_NAME;
        var welcomeMsg=(widgetConfig&&widgetConfig.welcome_message)||CONFIG.WELCOME_MESSAGE;
        var placeholder=(widgetConfig&&widgetConfig.placeholder)||CONFIG.INPUT_PLACEHOLDER;
        var tob=isLightColor(currentBrandColor)?'#000':'#fff';
        // #12: Auto-detect theme from site if not set via config
        if (widgetConfig && widgetConfig.theme) chatTheme = widgetConfig.theme;
        else chatTheme = _detectSiteTheme();

        var avatarHtml = faviconUrl ? '<img src="'+escapeHtml(faviconUrl)+'" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'block\'"><svg style="display:none" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>';
        // #2: Typing avatar
        var typingAvatarHtml = faviconUrl ? '<div class="typing-avatar"><img src="'+escapeHtml(faviconUrl)+'" alt=""></div>' : '';

        var c=document.createElement('div'); c.id='chat-widget-container';
        c.innerHTML=
            '<style>'+getStyles()+'</style>'+
            '<div id="chat-widget-bubble" onclick="window.gainwrkChat.toggle()"><svg class="chat-icon" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg><svg class="close-icon" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg><div id="chat-widget-badge">1</div></div>'+
            '<div id="chat-widget-preview" onclick="window.gainwrkChat.toggle()"><div class="preview-name"><span class="preview-dot"></span>'+escapeHtml(header)+'<span class="preview-time">Just now</span></div><div class="preview-text" id="chat-widget-preview-text"></div><button class="preview-close" onclick="event.stopPropagation();this.parentElement.style.display=\'none\';">&times;</button></div>'+
            '<div id="chat-widget-window">'+
                '<div id="chat-widget-header"><div class="chat-widget-avatar">'+avatarHtml+'</div><div class="chat-widget-header-text"><h4 id="chat-widget-title">'+escapeHtml(header)+'</h4><span><span class="online-dot"></span> Online now</span></div><div class="chat-widget-controls"><button class="chat-widget-ctrl-btn" onclick="window._gwFontSize(-1)" title="Smaller text">A-</button><button class="chat-widget-ctrl-btn" onclick="window._gwFontSize(1)" title="Larger text">A+</button><button class="chat-widget-ctrl-btn" onclick="window._gwToggleTheme()" title="Toggle light/dark">\u263C</button></div><button class="chat-widget-close" onclick="window.gainwrkChat.toggle()">&times;</button></div>'+
                '<div id="chat-widget-messages"><div class="chat-msg-label agent-label">'+escapeHtml(header)+'</div><div class="chat-widget-message agent" id="chat-widget-welcome">'+escapeHtml(welcomeMsg)+'</div><div class="chat-widget-typing">'+typingAvatarHtml+'<div class="typing-dots"><span></span><span></span><span></span></div><span class="typing-text">'+escapeHtml(header)+' is typing...</span></div></div>'+
                '<div id="chat-widget-input-area"><iframe id="chat-widget-input-frame" scrolling="no" frameborder="0"></iframe></div>'+
                '<div id="chat-widget-native-input"><div class="native-wrap"><textarea id="chat-widget-native-textarea" rows="1" placeholder="'+escapeHtml(placeholder)+'" autocomplete="off" disabled></textarea><button id="chat-widget-native-btn" disabled onclick="window._gwSend()"><svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg></button></div></div>'+
                (CONFIG.SHOW_BRANDING?'<div id="chat-widget-branding"><a href="'+CONFIG.BRANDING_URL+'" target="_blank">'+CONFIG.BRANDING_TEXT+'</a></div>':'')+
            '</div>';
        document.body.appendChild(c);

        // Global handlers
        window._gwSend=doNativeSend;
        window._gwFontSize=changeFontSize;
        window._gwToggleTheme=toggleTheme;
        var ni=document.getElementById('chat-widget-native-textarea');
        if(ni){
            ni.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();doNativeSend();}});
            ni.addEventListener('input',function(){this.style.height='auto';this.style.height=Math.min(this.scrollHeight,80)+'px';});
        }

        // Desktop iframe input
        var iframe=document.getElementById('chat-widget-input-frame');
        if(iframe){
            var th=themeColors();
            var iDoc=iframe.contentDocument||iframe.contentWindow.document;
            iDoc.open();
            iDoc.write('<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box;}html,body{height:100%;overflow:hidden;background:'+th.bg+';}.wrap{display:flex;gap:10px;align-items:center;padding:8px 16px;height:100%;}textarea{flex:1;padding:10px 14px;border:1px solid '+th.inputBorder+';border-radius:24px;font-size:16px;outline:none;background:'+th.inputBg+';color:'+th.text+';font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;resize:none;overflow:hidden;line-height:1.4;max-height:40px;-webkit-appearance:none;}textarea:focus{border-color:'+currentBrandColor+';}textarea:disabled{opacity:0.5;}textarea::placeholder{color:'+th.subtext+';}button{width:40px;height:40px;border:none;background:'+currentBrandColor+';border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;-webkit-appearance:none;}button:disabled{background:rgba(128,128,128,0.2);cursor:not-allowed;}button svg{width:20px;height:20px;fill:'+tob+';}</style></head><body><div class="wrap"><textarea id="inp" rows="1" placeholder="'+escapeHtml(placeholder)+'" autocomplete="off" disabled></textarea><button id="btn" disabled><svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg></button></div><script>var inp=document.getElementById("inp"),btn=document.getElementById("btn");inp.addEventListener("keydown",function(e){if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();doSend();}});btn.addEventListener("click",function(){doSend();});function doSend(){var t=inp.value.trim();if(!t)return;parent.postMessage({type:"chat-send",text:t},"*");inp.value="";}window.addEventListener("message",function(e){var d=e.data;if(!d||!d.type)return;if(d.type==="chat-enable"){inp.disabled=false;btn.disabled=false;}if(d.type==="chat-disable"){inp.disabled=true;btn.disabled=true;}if(d.type==="chat-placeholder"){inp.placeholder=d.value||"";}if(d.type==="chat-focus"){inp.focus();}if(d.type==="chat-brand"){btn.style.background=d.color;}});<\/script></body></html>');
            iDoc.close();
        }

        window.addEventListener('message', function(e) { if(e.data&&e.data.type==='chat-send') window.gainwrkChat.send(e.data.text); });

        if(messageHistory.length>0){
            restoreMessages();
            if(!isOpen){var lm=messageHistory[messageHistory.length-1];if(lm.type==='agent'){unreadCount=1;updateBadge();}}
        }
    }

    if(window.visualViewport){
        window.visualViewport.addEventListener('resize',function(){if(!isOpen||window.innerWidth>768)return;var win=document.getElementById('chat-widget-window');if(!win)return;win.style.height=window.visualViewport.height+'px';var msgs=document.getElementById('chat-widget-messages');if(msgs)setTimeout(function(){msgs.scrollTop=msgs.scrollHeight;},50);});
        window.visualViewport.addEventListener('scroll',function(){if(!isOpen||window.innerWidth>768)return;var win=document.getElementById('chat-widget-window');if(!win)return;win.style.top=window.visualViewport.offsetTop+'px';});
    }

    // v5.7.1: Fetch with timeout to prevent infinite hangs on cold starts
    function fetchWithTimeout(url, options, timeoutMs) {
        var controller = new AbortController();
        var timer = setTimeout(function(){ controller.abort(); }, timeoutMs || 30000);
        options = options || {};
        options.signal = controller.signal;
        return fetch(url, options).finally(function(){ clearTimeout(timer); });
    }

    async function initChat() {
        if(isInitialized) return;
        var existingSession=getStoredSession();
        sessionId=existingSession||generateSessionId();
        var enableTimeout=setTimeout(function(){postToInputFrame({type:'chat-enable'});setNativeEnabled(true);isInitialized=true;},5000);
        var maxRetries = 2;
        for (var attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                var headers={'Content-Type':'application/json'};
                if(CONFIG.API_KEY) headers['X-API-Key']=CONFIG.API_KEY;
                var res=await fetchWithTimeout(CONFIG.BASE_URL+'/init',{method:'POST',headers:headers,body:JSON.stringify({client_id:CONFIG.CLIENT_ID,session_id:sessionId})}, 15000);
                clearTimeout(enableTimeout);
                var data=await res.json();
                if(res.ok){
                    isInitialized=true;
                    sessionId=data.session_id||sessionId;
                    if(data.widget_config){
                        widgetConfig=data.widget_config;
                        if(data.widget_config.ab_variant) abVariant=data.widget_config.ab_variant;
                        agentName=data.widget_config.header||CONFIG.BRAND_NAME;
                        var titleEl=document.getElementById('chat-widget-title');if(titleEl)titleEl.textContent=agentName;
                        var welcomeEl=document.getElementById('chat-widget-welcome');if(data.widget_config.welcome_message&&welcomeEl)welcomeEl.textContent=data.widget_config.welcome_message;
                        var firstLabel=document.querySelector('#chat-widget-messages .chat-msg-label');if(firstLabel)firstLabel.textContent=agentName;
                        var typingText=document.querySelector('.typing-text');if(typingText)typingText.textContent=agentName+' is typing...';
                        var previewName=document.querySelector('#chat-widget-preview .preview-name');
                        if(previewName) previewName.innerHTML='<span class="preview-dot"></span>'+escapeHtml(agentName)+'<span class="preview-time">Just now</span>';

                        // #12: Theme from config
                        if(data.widget_config.theme && data.widget_config.theme !== chatTheme) {
                            chatTheme = data.widget_config.theme;
                            var styleEl=document.querySelector('#chat-widget-container style');if(styleEl)styleEl.textContent=getStyles();
                        }

                        // #1: Add "Talk to a Human" to quick replies if not already there
                        var qr=data.widget_config.quick_replies||CONFIG.QUICK_REPLIES;
                        if(qr){
                            if(typeof qr==='string'){try{qr=JSON.parse(qr);}catch(e){qr=qr.split(',').map(function(s){return s.trim();}).filter(Boolean);}}
                        } else { qr = []; }
                        // Ensure Talk to Human is always available
                        if(Array.isArray(qr) && !qr.some(function(r){return r.toLowerCase().includes('human')||r.toLowerCase().includes('talk to');})){
                            qr.push('\uD83D\uDC64 Talk to a Human');
                        }
                        if(Array.isArray(qr)&&qr.length>0){
                            var mc=document.getElementById('chat-widget-messages');
                            if(!mc.querySelector('.quick-reply-row')){
                                var te=mc.querySelector('.chat-widget-typing');
                                var br=document.createElement('div');br.className='quick-reply-row';br.style.cssText='display:flex;flex-wrap:wrap;gap:6px;padding:6px 12px;';
                                qr.forEach(function(label){
                                    var btn=document.createElement('button');btn.textContent=label;
                                    btn.style.cssText='background:'+currentBrandColor+'15;color:'+currentBrandColor+';border:1px solid '+currentBrandColor+'40;border-radius:16px;padding:6px 14px;font-size:13px;cursor:pointer;white-space:nowrap;-webkit-tap-highlight-color:transparent;';
                                    btn.onclick=function(){
                                        // #1: "Talk to a Human" triggers contact collection
                                        if(label.includes('Human') || label.includes('human')){
                                            window.gainwrkChat.send("I'd like to speak with someone directly");
                                        } else {
                                            window.gainwrkChat.send(label);
                                        }
                                        br.remove();
                                    };
                                    br.appendChild(btn);
                                });
                                te?mc.insertBefore(br,te):mc.appendChild(br);mc.scrollTop=mc.scrollHeight;
                            }
                        }
                        if(data.widget_config.placeholder){postToInputFrame({type:'chat-placeholder',value:data.widget_config.placeholder});setNativePlaceholder(data.widget_config.placeholder);}
                        if(data.widget_config.brand_color&&data.widget_config.brand_color!=='null'&&data.widget_config.brand_color!==currentBrandColor){
                            currentBrandColor=data.widget_config.brand_color;
                            var styleEl2=document.querySelector('#chat-widget-container style');if(styleEl2)styleEl2.textContent=getStyles();
                            postToInputFrame({type:'chat-brand',color:currentBrandColor});
                        }
                        // v5.10.1: Use Avatar_URL from server config when available
                        if(data.widget_config.avatar_url){
                            faviconUrl=data.widget_config.avatar_url;
                            // Update header avatar
                            var headerAvImg=document.querySelector('.chat-widget-avatar img');if(headerAvImg)headerAvImg.src=faviconUrl;
                            // Update typing avatar
                            var typingAvImg=document.querySelector('.typing-avatar img');if(typingAvImg)typingAvImg.src=faviconUrl;
                        }
                        if(data.widget_config.auto_open_delay)CONFIG.AUTO_OPEN_DELAY=parseInt(data.widget_config.auto_open_delay)*1000;
                        if(data.widget_config.auto_open_pages){try{CONFIG.AUTO_OPEN_PAGES=typeof data.widget_config.auto_open_pages==='string'?JSON.parse(data.widget_config.auto_open_pages):data.widget_config.auto_open_pages;}catch(e){}}
                    }
                    postToInputFrame({type:'chat-enable'});setNativeEnabled(true);storeSession();setupAutoOpen();
                    if(!isOpen&&messageHistory.length===0){var wt=(widgetConfig&&widgetConfig.welcome_message)||CONFIG.WELCOME_MESSAGE;updatePreview(wt);}
                    return; // Success ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â exit retry loop
                } else { postToInputFrame({type:'chat-enable'});setNativeEnabled(true);isInitialized=true;return; }
            } catch(e){
                // v5.7.1: On timeout/network error, retry with backoff
                if (attempt < maxRetries) {
                    await new Promise(function(r){ setTimeout(r, (attempt + 1) * 2000); }); // 2s, 4s backoff
                    continue;
                }
                clearTimeout(enableTimeout);postToInputFrame({type:'chat-enable'});setNativeEnabled(true);isInitialized=true;
            }
        }
    }

    async function endSession(reason){
        if(sessionEnded||!isInitialized||messageHistory.length<2)return;sessionEnded=true;
        try{var p=JSON.stringify({client_id:CONFIG.CLIENT_ID,session_id:sessionId,reason:reason,api_key:CONFIG.API_KEY||''});if(navigator.sendBeacon){navigator.sendBeacon(CONFIG.BASE_URL+'/end-session',new Blob([p],{type:'text/plain'}));}else{await fetch(CONFIG.BASE_URL+'/end-session',{method:'POST',headers:{'Content-Type':'application/json'},body:p,keepalive:true});}}catch(e){}
    }
    window.addEventListener('beforeunload',function(){if(isInitialized&&messageHistory.length>1&&!sessionEnded)endSession('page_unload');});

    function setupAutoOpen(){
        var delay=CONFIG.AUTO_OPEN_DELAY;if(!delay||delay<=0||messageHistory.length>0)return;
        var pages=CONFIG.AUTO_OPEN_PAGES;
        if(pages&&Array.isArray(pages)&&pages.length>0){var url=window.location.href.toLowerCase();if(!pages.some(function(p){return url.includes(p.toLowerCase());}))return;}
        try{var k='chat_auto_opened_'+CONFIG.CLIENT_ID;if(sessionStorage.getItem(k))return;sessionStorage.setItem(k,'1');}catch(e){}
        setTimeout(function(){if(!isOpen&&messageHistory.length===0)window.gainwrkChat.toggle();},delay);
    }

    window.gainwrkChat = window.chatWidget = {
        toggle: function() {
            var win=document.getElementById('chat-widget-window'),bubble=document.getElementById('chat-widget-bubble'),container=document.getElementById('chat-widget-container');
            isOpen=!isOpen;
            if(isOpen){
                hasOpenedChat=true;
                win.classList.add('open');bubble.classList.add('open');unreadCount=0;updateBadge();
                var preview=document.getElementById('chat-widget-preview');if(preview)preview.style.display='none';
                if(window.innerWidth<=768){document.body.classList.add('chat-widget-open');container.classList.add('chat-open');container._scrollY=window.scrollY;}
                if(!isInitialized)initChat();
                sessionEnded=false;
                if(window.innerWidth>768)postToInputFrame({type:'chat-focus'});
            } else {
                win.classList.remove('open');bubble.classList.remove('open');container.classList.remove('chat-open');document.body.classList.remove('chat-widget-open');
                win.style.height='';win.style.top='';
                if(container._scrollY!==undefined)window.scrollTo(0,container._scrollY);
                if(messageHistory.length>0){var lb=null;for(var i=messageHistory.length-1;i>=0;i--){if(messageHistory[i].type==='agent'){lb=messageHistory[i].text;break;}}if(lb)updatePreview(lb);}
                if(isInitialized&&messageHistory.length>1)endSession('window_close');
            }
        },
        endSession: function(reason){endSession(reason);},
        send: async function(passedText) {
            var text=passedText?passedText.trim():'';if(!text||!isInitialized)return;
            addMessage(text,'user');showTyping();
            try{
                var headers={'Content-Type':'application/json'};if(CONFIG.API_KEY)headers['X-API-Key']=CONFIG.API_KEY;
                var res=await fetchWithTimeout(CONFIG.BASE_URL+'/chat',{method:'POST',headers:headers,body:JSON.stringify({client_id:CONFIG.CLIENT_ID,session_id:sessionId,message:text})}, 60000);
                var data=await res.json();hideTyping();
                if(res.ok&&data.response){addMessage(data.response,'agent');}
                else if(data.error==='Session not found'){
                    sessionId=generateSessionId();storeSession();isInitialized=false;await initChat();
                    if(isInitialized){showTyping();var r2=await fetchWithTimeout(CONFIG.BASE_URL+'/chat',{method:'POST',headers:headers,body:JSON.stringify({client_id:CONFIG.CLIENT_ID,session_id:sessionId,message:text})}, 60000);var d2=await r2.json();hideTyping();addMessage((r2.ok&&d2.response)?d2.response:(d2.error||'Sorry, something went wrong.'),'agent');}
                } else {addMessage(data.error||'Sorry, something went wrong. Please try again.','agent');}
            } catch(e){hideTyping();addMessage(e.name==='AbortError'?'Response timed out. Please try sending your message again.':'Connection error. Please check your internet and try again.','agent');}
        }
    };

    function boot(){createWidget();initChat();}
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
