import { extension_settings, getContext } from '../../../extensions.js';
import { saveSettingsDebounced } from '../../../../script.js';
import { openGroupById, openGroupChat } from '../../../group-chats.js';

const EXTENSION_NAME = 'third-party/Floating-Frost-Telegram-UI';
const EXTENSION_PATH = '/scripts/extensions/third-party/Floating-Frost-Telegram-UI';
const ROOT_CLASS = 'fft-enabled';

const defaults = Object.freeze({
    enabled: true,
    theme: 'dark',
    density: 'comfortable',
    blur: 18,
    wallpaperDim: 18,
    highContrast: false,
    motion: true,
    mobileEffects: false,
    desktopShell: true,
    mobileShell: true,
    autoLayout: true,
    hiddenTools: [],
    toolOrder: [],
});

let observer;
let chatListQuery = '';
let recentChats = [];
let mobileScreen = 'chats';
const mobileMedia = window.matchMedia('(max-width: 1000px)');

function updateViewportMetrics() {
    const viewport = window.visualViewport;
    const height = viewport?.height || window.innerHeight;
    const keyboardInset = Math.max(0, window.innerHeight - height - (viewport?.offsetTop || 0));
    document.documentElement.style.setProperty('--fft-viewport-height', `${height}px`);
    document.documentElement.style.setProperty('--fft-keyboard-inset', `${keyboardInset}px`);
}

function settings() {
    extension_settings[EXTENSION_NAME] ??= {};
    const current = extension_settings[EXTENSION_NAME];
    for (const [key, value] of Object.entries(defaults)) {
        current[key] ??= value;
    }
    return current;
}

function decorateMessage(element) {
    if (!(element instanceof HTMLElement) || !element.matches('.mes')) return;
    element.classList.add('fft-message');
    element.dataset.fftDecorated = 'true';
}

function decorateMessages(root = document) {
    root.querySelectorAll?.('#chat .mes').forEach(decorateMessage);
}

function applyState() {
    const value = settings();
    const root = document.documentElement;
    const useMobileLayout = value.autoLayout ? mobileMedia.matches : Boolean(value.mobileShell && !value.desktopShell);
    const mobileActive = Boolean(value.enabled && value.mobileShell && useMobileLayout);
    const desktopActive = Boolean(value.enabled && value.desktopShell && !useMobileLayout);
    root.classList.toggle(ROOT_CLASS, Boolean(value.enabled));
    root.classList.toggle('fft-no-motion', !value.motion);
    root.classList.toggle('fft-mobile-effects', Boolean(value.mobileEffects));
    root.classList.toggle('fft-high-contrast', Boolean(value.highContrast));
    root.classList.toggle('fft-desktop-shell', desktopActive);
    root.classList.toggle('fft-desktop-active', desktopActive);
    root.classList.toggle('fft-mobile-shell', Boolean(value.mobileShell));
    root.classList.toggle('fft-mobile-active', mobileActive);
    root.dataset.fftDensity = value.density;
    root.dataset.fftTheme = value.theme;
    root.style.setProperty('--fft-blur', `${Number(value.blur) || 0}px`);
    root.style.setProperty('--fft-wallpaper-dim', String(Math.max(0, Math.min(80, Number(value.wallpaperDim) || 0)) / 100));
    if (value.enabled) decorateMessages();
    updateMobileShell();
}

function syncControls() {
    const value = settings();
    $('#fft_enabled').prop('checked', value.enabled);
    $('#fft_theme').val(value.theme);
    $('#fft_density').val(value.density);
    $('#fft_blur').val(value.blur);
    $('#fft_wallpaper_dim').val(value.wallpaperDim);
    $('#fft_high_contrast').prop('checked', value.highContrast);
    $('#fft_motion').prop('checked', value.motion);
    $('#fft_mobile_effects').prop('checked', value.mobileEffects);
    $('#fft_desktop_shell').prop('checked', value.desktopShell);
    $('#fft_mobile_shell_enabled').prop('checked', value.mobileShell);
    $('#fft_auto_layout').prop('checked', value.autoLayout);
}

function updateSetting(key, value) {
    settings()[key] = value;
    applyState();
    saveSettingsDebounced();
}

function clickVisible(selector) {
    const target = [...document.querySelectorAll(selector)].find(element => element.getClientRects().length > 0);
    target?.click();
}

function clickNativeOption(selector) {
    const liveOption = document.querySelector(`body > #options ${selector}`);
    liveOption?.click();
}

function getLiveDrawer(selector) {
    return [...document.querySelectorAll(selector)].find(element => element.closest('#top-settings-holder')?.parentElement === document.body);
}

function setLiveDrawerState(panel, open, icon = null) {
    if (open) {
        document.querySelectorAll('body > #top-settings-holder .drawer-content.openDrawer').forEach(other => {
            if (other === panel) return;
            other.classList.remove('openDrawer');
            other.classList.add('closedDrawer');
        });
    }
    panel.classList.toggle('openDrawer', open);
    panel.classList.toggle('closedDrawer', !open);
    icon?.classList.toggle('openIcon', open);
    icon?.classList.toggle('closedIcon', !open);
}

function toggleLiveDrawer(panelSelector, iconSelector) {
    const panel = getLiveDrawer(panelSelector);
    if (!panel) return;
    const icon = [...document.querySelectorAll(iconSelector)].find(element => element.getClientRects().length > 0);
    setLiveDrawerState(panel, !panel.classList.contains('openDrawer'), icon);
}

function bindLiveTopBar() {
    const holder = document.querySelector('body > #top-settings-holder');
    if (!holder || holder.dataset.fftBound === 'true') return;
    holder.dataset.fftBound = 'true';
    holder.addEventListener('click', event => {
        const toggle = event.target.closest('.drawer-toggle');
        const drawer = toggle?.closest('.drawer');
        if (!drawer || drawer.parentElement !== holder) return;
        const panel = drawer.querySelector(':scope > .drawer-content');
        if (!panel) return;
        const icon = toggle.querySelector('.drawer-icon');
        const shouldOpen = !panel.classList.contains('openDrawer');
        setTimeout(() => setLiveDrawerState(panel, shouldOpen, icon), 0);
    }, true);
}

const icons = Object.freeze({
    info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 10.7v6M12 7.2h.01"/></svg>',
    sliders: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6"/></svg>',
    users: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.5-3.2 2.3-5 5.5-5s5 1.8 5.5 5M16 5.5a3 3 0 0 1 0 5.8M16 14c2.7.2 4.2 1.8 4.5 4.5"/></svg>',
    note: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5h9l3 3V20.5H6z"/><path d="M15 3.5v4h3M9 11h6M9 15h6"/></svg>',
    history: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6v5h5"/><path d="M5.5 10.5A7.5 7.5 0 1 1 7 17.8"/><path d="M12 8v4l3 2"/></svg>',
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    chats: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14v10H9l-4 4z"/></svg>',
    tools: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 6a4 4 0 0 0 4 4l-8 8-4-4 8-8z"/><path d="M16 4l4 4"/></svg>',
    settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"/></svg>',
    more: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>',
});

function bindControls() {
    $('#fft_enabled').on('input', event => updateSetting('enabled', event.currentTarget.checked));
    $('#fft_theme').on('change', event => updateSetting('theme', event.currentTarget.value));
    $('#fft_density').on('change', event => updateSetting('density', event.currentTarget.value));
    $('#fft_blur').on('input', event => updateSetting('blur', Number(event.currentTarget.value)));
    $('#fft_wallpaper_dim').on('input', event => updateSetting('wallpaperDim', Number(event.currentTarget.value)));
    $('#fft_high_contrast').on('input', event => updateSetting('highContrast', event.currentTarget.checked));
    $('#fft_motion').on('input', event => updateSetting('motion', event.currentTarget.checked));
    $('#fft_mobile_effects').on('input', event => updateSetting('mobileEffects', event.currentTarget.checked));
    $('#fft_desktop_shell').on('input', event => updateSetting('desktopShell', event.currentTarget.checked));
    $('#fft_mobile_shell_enabled').on('input', event => updateSetting('mobileShell', event.currentTarget.checked));
    $('#fft_auto_layout').on('input', event => updateSetting('autoLayout', event.currentTarget.checked));
}

function updateHeaderIdentity() {
    const header = document.querySelector('body > #sheld > #fft_chat_header');
    if (!header) return;
    const sourceTitle = document.querySelector('#rm_button_selected_ch h2');
    const sourceAvatar = document.querySelector('#right-nav-panel .character_select.ch_selected .avatar img, #right-nav-panel .character_select[aria-selected="true"] .avatar img');
    const title = sourceTitle?.textContent?.trim() || 'SillyTavern';
    const titleNode = header.querySelector('.fft-header-title');
    const avatar = header.querySelector('.fft-header-avatar');
    if (titleNode) titleNode.textContent = title;
    if (avatar instanceof HTMLImageElement) {
        const src = sourceAvatar?.getAttribute('src');
        avatar.hidden = !src;
        if (src) avatar.src = src;
    }
}

function createDesktopHeader() {
    const sheld = document.querySelector('body > #sheld');
    if (!sheld || sheld.querySelector(':scope > #fft_chat_header')) return;
    const header = document.createElement('header');
    header.id = 'fft_chat_header';
    header.innerHTML = `
        <div class="fft-header-identity">
            <img class="fft-header-avatar" alt="" hidden>
            <div class="fft-header-copy">
                <strong class="fft-header-title">SillyTavern</strong>
                <small class="fft-header-status">активный диалог</small>
            </div>
        </div>
        <div class="fft-header-actions">
            <button type="button" class="fft-header-button fa-solid fa-magnifying-glass" data-fft-action="search" title="Поиск персонажей"></button>
            <button type="button" class="fft-header-button" data-fft-action="authors-note" title="Авторские заметки">${icons.note}</button>
            <button type="button" class="fft-header-button" data-fft-action="chat-history" title="История текущего персонажа">${icons.history}</button>
        </div>`;
    sheld.insertBefore(header, sheld.querySelector('#chat'));
    header.addEventListener('click', event => {
        const button = event.target.closest('[data-fft-action]');
        if (!button) return;
        if (button.dataset.fftAction === 'search') {
            clickVisible('#rm_button_search');
            requestAnimationFrame(() => document.querySelector('#character_search_bar')?.focus());
        }
        if (button.dataset.fftAction === 'authors-note') clickNativeOption('#option_toggle_AN');
        if (button.dataset.fftAction === 'chat-history') clickNativeOption('#option_select_chat');
    });
    updateHeaderIdentity();
}

function getPinnedChats() {
    const raw = getContext().accountStorage.getItem('pinnedChats');
    if (!raw) return {};
    try {
        return JSON.parse(raw) || {};
    } catch {
        return {};
    }
}

function getRecentChatKey(chat) {
    return `${chat.group ? `group_${chat.group}` : ''}${chat.avatar ? `char_${chat.avatar}` : ''}_${chat.file_name}`;
}

function normalizeRecentChat(chat) {
    const { characters, groups, getThumbnailUrl, timestampToMoment } = getContext();
    const character = characters.find(item => item?.avatar === chat.avatar);
    const group = groups.find(item => String(item?.id) === String(chat.group));
    const fileName = String(chat.file_name || '').replace(/\.jsonl$/i, '');
    const fallbackParts = fileName.split(' - ');
    const timestamp = timestampToMoment(chat.last_mes);
    const resolvedName = character?.name || group?.name || fallbackParts.shift() || fileName || 'Диалог';
    const labelPrefix = `${resolvedName} - `;
    return {
        avatar: String(chat.avatar || ''),
        group: String(chat.group || ''),
        fileName,
        rawFileName: String(chat.file_name || ''),
        name: resolvedName,
        label: fileName.startsWith(labelPrefix) ? fileName.slice(labelPrefix.length) : (fallbackParts.join(' - ') || fileName),
        thumbnail: character ? getThumbnailUrl('avatar', character.avatar) : (group?.avatar_url || 'img/five.png'),
        dateShort: timestamp?.isValid?.() ? timestamp.format('DD.MM.YY') : '',
        dateLong: timestamp?.isValid?.() ? timestamp.format('LL LT') : '',
        messageCount: Number(chat.chat_items || 0),
        fileSize: String(chat.file_size || ''),
        pinned: Object.hasOwn(getPinnedChats(), getRecentChatKey(chat)),
    };
}

function updateContextPanel() {
    const panel = document.querySelector('#fft_context_panel');
    if (!panel) return;
    const context = getContext();
    const active = recentChats.find(chat => String(chat.fileName) === String(context.getCurrentChatId()));
    const character = context.characters?.[context.characterId];
    const name = active?.name || character?.name || 'SillyTavern';
    const image = panel.querySelector('.fft-context-avatar');
    panel.querySelector('.fft-context-name').textContent = name;
    panel.querySelector('.fft-context-chat').textContent = active?.label || 'Выберите диалог слева';
    panel.querySelector('[data-fft-stat="messages"] strong').textContent = active ? String(active.messageCount) : '—';
    panel.querySelector('[data-fft-stat="size"] strong').textContent = active?.fileSize || '—';
    panel.querySelector('[data-fft-stat="date"] strong').textContent = active?.dateShort || '—';
    if (image instanceof HTMLImageElement) {
        const src = active?.thumbnail || (character ? context.getThumbnailUrl('avatar', character.avatar) : '');
        image.hidden = !src;
        if (src) image.src = src;
    }
}

function createContextPanel() {
    if (document.querySelector('#fft_context_panel')) return;
    const panel = document.createElement('aside');
    panel.id = 'fft_context_panel';
    panel.innerHTML = `
        <div class="fft-context-heading">${icons.info}<strong>Информация</strong></div>
        <div class="fft-context-profile">
            <img class="fft-context-avatar" alt="" hidden>
            <strong class="fft-context-name">SillyTavern</strong>
            <small class="fft-context-chat">Выберите диалог слева</small>
        </div>
        <div class="fft-context-stats">
            <div data-fft-stat="messages"><strong>—</strong><small>сообщений</small></div>
            <div data-fft-stat="size"><strong>—</strong><small>размер</small></div>
            <div data-fft-stat="date"><strong>—</strong><small>дата</small></div>
        </div>
        <div class="fft-context-actions">
            <button type="button" data-fft-panel="settings">${icons.sliders}<span>Пресеты ответа</span></button>
            <button type="button" data-fft-panel="characters">${icons.users}<span>Персонажи</span></button>
        </div>`;
    document.body.append(panel);
    panel.addEventListener('click', event => {
        const button = event.target.closest('[data-fft-panel]');
        if (!button) return;
        if (button.dataset.fftPanel === 'settings') toggleLiveDrawer('#left-nav-panel', '#leftNavDrawerIcon');
        if (button.dataset.fftPanel === 'characters') toggleLiveDrawer('#right-nav-panel', '#rightNavDrawerIcon');
    });
    updateContextPanel();
}

function closeMobileDrawers() {
    document.querySelectorAll('body > #top-settings-holder .drawer-content.openDrawer').forEach(panel => {
        panel.classList.remove('openDrawer');
        panel.classList.add('closedDrawer');
    });
    delete document.documentElement.dataset.fftMobilePanel;
    updateMobileNavState();
}

function openMobileDrawer(selector) {
    const panel = getLiveDrawer(selector);
    if (!panel) return;
    setLiveDrawerState(panel, true);
    if (selector === '#right-nav-panel') {
        panel.querySelector('#rm_button_characters')?.click();
    }
    const root = document.documentElement;
    root.classList.add('fft-mobile-drawer-open');
    root.dataset.fftMobilePanel = panel.id;
    updateMobileNavState();
}

function setMobileScreen(screen) {
    mobileScreen = screen;
    closeMobileDrawers();
    document.documentElement.classList.remove('fft-mobile-drawer-open');
    updateMobileShell();
}

function updateMobileNavState() {
    const shell = document.querySelector('#fft_mobile_shell');
    if (!shell) return;
    const panel = document.documentElement.dataset.fftMobilePanel;
    shell.querySelectorAll('.fft-mobile-nav button').forEach(button => {
        const active = (button.dataset.fftMobile === 'chats' && mobileScreen === 'chats' && !panel)
            || (button.dataset.fftMobile === 'tools' && mobileScreen === 'tools' && !panel)
            || (button.dataset.fftDrawer === '#right-nav-panel' && panel === 'right-nav-panel')
            || (button.dataset.fftDrawer === '#user-settings-block' && panel === 'user-settings-block');
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-current', active ? 'page' : 'false');
    });
    shell.querySelectorAll('#fft_mobile_tool_grid button').forEach(button => {
        button.classList.toggle('is-active', button.dataset.fftDrawer === `#${panel}`);
    });
}

function updateMobileShell() {
    const root = document.documentElement;
    const shell = document.querySelector('#fft_mobile_shell');
    if (!shell) return;
    const active = root.classList.contains('fft-mobile-active');
    shell.setAttribute('aria-hidden', String(!active));
    if (!active) return;

    const context = getContext();
    if (mobileScreen === 'chat' && !context.getCurrentChatId()) mobileScreen = 'chats';
    root.dataset.fftMobileScreen = mobileScreen;
    const isChat = mobileScreen === 'chat';
    const title = shell.querySelector('.fft-mobile-title');
    const subtitle = shell.querySelector('.fft-mobile-subtitle');
    const back = shell.querySelector('[data-fft-mobile="back"]');
    const menu = shell.querySelector('[data-fft-mobile="menu"]');
    const avatar = shell.querySelector('.fft-mobile-avatar');
    const character = context.characters?.[context.characterId];
    const activeChat = recentChats.find(chat => String(chat.fileName) === String(context.getCurrentChatId()));

    back.hidden = mobileScreen === 'chats';
    menu.hidden = !isChat;
    shell.querySelector('.fft-mobile-chat-history').hidden = !isChat;
    title.textContent = isChat ? (activeChat?.name || character?.name || 'Диалог') : (mobileScreen === 'tools' ? 'Инструменты' : 'Диалоги');
    subtitle.textContent = isChat ? (activeChat?.label || 'активный диалог') : (mobileScreen === 'tools' ? 'Панели SillyTavern' : `${recentChats.length} чатов`);
    const avatarSrc = isChat ? (activeChat?.thumbnail || (character ? context.getThumbnailUrl('avatar', character.avatar) : '')) : '';
    avatar.hidden = !avatarSrc;
    if (avatarSrc) avatar.src = avatarSrc;

    shell.querySelector('.fft-mobile-chats-screen').hidden = mobileScreen !== 'chats';
    shell.querySelector('.fft-mobile-tools-screen').hidden = mobileScreen !== 'tools';
    shell.querySelector('.fft-mobile-nav').hidden = isChat;
    renderMobileChatList();
    if (mobileScreen === 'tools') renderMobileTools();
    updateMobileNavState();
}

function createMobileChatListItem(chat) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'fft-mobile-chat-item';
    button.innerHTML = `
        <img class="fft-mobile-chat-avatar" alt="">
        <span class="fft-mobile-chat-copy">
            <span class="fft-mobile-chat-line"><strong></strong><time></time></span>
            <span class="fft-mobile-chat-line fft-mobile-chat-meta"><small></small><span></span></span>
        </span>`;
    button.querySelector('img').src = chat.thumbnail;
    button.querySelector('strong').textContent = chat.name;
    button.querySelector('time').textContent = chat.dateShort;
    button.querySelector('small').textContent = chat.label;
    button.querySelector('.fft-mobile-chat-meta span').textContent = `${chat.pinned ? '●  ' : ''}${chat.messageCount}`;
    button.addEventListener('click', async () => {
        await openExistingChat(chat);
        setMobileScreen('chat');
    });
    return button;
}

function renderMobileChatList() {
    const list = document.querySelector('#fft_mobile_chat_list');
    if (!list) return;
    const query = chatListQuery.trim().toLocaleLowerCase();
    const entries = recentChats.filter(chat => !query || `${chat.name} ${chat.fileName}`.toLocaleLowerCase().includes(query));
    list.replaceChildren(...entries.map(createMobileChatListItem));
    if (!entries.length) {
        const empty = document.createElement('div');
        empty.className = 'fft-mobile-empty';
        empty.textContent = 'Диалоги не найдены';
        list.append(empty);
    }
}

function collectMobileTools() {
    const holder = document.querySelector('body > #top-settings-holder');
    if (!holder) return [];

    const drawerTools = [...holder.querySelectorAll(':scope > .drawer')].flatMap(drawer => {
        const panel = drawer.querySelector(':scope > .drawer-content');
        const sourceIcon = drawer.querySelector(':scope > :where(.drawer-toggle, .drawer-header) .drawer-icon');
        if (!(panel instanceof HTMLElement) || !panel.id) return [];
        if (panel.id === 'right-nav-panel') return [];
        const iconClasses = [...(sourceIcon?.classList || [])].filter(name => !['drawer-icon', 'closedIcon', 'openIcon'].includes(name));
        const label = sourceIcon?.getAttribute('title')?.trim()
            || panel.querySelector(':scope > h3, :scope > h2, :scope > strong')?.textContent?.trim()
            || panel.id;
        return [{ key: `drawer:${panel.id}`, drawer: `#${CSS.escape(panel.id)}`, label, iconClasses: iconClasses.join(' ') || 'fa-solid fa-toolbox' }];
    });

    const nativeTools = [
        ['#option_select_chat', icons.history, 'История и файлы чата'],
    ].map(([selector, iconMarkup, label]) => ({ key: `native:${selector}`, native: selector, label, iconMarkup }));

    const allTools = [...drawerTools, ...nativeTools];
    const order = settings().toolOrder;
    return allTools.sort((a, b) => {
        const aIndex = order.indexOf(a.key);
        const bIndex = order.indexOf(b.key);
        return (aIndex < 0 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex < 0 ? Number.MAX_SAFE_INTEGER : bIndex);
    });
}

function createMobileToolButton(tool) {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.fftToolKey = tool.key;
        if (tool.drawer) button.dataset.fftDrawer = tool.drawer;
        if (tool.native) button.dataset.fftNative = tool.native;
        if (tool.iconMarkup) {
            button.innerHTML = `${tool.iconMarkup}<span></span>`;
        } else {
            const icon = document.createElement('i');
            icon.className = tool.iconClasses;
            button.append(icon, document.createElement('span'));
        }
        button.querySelector('span').textContent = tool.label;
        return button;
}

function renderToolPreferences(tools = collectMobileTools()) {
    const container = document.querySelector('#fft_tool_preferences');
    if (!container) return;
    const hidden = settings().hiddenTools;
    container.replaceChildren(...tools.map((tool, index) => {
        const row = document.createElement('div');
        row.className = 'fft-tool-preference';
        row.innerHTML = `<label><input type="checkbox"><span></span></label><span class="fft-tool-order"><button type="button" aria-label="Выше">↑</button><button type="button" aria-label="Ниже">↓</button></span>`;
        const checkbox = row.querySelector('input');
        checkbox.checked = !hidden.includes(tool.key);
        row.querySelector('label span').textContent = tool.label;
        checkbox.addEventListener('change', () => {
            settings().hiddenTools = checkbox.checked ? hidden.filter(key => key !== tool.key) : [...new Set([...hidden, tool.key])];
            renderMobileTools();
            saveSettingsDebounced();
        });
        const move = direction => {
            const keys = tools.map(item => item.key);
            const target = index + direction;
            if (target < 0 || target >= keys.length) return;
            [keys[index], keys[target]] = [keys[target], keys[index]];
            settings().toolOrder = keys;
            renderMobileTools();
            saveSettingsDebounced();
        };
        row.querySelector('[aria-label="Выше"]').addEventListener('click', () => move(-1));
        row.querySelector('[aria-label="Ниже"]').addEventListener('click', () => move(1));
        return row;
    }));
}

function renderMobileTools() {
    const grid = document.querySelector('#fft_mobile_tool_grid');
    if (!grid) return;
    const tools = collectMobileTools();
    const hidden = settings().hiddenTools;

    grid.replaceChildren(...tools.filter(tool => !hidden.includes(tool.key)).map(createMobileToolButton));
    renderToolPreferences(tools);
}

function createMobileShell() {
    if (document.querySelector('#fft_mobile_shell')) return;
    const shell = document.createElement('div');
    shell.id = 'fft_mobile_shell';
    shell.setAttribute('aria-hidden', 'true');
    shell.innerHTML = `
        <header class="fft-mobile-appbar">
            <button type="button" data-fft-mobile="back" aria-label="Назад">${icons.back}</button>
            <img class="fft-mobile-avatar" alt="" hidden>
            <span class="fft-mobile-heading"><strong class="fft-mobile-title">Диалоги</strong><small class="fft-mobile-subtitle"></small></span>
            <button type="button" data-fft-native="#option_select_chat" class="fft-mobile-chat-history" aria-label="История и файлы чата" title="История и файлы чата">${icons.history}</button>
            <button type="button" data-fft-mobile="menu" aria-label="Меню">${icons.more}</button>
        </header>
        <main class="fft-mobile-chats-screen">
            <label class="fft-mobile-search"><i class="fa-solid fa-magnifying-glass"></i><input type="search" placeholder="Поиск диалогов"></label>
            <div id="fft_mobile_chat_list"></div>
        </main>
        <main class="fft-mobile-tools-screen" hidden>
            <div id="fft_mobile_tool_grid" class="fft-mobile-tool-grid"></div>
        </main>
        <nav class="fft-mobile-nav" aria-label="Основная навигация">
            <button type="button" data-fft-mobile="chats">${icons.chats}<span>Чаты</span></button>
            <button type="button" data-fft-drawer="#right-nav-panel">${icons.users}<span>Персонажи</span></button>
            <button type="button" data-fft-mobile="tools">${icons.tools}<span>Инструменты</span></button>
            <button type="button" data-fft-drawer="#user-settings-block">${icons.settings}<span>Настройки</span></button>
        </nav>
        <button id="fft_mobile_panel_close" type="button" aria-label="Назад" title="Назад">${icons.back}</button>`;
    document.body.append(shell);

    shell.querySelector('.fft-mobile-search input').addEventListener('input', event => {
        chatListQuery = event.currentTarget.value;
        renderMobileChatList();
    });
    shell.addEventListener('click', event => {
        const action = event.target.closest('[data-fft-mobile]')?.dataset.fftMobile;
        const drawer = event.target.closest('[data-fft-drawer]')?.dataset.fftDrawer;
        const native = event.target.closest('[data-fft-native]')?.dataset.fftNative;
        if (action === 'back' || action === 'chats') setMobileScreen('chats');
        if (action === 'tools') setMobileScreen('tools');
        if (action === 'menu') clickVisible('#options_button');
        if (drawer) openMobileDrawer(drawer);
        if (native) clickNativeOption(native);
    });
    shell.querySelector('#fft_mobile_panel_close').addEventListener('click', () => {
        closeMobileDrawers();
        document.documentElement.classList.remove('fft-mobile-drawer-open');
    });
    mobileScreen = getContext().getCurrentChatId() ? 'chat' : 'chats';
    renderMobileTools();
    updateMobileShell();
}

async function loadRecentChats() {
    const { getRequestHeaders } = getContext();
    const pinned = Object.values(getPinnedChats());
    try {
        const response = await fetch('/api/chats/recent', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ max: 100, pinned }),
            cache: 'no-cache',
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
    recentChats = Array.isArray(data) ? data.map(normalizeRecentChat) : [];
    } catch (error) {
        console.warn('[Floating Frost] Failed to load recent chats.', error);
        recentChats = [];
    }
    renderChatList();
    updateContextPanel();
}

async function openExistingChat(chat) {
    const context = getContext();
    if (chat.group) {
        await openGroupById(chat.group);
        if (context.getCurrentChatId() !== chat.fileName) await openGroupChat(chat.group, chat.fileName);
        return;
    }
    const characterId = context.characters.findIndex(item => item?.avatar === chat.avatar);
    if (characterId < 0) return;
    await context.selectCharacterById(characterId, { switchMenu: false });
    if (getContext().getCurrentChatId() !== chat.fileName) await getContext().openCharacterChat(chat.fileName);
}

function createChatListItem(chat) {
    const activeChatId = getContext().getCurrentChatId();
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'fft-chat-list-item';
    item.classList.toggle('active', String(chat.fileName) === String(activeChatId));
    item.dataset.chatFile = chat.fileName;
    item.title = chat.dateLong;

    const avatar = document.createElement('img');
    avatar.className = 'fft-chat-list-avatar';
    avatar.alt = '';
    avatar.loading = 'lazy';
    avatar.src = chat.thumbnail;

    const copy = document.createElement('span');
    copy.className = 'fft-chat-list-copy';
    const top = document.createElement('span');
    top.className = 'fft-chat-list-top';
    const name = document.createElement('strong');
    name.className = 'fft-chat-list-name';
    name.textContent = chat.name;
    const date = document.createElement('small');
    date.className = 'fft-chat-list-date';
    date.textContent = chat.dateShort;
    top.append(name, date);
    const bottom = document.createElement('span');
    bottom.className = 'fft-chat-list-bottom';
    const preview = document.createElement('small');
    preview.className = 'fft-chat-list-preview';
    preview.textContent = chat.label;
    const meta = document.createElement('span');
    meta.className = 'fft-chat-list-meta';
    if (chat.pinned) {
        const pin = document.createElement('i');
        pin.className = 'fa-solid fa-thumbtack';
        pin.title = 'Закреплённый чат';
        meta.append(pin);
    }
    const count = document.createElement('small');
    count.className = 'fft-chat-list-count';
    count.innerHTML = `<i class="fa-solid fa-comment"></i> ${chat.messageCount}`;
    const size = document.createElement('small');
    size.textContent = chat.fileSize;
    meta.append(count, size);
    bottom.append(preview, meta);
    copy.append(top, bottom);
    item.append(avatar, copy);
    item.addEventListener('click', () => void openExistingChat(chat));
    return item;
}

function renderChatList() {
    const list = document.querySelector('#fft_chat_list_items');
    if (!list) return;
    const query = chatListQuery.trim().toLocaleLowerCase();
    const entries = recentChats.filter(chat => !query || `${chat.name} ${chat.fileName}`.toLocaleLowerCase().includes(query));
    list.replaceChildren(...entries.map(createChatListItem));
    if (!entries.length) {
        const empty = document.createElement('div');
        empty.className = 'fft-chat-list-empty';
        empty.textContent = 'Ничего не найдено';
        list.append(empty);
    }
    renderMobileChatList();
}

function createPersistentChatList() {
    if (document.querySelector('#fft_chat_list')) return;
    const aside = document.createElement('aside');
    aside.id = 'fft_chat_list';
    aside.innerHTML = `
        <div class="fft-chat-list-head">
            <strong>Диалоги</strong>
            <button type="button" class="fft-chat-list-add fa-solid fa-user-plus" title="Персонажи"></button>
        </div>
        <label class="fft-chat-list-search">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input type="search" placeholder="Поиск" aria-label="Поиск диалогов">
        </label>
        <div id="fft_chat_list_items"></div>`;
    document.body.append(aside);
    aside.querySelector('input').addEventListener('input', event => {
        chatListQuery = event.currentTarget.value;
        renderChatList();
    });
    aside.querySelector('.fft-chat-list-add').addEventListener('click', () => toggleLiveDrawer('#right-nav-panel', '#rightNavDrawerIcon'));
    void loadRecentChats();
}

function observeMessages() {
    const chat = document.querySelector('body > #sheld > #chat');
    if (!chat || observer) return;
    observer = new MutationObserver(records => {
        if (!document.documentElement.classList.contains(ROOT_CLASS)) return;
        for (const record of records) {
            for (const node of record.addedNodes) {
                if (!(node instanceof HTMLElement)) continue;
                if (node.matches('.mes')) decorateMessage(node);
                decorateMessages(node);
            }
        }
    });
    observer.observe(chat, { childList: true, subtree: true });
}

function bindSillyTavernEvents() {
    const { eventSource, eventTypes } = getContext();
    const refresh = () => requestAnimationFrame(() => {
        decorateMessages();
        updateHeaderIdentity();
        renderChatList();
        updateContextPanel();
        updateMobileShell();
    });
    [
        eventTypes.CHAT_CHANGED,
        eventTypes.MORE_MESSAGES_LOADED,
        eventTypes.USER_MESSAGE_RENDERED,
        eventTypes.CHARACTER_MESSAGE_RENDERED,
        eventTypes.MESSAGE_UPDATED,
        eventTypes.MESSAGE_SWIPED,
        eventTypes.CHARACTER_EDITED,
        eventTypes.CHARACTER_DELETED,
        eventTypes.CHARACTER_DUPLICATED,
    ].filter(Boolean).forEach(type => eventSource.on(type, refresh));
    eventSource.on(eventTypes.CHAT_CHANGED, () => requestAnimationFrame(() => {
        if (document.documentElement.classList.contains('fft-mobile-active')) mobileScreen = 'chat';
        updateMobileShell();
        void loadRecentChats();
    }));
    eventSource.on(eventTypes.APP_READY, () => requestAnimationFrame(() => void loadRecentChats()));
    eventSource.on(eventTypes.CHARACTER_PAGE_LOADED, () => requestAnimationFrame(() => void loadRecentChats()));
}

jQuery(async () => {
    settings();
    const html = await $.get(`${EXTENSION_PATH}/settings.html`);
    $('#extensions_settings2').append(html);
    syncControls();
    bindControls();
    createDesktopHeader();
    createPersistentChatList();
    createContextPanel();
    createMobileShell();
    bindLiveTopBar();
    bindSillyTavernEvents();
    observeMessages();
    mobileMedia.addEventListener('change', applyState);
    window.visualViewport?.addEventListener('resize', updateViewportMetrics);
    window.visualViewport?.addEventListener('scroll', updateViewportMetrics);
    window.addEventListener('resize', updateViewportMetrics);
    updateViewportMetrics();
    applyState();
});
