/* AL-LTC community: platform-wide discussion and deliberately selected private conversations.
 * All draft/message state is memory-only. The server is authoritative for room membership. */
(function () {
  'use strict';
  const hosts = new Map();
  const app = () => window.APP;
  const owner = () => app()?.me?.()?.id ?? null;
  const token = () => app()?.token;
  const language = () => window.__lang === 'en' ? 'en' : 'ar';
  const t = (ar, en) => language() === 'ar' ? ar : en;
  const endpoint = '/community-chat';
  const emojis = ['😊', '👍', '👏', '🎯', '💡', '✅', '🙏', '🎉'];
  let sequence = 0;

  function node(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function button(text, action, className = '') {
    const el = node('button', className, text);
    el.type = 'button';
    if (action) el.dataset.ccAction = action;
    return el;
  }
  function fieldLabel(text, control) {
    const label = node('label', 'cc-field-label', text);
    label.append(control);
    return label;
  }
  const roomPath = id => `${endpoint}/${encodeURIComponent(id)}`;
  const validRoom = room => room && (room.id === 'general' || /^dm:\d+$/.test(String(room.id)));
  const roomName = room => room?.id === 'general' ? t('المجتمع العام', 'General community') : String(room?.name || t('محادثة خاصة', 'Private conversation'));
  const roomScope = room => room?.id === 'general'
    ? t('عامة · جميع أعضاء المنصة النشطين', 'General · all active platform members')
    : t('خاصة · أنت والطرف المحدد فقط', 'Private · you and the selected recipient only');
  const audience = room => room?.id === 'general'
    ? t('كل ما ترسله هنا يراه جميع أعضاء المنصة النشطين. للمحادثة الخاصة، اختر شخصًا من «محادثة خاصة جديدة».', 'Everyone with an active platform account can read messages here. For a private conversation, select someone using “New private conversation”.')
    : t(`هذه محادثة خاصة بينك وبين ${roomName(room)} فقط، ولا تظهر في المجتمع العام.`, `This conversation is private between you and ${roomName(room)} only. It does not appear in the general community.`);
  const nonce = () => window.crypto?.randomUUID?.() || `cc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  const messageId = id => Number.isSafeInteger(Number(id)) && Number(id) > 0 ? Number(id) : null;
  const isCurrent = (host, state) => host.isConnected && hosts.get(host) === state && owner() === state.owner && token() === state.token;
  const selectedRoom = state => state.rooms.find(room => room.id === state.roomId);
  const draft = state => {
    if (!state.drafts.has(state.roomId)) state.drafts.set(state.roomId, {body: '', reply: null, edit: null, nonce: null, retryBody: null, retryReply: null});
    return state.drafts.get(state.roomId);
  };
  function cleanMessages(messages) {
    return (Array.isArray(messages) ? messages : []).filter(message => messageId(message.id)).map(message => ({
      id: Number(message.id), body: message.hidden ? '' : String(message.body || ''),
      created: message.created, edited: message.edited, hidden: !!message.hidden,
      own: !!message.own, canModerate: !!message.canModerate, authorName: String(message.authorName || t('عضو المنصة', 'Platform member')),
      reply: message.reply && messageId(message.reply.id) ? {
        id: Number(message.reply.id), body: String(message.reply.body || ''), authorName: String(message.reply.authorName || t('عضو المنصة', 'Platform member'))
      } : null
    }));
  }
  function mergeMessages(previous, incoming) {
    const combined = new Map(previous.map(message => [message.id, message]));
    for (const message of incoming) combined.set(message.id, message);
    return [...combined.values()].sort((a, b) => a.id - b.id);
  }
  function timeLabel(value, full = false) {
    const date = new Date(typeof value === 'number' && value < 1e12 ? value * 1000 : value);
    if (!Number.isFinite(date.getTime())) return '';
    return full ? date.toLocaleString(language() === 'ar' ? 'ar-SA' : 'en-GB') : date.toLocaleTimeString(language() === 'ar' ? 'ar-SA' : 'en-GB', {hour: '2-digit', minute: '2-digit'});
  }
  function setStatus(host, state, text, error = false) {
    if (!ensure(host, state)) return;
    state.refs.status.textContent = text;
    state.refs.status.classList.toggle('is-error', error);
  }
  // Called at every interaction/response boundary and before each browser paint.
  function ensure(host, state) {
    if (isCurrent(host, state)) return true;
    if (hosts.get(host) === state) {
      dispose(host, state);
      if (host.isConnected) mount(host);
    }
    return false;
  }
  function dispose(host, state) {
    clearTimeout(state.poll);
    clearTimeout(state.searchTimer);
    for (const value of state.drafts.values()) { value.body = ''; value.reply = null; value.edit = null; delete value.beforeEdit; value.retryBody = null; value.nonce = null; }
    state.drafts.clear();
    state.pending.clear(); state.readIds.clear();
    state.messages.length = 0;
    state.rooms.length = 0;
    state.people.length = 0;
    state.selectedPerson = null;
    state.refs = {};
    host.replaceChildren();
    hosts.delete(host);
  }
  function deny(host, state) {
    if (!ensure(host, state)) return;
    clearTimeout(state.searchTimer);
    state.epoch++;
    state.rooms = []; state.messages = []; state.people = [];
    for (const value of state.drafts.values()) { value.body = ''; value.reply = null; value.edit = null; delete value.beforeEdit; value.retryBody = null; value.nonce = null; }
    state.drafts.clear(); state.pending.clear(); state.readIds.clear(); state.selectedPerson = null;
    state.denied = true;
    host.replaceChildren();
    const box = node('section', 'community-chat cc-unavailable');
    box.dir = language() === 'ar' ? 'rtl' : 'ltr';
    box.append(node('h3', '', t('الوصول إلى الدردشة غير متاح', 'Chat access is unavailable')),
      node('p', '', t('أُخفيت المحادثات والنصوص لحماية خصوصيتك. تحقق من تسجيل الدخول وصلاحية الحساب، ثم أعد المحاولة.', 'Conversations and drafts have been cleared to protect your privacy. Check your sign-in and account access, then try again.')));
    const retry = button(t('إعادة المحاولة', 'Try again'));
    retry.onclick = () => { dispose(host, state); mount(host); };
    box.append(retry); host.append(box);
  }
  function fail(host, state, error, fallback) {
    if (!ensure(host, state)) return;
    if ([401, 403].includes(Number(error?.status))) { deny(host, state); return; }
    setStatus(host, state, Number(error?.status) === 429
      ? t('طلبات كثيرة. انتظر قليلًا ثم أعد المحاولة؛ نصك محفوظ هنا مؤقتًا.', 'Too many requests. Wait a moment and retry; your draft is temporarily kept here.')
      : fallback, true);
  }

  function build(host, state) {
    const root = node('section', 'community-chat');
    root.dir = language() === 'ar' ? 'rtl' : 'ltr';
    root.setAttribute('aria-label', t('دردشة مجتمع المنصة', 'Platform community chat'));
    const heading = node('header', 'cc-heading');
    const titles = node('div');
    titles.append(node('span', 'cc-eyebrow', 'AL-LTC · ' + t('نتعلّم معًا', 'LEARN TOGETHER')),
      node('h3', '', t('مجتمع المنصة', 'Platform community')),
      node('p', '', t('مساحة للحوار العام والتواصل الخاص داخل المنصة.', 'A place for shared discussion and private conversations inside the platform.')));
    const refresh = button(t('تحديث', 'Refresh'), 'refresh', 'cc-quiet');
    heading.append(titles, refresh);
    const layout = node('div', 'cc-layout');
    const sidebar = node('aside', 'cc-sidebar');
    sidebar.setAttribute('aria-label', t('المحادثات', 'Conversations'));
    const sidebarTop = node('div', 'cc-sidebar-top');
    sidebarTop.append(node('h4', '', t('المحادثات', 'Conversations')));
    const newChat = button(t('محادثة خاصة جديدة', 'New private conversation'), 'directory', 'cc-new-chat');
    newChat.setAttribute('aria-expanded', 'false');
    sidebarTop.append(newChat);
    const directory = node('section', 'cc-directory'); directory.hidden = true;
    directory.id = `cc-directory-${state.id}`; newChat.setAttribute('aria-controls', directory.id);
    const search = node('input', 'cc-search'); search.type = 'search'; search.maxLength = 80;
    search.autocomplete = 'off'; search.dataset.ccSearch = '';
    search.placeholder = t('اكتب اسمًا للبحث', 'Search by name');
    const directoryHint = node('p', 'cc-directory-hint', t('الأسماء فقط. اختر شخصًا، ثم أكّد فتح محادثة خاصة معه.', 'Names only. Select a person, then confirm opening a private conversation.'));
    const results = node('div', 'cc-directory-results'); results.setAttribute('aria-live', 'polite');
    const recipient = node('div', 'cc-recipient'); recipient.hidden = true;
    directory.append(fieldLabel(t('ابحث عن عضو نشط', 'Find an active member'), search), directoryHint, results, recipient);
    const rooms = node('nav', 'cc-rooms'); rooms.setAttribute('aria-label', t('قائمة المحادثات', 'Conversation list'));
    sidebar.append(sidebarTop, directory, rooms);
    const pane = node('section', 'cc-pane');
    const conversation = node('header', 'cc-conversation-heading');
    const scope = node('span', 'cc-scope');
    const title = node('h4'); const audienceText = node('p', 'cc-audience');
    conversation.append(scope, title, audienceText);
    const history = node('div', 'cc-history');
    const older = button(t('تحميل رسائل أقدم', 'Load older messages'), 'older', 'cc-older'); older.hidden = true;
    const messages = node('ol', 'cc-messages');
    messages.setAttribute('role', 'log'); messages.setAttribute('aria-live', 'polite');
    messages.setAttribute('aria-relevant', 'additions'); messages.setAttribute('aria-label', t('رسائل المحادثة', 'Conversation messages'));
    messages.tabIndex = 0;
    const empty = node('p', 'cc-empty', t('جارٍ تحميل المحادثات…', 'Loading conversations…'));
    history.append(older, messages, empty);
    const form = node('form', 'cc-composer'); form.dataset.ccForm = '';
    const context = node('div', 'cc-compose-context'); context.hidden = true;
    const textarea = node('textarea', 'cc-draft'); textarea.rows = 2; textarea.maxLength = 2000;
    textarea.dataset.ccDraft = ''; textarea.dir = 'auto'; textarea.disabled = true;
    textarea.placeholder = t('اكتب رسالة…', 'Write a message…');
    const composerLabel = fieldLabel(t('رسالتك', 'Your message'), textarea);
    const tools = node('div', 'cc-composer-tools');
    const emoji = button(t('رموز تعبيرية', 'Emoji'), 'emoji', 'cc-emoji-toggle');
    emoji.setAttribute('aria-expanded', 'false'); emoji.setAttribute('aria-controls', `cc-emojis-${state.id}`);
    const count = node('span', 'cc-count', '0 / 2000'); count.setAttribute('aria-hidden', 'true');
    const send = button(t('إرسال', 'Send'), null, 'cc-send'); send.type = 'submit'; send.disabled = true;
    const palette = node('div', 'cc-emoji-palette'); palette.id = `cc-emojis-${state.id}`; palette.hidden = true;
    palette.setAttribute('role', 'group'); palette.setAttribute('aria-label', t('إضافة رمز تعبيري', 'Insert an emoji'));
    for (const symbol of emojis) { const pick = button(symbol, 'insert-emoji'); pick.dataset.emoji = symbol; palette.append(pick); }
    tools.append(emoji, count, send);
    const note = node('small', 'cc-composer-note', t('تواصل باحترام ولا تشارك معلومات حساسة. النصوص غير المرسلة لا تُحفظ عند مغادرة الصفحة.', 'Be respectful and avoid sensitive information. Unsent drafts are not saved when you leave the page.'));
    form.append(context, composerLabel, palette, tools, note);
    const status = node('p', 'cc-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    pane.append(conversation, history, form, status); layout.append(sidebar, pane); root.append(heading, layout); host.replaceChildren(root);
    state.refs = {root, refresh, newChat, directory, search, results, recipient, rooms, pane, scope, title, audienceText, older, messages, empty, form, context, textarea, composerLabel, emoji, palette, count, send, status};
    root.addEventListener('click', event => handleClick(host, state, event));
    search.addEventListener('input', () => {
      if (!ensure(host, state) || state.denied) return;
      clearTimeout(state.searchTimer); state.searchEpoch++; state.people = []; state.selectedPerson = null;
      state.refs.recipient.hidden = true; state.refs.results.replaceChildren();
      state.refs.results.textContent = search.value.trim() ? t('جارٍ البحث…', 'Searching…') : t('اكتب اسمًا لبدء البحث.', 'Enter a name to search.');
      state.searchTimer = setTimeout(() => searchPeople(host, state), 300);
    });
    textarea.addEventListener('input', () => {
      if (!ensure(host, state) || state.denied) return;
      draft(state).body = textarea.value; updateComposer(host, state);
    });
    // Enter remains a newline on mobile and desktop; sending is always deliberate.
    form.addEventListener('submit', event => { event.preventDefault(); sendMessage(host, state); });
    messages.addEventListener('scroll', () => { if (ensure(host, state) && nearBottom(messages)) markRead(host, state); }, {passive: true});
  }

  function renderRooms(host, state) {
    if (!ensure(host, state) || state.denied) return;
    const signature = JSON.stringify([state.roomId, state.rooms, language()]);
    if (signature === state.roomSignature) return;
    state.roomSignature = signature;
    const focusRoom = state.refs.rooms.contains(document.activeElement) ? document.activeElement?.dataset.roomId : null;
    const items = state.rooms.map(room => {
      const item = button('', 'room', 'cc-room' + (state.roomId === room.id ? ' is-selected' : ''));
      item.dataset.roomId = room.id; item.setAttribute('aria-pressed', String(state.roomId === room.id));
      const name = node('span', 'cc-room-name', roomName(room));
      const scope = node('small', 'cc-room-scope', room.id === 'general' ? t('عامة للجميع داخل المنصة', 'General · platform members') : t('محادثة خاصة', 'Private conversation'));
      item.append(name, scope);
      const unread = Math.max(0, Math.floor(Number(room.unread) || 0));
      if (unread) { const badge = node('span', 'cc-unread', unread > 99 ? '99+' : String(unread)); badge.setAttribute('aria-label', t(`${unread} رسالة غير مقروءة`, `${unread} unread messages`)); item.append(badge); }
      return item;
    });
    state.refs.rooms.replaceChildren(...items);
    if (focusRoom) [...state.refs.rooms.children].find(item => item.dataset.roomId === focusRoom)?.focus({preventScroll: true});
  }
  function renderHeader(host, state) {
    if (!ensure(host, state) || state.denied) return;
    const room = selectedRoom(state); if (!room) return;
    state.refs.scope.textContent = roomScope(room);
    state.refs.title.textContent = roomName(room);
    state.refs.audienceText.textContent = audience(room);
    state.refs.pane.classList.toggle('is-private', room.id !== 'general');
    state.refs.textarea.setAttribute('aria-label', room.id === 'general' ? t('رسالة عامة إلى جميع أعضاء المنصة النشطين', 'General message to all active platform members') : t(`رسالة خاصة إلى ${roomName(room)}`, `Private message to ${roomName(room)}`));
    updateComposer(host, state, true);
  }
  const nearBottom = list => list.scrollHeight - list.clientHeight - list.scrollTop < 70;
  function renderMessages(host, state, mode = 'refresh') {
    if (!ensure(host, state) || state.denied) return;
    const list = state.refs.messages;
    const signature = JSON.stringify([state.messages, language()]);
    state.refs.older.hidden = !state.hasMore;
    state.refs.older.disabled = state.loadingOlder;
    state.refs.empty.hidden = state.messages.length > 0;
    state.refs.empty.textContent = state.loadingMessages && !state.messages.length ? t('جارٍ تحميل الرسائل…', 'Loading messages…') : t('بداية حوار جديد. اكتب أول رسالة عندما تكون مستعدًا.', 'A new conversation starts here. Write the first message when you’re ready.');
    if (signature === state.messageSignature) return;
    state.messageSignature = signature;
    const bottom = nearBottom(list), scrollTop = list.scrollTop, height = list.scrollHeight;
    const focused = list.contains(document.activeElement) ? {id: document.activeElement?.dataset.messageId, action: document.activeElement?.dataset.ccAction} : null;
    const fragment = document.createDocumentFragment();
    let previousDay = '';
    for (const message of state.messages) {
      const created = new Date(typeof message.created === 'number' && message.created < 1e12 ? message.created * 1000 : message.created);
      const day = Number.isFinite(created.getTime()) ? created.toLocaleDateString(language() === 'ar' ? 'ar-SA' : 'en-GB', {day:'numeric', month:'short', year:'numeric'}) : '';
      if (day && day !== previousDay) { const divider = node('li', 'cc-day', day); fragment.append(divider); previousDay = day; }
      const item = node('li', 'cc-message' + (message.own ? ' is-own' : '') + (message.hidden ? ' is-hidden' : ''));
      item.dataset.messageId = String(message.id);
      const bubble = node('article', 'cc-bubble');
      const author = node('strong', 'cc-author', message.own ? t('أنت', 'You') : message.authorName); author.dir = 'auto'; bubble.append(author);
      if (message.reply) {
        const quote = node('div', 'cc-reply-quote');
        quote.append(node('strong', '', message.reply.authorName), node('span', '', message.reply.body || t('الرسالة الأصلية غير متاحة', 'Original message unavailable'))); bubble.append(quote);
      }
      const body = node('p', 'cc-message-body', message.hidden ? t('حُذفت هذه الرسالة', 'This message was deleted') : message.body); body.dir = 'auto'; bubble.append(body);
      const footer = node('div', 'cc-message-meta');
      const timestamp = node('time', '', timeLabel(message.created));
      if (Number.isFinite(created.getTime())) timestamp.dateTime = created.toISOString();
      timestamp.title = timeLabel(message.created, true); footer.append(timestamp);
      if (message.edited && !message.hidden) footer.append(node('span', '', t('معدّلة', 'Edited')));
      if (!message.hidden || (message.canModerate && state.roomId === 'general')) {
        const actions = node('div', 'cc-message-actions');
        const available = message.hidden ? [['restore', t('إعادة إظهار', 'Restore')]] : [['reply', t('رد', 'Reply')], ...(message.own ? [['edit', t('تعديل', 'Edit')]] : []), ...(message.own || message.canModerate && state.roomId === 'general' ? [['delete', message.own ? t('حذف', 'Delete') : t('إخفاء', 'Hide')]] : [])];
        for (const [action, label] of available) {
          const control = button(label, action); control.dataset.messageId = String(message.id); actions.append(control);
        }
        footer.append(actions);
      }
      bubble.append(footer); item.append(bubble); fragment.append(item);
    }
    list.replaceChildren(fragment);
    if (mode === 'older') list.scrollTop = scrollTop + list.scrollHeight - height;
    else if (bottom || mode === 'initial' || mode === 'sent') list.scrollTop = list.scrollHeight;
    else list.scrollTop = scrollTop;
    if (focused) [...list.querySelectorAll('button')].find(control => control.dataset.messageId === focused.id && control.dataset.ccAction === focused.action)?.focus({preventScroll: true});
    if (nearBottom(list)) markRead(host, state);
  }
  function updateComposer(host, state, restore = false) {
    if (!ensure(host, state) || state.denied) return;
    const room = selectedRoom(state), current = draft(state), refs = state.refs;
    if (restore && refs.textarea.value !== current.body) refs.textarea.value = current.body;
    state.sending = state.pending.has(state.roomId);
    refs.textarea.disabled = !room || state.sending;
    refs.send.disabled = !room || state.sending || !current.body.trim();
    refs.send.textContent = state.sending ? t('جارٍ الحفظ…', 'Saving…') : current.edit ? t('حفظ التعديل', 'Save edit') : room?.id === 'general' ? t('إرسال للعامة', 'Send to general') : t('إرسال خاص', 'Send privately');
    refs.emoji.disabled = !room || state.sending;
    refs.count.textContent = `${current.body.length} / 2000`;
    const contextKey = JSON.stringify([current.edit, current.reply, language()]);
    if (contextKey !== state.contextSignature) {
      state.contextSignature = contextKey;
      refs.context.replaceChildren(); refs.context.hidden = !current.edit && !current.reply;
      if (!refs.context.hidden) {
        const text = node('div');
        text.append(node('strong', '', current.edit ? t('تعديل رسالتك', 'Editing your message') : t(`رد على ${current.reply.authorName}`, `Replying to ${current.reply.authorName}`)));
        text.append(node('span', '', current.edit ? t('سيظهر التعديل للمشاركين في هذه المحادثة.', 'The edit will be visible to participants in this conversation.') : current.reply.body));
        const cancel = button(t('إلغاء', 'Cancel'), 'cancel-compose'); cancel.disabled = state.sending; refs.context.append(text, cancel);
      }
    }
    const cancel = refs.context.querySelector('button'); if (cancel) cancel.disabled = state.sending;
  }

  async function loadRooms(host, state) {
    if (!ensure(host, state) || state.denied || state.loadingRooms) return;
    state.loadingRooms = true;
    const version = state.roomsVersion;
    try {
      const response = await app().api(`${endpoint}/rooms`);
      if (!ensure(host, state) || state.denied || version !== state.roomsVersion) return;
      state.rooms = (Array.isArray(response.rooms) ? response.rooms : []).filter(validRoom).map(room => ({...room, id: String(room.id)}));
      if (state.roomId && !state.rooms.some(room => room.id === state.roomId)) {
        state.drafts.delete(state.roomId); state.messages = []; state.roomId = null; state.epoch++;
        state.refs.scope.textContent = ''; state.refs.title.textContent = ''; state.refs.audienceText.textContent = '';
        state.refs.textarea.value = ''; state.refs.textarea.disabled = true; state.refs.send.disabled = true;
        state.refs.context.hidden = true; state.refs.messages.replaceChildren(); state.refs.older.hidden = true; state.refs.empty.hidden = false;
      }
      renderRooms(host, state);
      if (!state.roomId && state.rooms.length) selectRoom(host, state, state.rooms.find(room => room.id === 'general')?.id || state.rooms[0].id);
      else if (state.roomId) renderHeader(host, state);
      else state.refs.empty.textContent = t('لا توجد محادثات متاحة لهذا الحساب.', 'No conversations are available for this account.');
    } catch (error) { fail(host, state, error, t('تعذر تحديث المحادثات. أعد المحاولة.', 'Could not refresh conversations. Please try again.')); }
    finally { if (isCurrent(host, state)) state.loadingRooms = false; }
  }
  async function loadMessages(host, state, older = false) {
    if (!ensure(host, state) || state.denied || !state.roomId || state.loadingMessages || state.loadingOlder) return;
    const roomId = state.roomId, epoch = state.epoch, version = state.messageVersion;
    const first = state.messages[0]?.id;
    if (older && (!first || !state.hasMore)) return;
    if (older) state.loadingOlder = true; else state.loadingMessages = true;
    state.refs.older.disabled = true;
    try {
      const response = await app().api(`${roomPath(roomId)}/messages${older ? '?before=' + encodeURIComponent(first) : ''}`);
      if (!ensure(host, state) || state.denied || epoch !== state.epoch || roomId !== state.roomId || version !== state.messageVersion) return;
      const initial = !state.messages.length;
      const incoming = cleanMessages(response.messages);
      // Refresh revalidates the visible window rather than retaining old bodies
      // indefinitely after another participant or moderator hides a message.
      state.messages = older ? mergeMessages(state.messages, incoming) : incoming;
      state.hasMore = !!response.hasMore;
      state.loadedOlder = older;
      if (validRoom(response.room) && response.room.id === roomId) {
        state.rooms = state.rooms.map(room => room.id === roomId ? {...room, ...response.room} : room);
        renderHeader(host, state); renderRooms(host, state);
      }
      state.loadingMessages = false; state.loadingOlder = false;
      renderMessages(host, state, older ? 'older' : initial ? 'initial' : 'refresh');
    } catch (error) {
      if (ensure(host, state) && epoch === state.epoch) fail(host, state, error, t('تعذر تحميل الرسائل. يمكنك إعادة المحاولة؛ نصك لم يُفقد.', 'Could not load messages. You can retry; your draft has not been lost.'));
    } finally {
      if (isCurrent(host, state) && epoch === state.epoch) {
        state.loadingMessages = false; state.loadingOlder = false;
        if (!state.denied) state.refs.older.disabled = false;
      }
    }
  }
  function selectRoom(host, state, roomId) {
    if (!ensure(host, state) || state.denied || !state.rooms.some(room => room.id === roomId)) return;
    if (roomId === state.roomId) return;
    state.epoch++; state.roomId = roomId; state.messages = []; state.messageSignature = '';
    state.hasMore = false; state.loadedOlder = false; state.loadingMessages = false; state.loadingOlder = false;
    state.sending = false; state.confirmDelete = null; state.contextSignature = '';
    state.refs.palette.hidden = true; state.refs.emoji.setAttribute('aria-expanded', 'false');
    state.refs.status.textContent = '';
    renderRooms(host, state); renderHeader(host, state); renderMessages(host, state, 'initial');
    state.refs.empty.textContent = t('جارٍ تحميل الرسائل…', 'Loading messages…');
    loadMessages(host, state);
  }
  async function markRead(host, state) {
    if (!ensure(host, state) || state.denied || document.hidden || !state.roomId || state.reading || !nearBottom(state.refs.messages)) return;
    const id = state.messages.at(-1)?.id, roomId = state.roomId, epoch = state.epoch;
    if (!id || (state.readIds.get(roomId) || 0) >= id) return;
    state.reading = true;
    try {
      await app().api(`${roomPath(roomId)}/read`, {method: 'POST', body: {lastId: id}});
      if (!ensure(host, state) || state.denied || epoch !== state.epoch) return;
      state.readIds.set(roomId, id); state.roomsVersion++;
      state.rooms = state.rooms.map(room => room.id === roomId ? {...room, unread: 0} : room); renderRooms(host, state);
    } catch (error) {
      if ([401, 403].includes(Number(error?.status)) && ensure(host, state) && epoch === state.epoch) deny(host, state);
    } finally { if (isCurrent(host, state)) state.reading = false; }
  }
  async function searchPeople(host, state) {
    if (!ensure(host, state) || state.denied) return;
    const query = state.refs.search.value.trim(), epoch = ++state.searchEpoch;
    if (query.length < 2) { state.refs.results.textContent = t('اكتب حرفين على الأقل للبحث.', 'Enter at least two characters to search.'); return; }
    try {
      const response = await app().api(`${endpoint}/directory?q=${encodeURIComponent(query)}`);
      if (!ensure(host, state) || state.denied || epoch !== state.searchEpoch || state.refs.search.value.trim() !== query) return;
      state.people = (Array.isArray(response.people) ? response.people : []).filter(person => person.id != null && String(person.id) !== String(state.owner));
      const items = state.people.map(person => { const item = button(String(person.name || t('عضو المنصة', 'Platform member')), 'person', 'cc-person'); item.dataset.personId = String(person.id); return item; });
      state.refs.results.replaceChildren(...items);
      if (!items.length) state.refs.results.textContent = t('لا توجد أسماء مطابقة. جرّب اسمًا آخر.', 'No matching names. Try another name.');
    } catch (error) {
      if (!ensure(host, state) || epoch !== state.searchEpoch) return;
      state.refs.results.textContent = t('تعذر البحث. جرّب مجددًا.', 'Search failed. Please try again.');
      fail(host, state, error, t('تعذر البحث عن الأعضاء.', 'Could not search members.'));
    }
  }
  function choosePerson(host, state, id) {
    const person = state.people.find(item => String(item.id) === id); if (!person) return;
    state.selectedPerson = person;
    const text = node('p', '', t(`هل تريد فتح محادثة خاصة مع ${person.name}؟ لن تُرسل أي رسالة الآن.`, `Open a private conversation with ${person.name}? No message will be sent now.`));
    const confirm = button(t('فتح المحادثة الخاصة', 'Open private conversation'), 'start-direct', 'cc-confirm');
    const cancel = button(t('اختيار شخص آخر', 'Choose someone else'), 'cancel-person', 'cc-quiet');
    state.refs.recipient.replaceChildren(text, confirm, cancel); state.refs.recipient.hidden = false;
    confirm.focus();
  }
  async function startDirect(host, state) {
    if (!ensure(host, state) || state.denied || state.startingDirect || !state.selectedPerson) return;
    const person = state.selectedPerson, epoch = state.searchEpoch;
    state.startingDirect = true;
    const confirm = state.refs.recipient.querySelector('[data-cc-action="start-direct"]'); if (confirm) confirm.disabled = true;
    try {
      const response = await app().api(`${endpoint}/direct`, {method: 'POST', body: {recipientId: person.id}});
      if (!ensure(host, state) || state.denied || epoch !== state.searchEpoch || state.selectedPerson !== person) return;
      if (!validRoom(response.room) || response.room.id === 'general') throw new Error('Invalid direct conversation');
      state.roomsVersion++;
      state.rooms = [response.room, ...state.rooms.filter(room => room.id !== response.room.id)];
      state.refs.directory.hidden = true; state.refs.newChat.setAttribute('aria-expanded', 'false');
      state.refs.search.value = ''; state.refs.results.replaceChildren(); state.refs.recipient.hidden = true;
      state.people = []; state.selectedPerson = null;
      selectRoom(host, state, response.room.id); renderRooms(host, state);
      state.refs.textarea.focus();
    } catch (error) { fail(host, state, error, t('تعذر فتح المحادثة الخاصة. أعد المحاولة.', 'Could not open the private conversation. Please retry.')); }
    finally {
      if (isCurrent(host, state)) {
        state.startingDirect = false;
        if (!state.denied) { const control = state.refs.recipient.querySelector('[data-cc-action="start-direct"]'); if (control) control.disabled = false; }
      }
    }
  }
  async function sendMessage(host, state) {
    if (!ensure(host, state) || state.denied || state.sending || !selectedRoom(state)) return;
    const current = draft(state), body = current.body.trim(); if (!body || body.length > 2000) return;
    const roomId = state.roomId, epoch = state.epoch, editId = current.edit;
    const replyTo = current.reply?.id || null;
    if (!editId && (current.retryBody !== body || current.retryReply !== replyTo || !current.nonce)) {
      current.nonce = nonce(); current.retryBody = body; current.retryReply = replyTo;
    }
    state.pending.set(roomId, current); state.sending = true; state.messageVersion++;
    updateComposer(host, state);
    setStatus(host, state, t('جارٍ الحفظ؛ لم يتأكد الإرسال بعد.', 'Saving; delivery is not confirmed yet.'));
    try {
      const response = await app().api(`${roomPath(roomId)}/messages${editId ? '/' + encodeURIComponent(editId) : ''}`, {
        method: editId ? 'PATCH' : 'POST', body: editId ? {body} : {body, nonce: current.nonce, ...(replyTo ? {replyTo} : {})}
      });
      if (!ensure(host, state) || state.denied) return;
      // Clear only the submitted draft, never a newer room's composer.
      if (state.drafts.get(roomId) === current) state.drafts.set(roomId, {body: editId ? current.beforeEdit?.body || '' : '', reply: editId ? current.beforeEdit?.reply || null : null, edit: null, nonce: null, retryBody: null, retryReply: null});
      state.pending.delete(roomId);
      if (roomId !== state.roomId) return;
      const messages = cleanMessages([response.message].filter(Boolean));
      if (messages.length) state.messages = mergeMessages(state.messages, messages);
      state.messageVersion++; state.contextSignature = '';
      state.sending = false;
      updateComposer(host, state, true); renderMessages(host, state, 'sent');
      setStatus(host, state, editId ? t('حُفظ التعديل.', 'Edit saved.') : t('حُفظت الرسالة في المحادثة.', 'Message saved in this conversation.'));
      state.refs.textarea.focus();
      loadMessages(host, state);
    } catch (error) {
      if (ensure(host, state) && roomId === state.roomId) fail(host, state, error, t('لم يتأكد الحفظ. احتفظنا بنصك هنا؛ أعد المحاولة دون تكرار الرسالة.', 'Saving was not confirmed. Your draft remains here; retry without duplicating the message.'));
    } finally {
      if (isCurrent(host, state) && !state.denied) { state.pending.delete(roomId); if (roomId === state.roomId) updateComposer(host, state); }
    }
  }
  async function deleteMessage(host, state, id, hidden = true) {
    if (!ensure(host, state) || state.denied || state.deleting) return;
    const message = state.messages.find(item => item.id === id);
    if (!message || (hidden ? !message.own && !(message.canModerate && state.roomId === 'general') : !(message.canModerate && state.roomId === 'general')) || message.hidden === hidden) return;
    const roomId = state.roomId, epoch = state.epoch;
    state.deleting = true; state.messageVersion++;
    try {
      const response = await app().api(`${roomPath(roomId)}/messages/${id}`, {method: 'PATCH', body: {hidden}});
      if (!ensure(host, state) || state.denied || epoch !== state.epoch) return;
      const updated = cleanMessages(response.message ? [response.message] : [{...message, hidden}])[0];
      state.messages = state.messages.map(item => item.id === id ? updated : hidden && item.reply?.id === id ? {...item, reply: {...item.reply, body: ''}} : item);
      const current = draft(state); if (current.reply?.id === id) current.reply = null;
      if (current.edit === id) { current.edit = null; current.body = current.beforeEdit?.body || ''; current.reply = current.beforeEdit?.reply || null; delete current.beforeEdit; }
      state.messageVersion++; updateComposer(host, state, true); renderMessages(host, state);
      setStatus(host, state, hidden ? t('أُخفيت الرسالة من المحادثة.', 'Message hidden from the conversation.') : t('أُعيد إظهار الرسالة.', 'Message restored.'));
      loadMessages(host, state);
    } catch (error) {
      if (ensure(host, state) && epoch === state.epoch) fail(host, state, error, t('تعذر تأكيد الحذف. حدّث المحادثة قبل المحاولة مجددًا.', 'Deletion was not confirmed. Refresh the conversation before trying again.'));
    } finally { if (isCurrent(host, state)) state.deleting = false; }
  }
  function handleClick(host, state, event) {
    const control = event.target.closest('button[data-cc-action]');
    if (!control || !host.contains(control) || !ensure(host, state) || state.denied || control.disabled) return;
    const action = control.dataset.ccAction;
    if (action === 'refresh') { loadRooms(host, state); loadMessages(host, state); return; }
    if (action === 'room') { selectRoom(host, state, control.dataset.roomId); return; }
    if (action === 'older') { loadMessages(host, state, true); return; }
    if (action === 'directory') {
      state.refs.directory.hidden = !state.refs.directory.hidden;
      state.refs.newChat.setAttribute('aria-expanded', String(!state.refs.directory.hidden));
      if (!state.refs.directory.hidden) { state.refs.search.focus(); if (!state.refs.search.value) state.refs.results.textContent = t('اكتب اسمًا لبدء البحث.', 'Enter a name to search.'); }
      return;
    }
    if (action === 'person') { choosePerson(host, state, control.dataset.personId); return; }
    if (action === 'cancel-person') { state.selectedPerson = null; state.refs.recipient.hidden = true; state.refs.search.focus(); return; }
    if (action === 'start-direct') { startDirect(host, state); return; }
    if (action === 'emoji') {
      state.refs.palette.hidden = !state.refs.palette.hidden;
      state.refs.emoji.setAttribute('aria-expanded', String(!state.refs.palette.hidden));
      return;
    }
    const current = draft(state);
    if (action === 'insert-emoji') {
      if (state.sending) return;
      const field = state.refs.textarea, start = field.selectionStart, end = field.selectionEnd, symbol = control.dataset.emoji;
      if (field.value.length - (end - start) + symbol.length > 2000) return;
      field.setRangeText(symbol, start, end, 'end'); current.body = field.value;
      updateComposer(host, state); field.focus(); return;
    }
    if (action === 'cancel-compose') {
      if (state.sending) return;
      if (current.edit) { current.body = current.beforeEdit?.body || ''; current.reply = current.beforeEdit?.reply || null; current.edit = null; delete current.beforeEdit; }
      else current.reply = null;
      updateComposer(host, state, true); state.refs.textarea.focus(); return;
    }
    const id = messageId(control.dataset.messageId), message = state.messages.find(item => item.id === id);
    if (!message || state.sending) return;
    if (action === 'restore' && message.hidden && message.canModerate && state.roomId === 'general') { deleteMessage(host, state, id, false); return; }
    if (message.hidden) return;
    if (action === 'reply') {
      if (current.edit) { current.body = current.beforeEdit?.body || ''; current.edit = null; delete current.beforeEdit; }
      current.reply = {id: message.id, body: message.body, authorName: message.authorName};
      updateComposer(host, state, true); state.refs.textarea.focus();
    } else if (action === 'edit' && message.own) {
      if (!current.edit) current.beforeEdit = {body: current.body, reply: current.reply};
      current.edit = message.id; current.body = message.body; current.reply = null;
      updateComposer(host, state, true); state.refs.textarea.focus();
    } else if (action === 'delete' && (message.own || message.canModerate && state.roomId === 'general')) {
      if (window.confirm(t('إخفاء هذه الرسالة من المحادثة لجميع المشاركين؟', 'Hide this message from the conversation for all participants?'))) deleteMessage(host, state, id);
    }
  }
  function mount(host) {
    if (!host?.isConnected) return;
    if (hosts.has(host)) dispose(host, hosts.get(host));
    const state = {id: ++sequence, owner: owner(), token: token(), lang: language(), epoch: 0, searchEpoch: 0, roomsVersion: 0, messageVersion: 0,
      rooms: [], messages: [], people: [], drafts: new Map(), pending: new Map(), readIds: new Map(), roomId: null, refs: {}};
    hosts.set(host, state);
    if (state.owner === null) {
      const box = node('section', 'community-chat cc-unavailable'); box.dir = language() === 'ar' ? 'rtl' : 'ltr';
      box.append(node('h3', '', t('انضم إلى الحوار', 'Join the conversation')), node('p', '', t('سجّل الدخول بحساب نشط لرؤية المجتمع العام ومحادثاتك الخاصة.', 'Sign in with an active account to see the general community and your private conversations.')));
      if (app()?.openAuth) { const login = button(t('تسجيل الدخول', 'Sign in')); login.onclick = () => app().openAuth(); box.append(login); }
      host.replaceChildren(box); return;
    }
    build(host, state); loadRooms(host, state);
    async function poll() {
      if (!ensure(host, state) || state.denied) return;
      if (!document.hidden && !state.sending) { await loadRooms(host, state); if (ensure(host, state) && !state.denied) await loadMessages(host, state); }
      if (isCurrent(host, state) && !state.denied) state.poll = setTimeout(poll, 15000);
    }
    state.poll = setTimeout(poll, 15000);
  }
  function scan() {
    for (const [host, state] of hosts) {
      if (!host.isConnected) dispose(host, state);
      else if ((owner() !== state.owner || token() !== state.token)) { dispose(host, state); mount(host); }
      else if (language() !== state.lang) {
        // Retain the same account's in-memory drafts across language-only changes.
        if (state.owner === null || state.denied) { dispose(host, state); mount(host); continue; }
        state.lang = language(); state.roomSignature = ''; state.messageSignature = ''; state.contextSignature = '';
        build(host, state); renderRooms(host, state); renderHeader(host, state); renderMessages(host, state);
      }
    }
    document.querySelectorAll('[data-community-chat]').forEach(host => { if (!hosts.has(host)) mount(host); });
  }
  new MutationObserver(scan).observe(document.body, {subtree: true, childList: true});
  new MutationObserver(scan).observe(document.documentElement, {attributes: true, attributeFilter: ['lang', 'dir']});
  // Auth changes elsewhere in the SPA are scrubbed before another frame, including
  // when no route is changed. No draft or message is ever read from browser storage.
  function authFrame() { if (hosts.size) { for (const [host, state] of hosts) if ((owner() !== state.owner || token() !== state.token)) { dispose(host, state); if (host.isConnected) mount(host); } } window.requestAnimationFrame(authFrame); }
  window.requestAnimationFrame(authFrame);
  for (const event of ['hashchange', 'focus', 'alsaeed:auth-changed']) window.addEventListener(event, scan);
  window.addEventListener('storage', event => {
    if (event.key !== 'alsaeed_token' && event.key !== null) return;
    for (const [host, state] of hosts) if (state.owner !== null && (event.key === null || event.newValue !== state.token)) {
      deny(host, state);
      const retry = host.querySelector('button');
      if (retry) { retry.textContent = t('تحديث تسجيل الدخول', 'Refresh sign-in'); retry.onclick = () => window.location.reload(); }
    }
  });
  document.addEventListener('visibilitychange', () => { scan(); if (!document.hidden) for (const [host, state] of hosts) if (state.owner !== null && !state.denied) { loadRooms(host, state); loadMessages(host, state); } });
  document.addEventListener('click', scan, true);
  scan();
  window.AlsaeedCommunityChat = {mount, refresh: () => { scan(); for (const [host, state] of hosts) if (state.owner !== null && !state.denied) { loadRooms(host, state); loadMessages(host, state); } }};
})();
