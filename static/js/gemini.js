// Vanilla JS port of the template's Redux components (exact template behavior)
const SP = "suggest_prompt_v1";
let recentChats = JSON.parse(localStorage.getItem("recent_chats_v1")) || [];
let activeChat = null; // {id, title, model, chats: [{id,user,gemini,isLoader,newChat}]}
let isLoader = false;
let streamController = null;
let isSidebarLong = window.innerWidth > 960 && JSON.parse(localStorage.getItem("sidebar_long_v1") ?? "true");
let isShowMore = false;
let settingsShow = false;
let advanceShow = false;
let introShow = false;

const $ = (id) => document.getElementById(id);
const chatById = (id) => recentChats.find((c) => c.id === id);
const settingsModel = { model: localStorage.getItem("gemini_model") || "gemini-3.8-flash" };

// ---------- theme ----------
function applyTheme() {
  const theme = localStorage.getItem("theme") || "dark";
  document.documentElement.setAttribute("data-theme", theme);
}

// ---------- sidebar ----------
function renderSidebar() {
  const icon = themeIcon();
  const width = isSidebarLong ? "side-bar-long" : "side-bar-sort";
  document.querySelectorAll("#sidebar .node-icon").forEach((el) => {
    el.src = icon[el.dataset.icon];
  });
  const sb = $("sidebar");
  sb.className = `sidebar-main ${width}`;
  $("newChatButton").className = `pluc-icon ${activeChat ? "old-plus-icon" : "new-plus-icon"}`;
  document.querySelectorAll("#sidebar [data-p]").forEach((el) => {
    el.style.display = isSidebarLong ? "" : "none";
  });
  const arrow = isShowMore ? icon.upArrowIcon : icon.expandIcon;
  const recent = $("recentChatList");
  const list = isShowMore ? recentChats : recentChats.slice(0, 5);
  let html = "";
  list.forEach((c) => {
    const active = activeChat && activeChat.id === c.id ? "active-recent-chat" : "";
    html += `<div class="recent-chat ${active}" data-chat="${c.id}">
      <img src="${icon.messageIcon}" alt="message"><p>${escapeHtml(c.title.slice(0, 20))}</p>
      <button class="three-dot" data-del="${c.id}" title="Delete"><img src="${icon.threeDotIcon}" alt=""></button>
    </div>`;
  });
  if (recentChats.length > 5) {
    html += `<div class="show-more" id="showMoreBtn"><img src="${arrow}" alt="drop down"><p>Show more</p></div>`;
  }
  recent.innerHTML = html;
}

function toggleSideBar() {
  isSidebarLong = !isSidebarLong;
  localStorage.setItem("sidebar_long_v1", JSON.stringify(isSidebarLong));
  renderSidebar();
  renderViews();
}

function showMoreHandler() {
  isShowMore = !isShowMore;
  renderSidebar();
}

// ---------- recent chats ----------
function saveRecent(title) {
  const t = title.slice(0, 20);
  recentChats = recentChats.filter((c) => c.id !== activeChat.id);
  recentChats.push({ id: activeChat.id, title: t });
  localStorage.setItem("recent_chats_v1", JSON.stringify(recentChats));
  renderSidebar();
}

function openRecent(id) {
  streamController?.abort();
  const stored = JSON.parse(localStorage.getItem("chat_" + id) || "null");
  if (!stored) return;
  activeChat = stored;
  renderSidebar();
  renderViews(true);
}

function deleteRecent(id) {
  recentChats = recentChats.filter((c) => c.id !== id);
  localStorage.removeItem("chat_" + id);
  localStorage.setItem("recent_chats_v1", JSON.stringify(recentChats));
  if (activeChat && activeChat.id === id) newChatHandler();
  renderSidebar();
}

// ---------- new chat ----------
function newChatHandler() {
  streamController?.abort();
  activeChat = null;
  renderSidebar();
  renderViews();
}

// ---------- views ----------
function renderViews(scroll = false) {
  const icon = themeIcon();
  const newView = $("newChatView");
  const scrollView = $("scrollChatView");
  const loaderBar = $("loaderBar");
  if (!activeChat || activeChat.chats.length === 0) {
    newView.style.display = "";
    scrollView.style.display = "none";
    renderPrompts();
    if (!isLoader) loaderBar.style.display = "none";
    return;
  }
  newView.style.display = "none";
  scrollView.style.display = "";
  loaderBar.style.display = isLoader ? "" : "none";

  let html = "";
  activeChat.chats.forEach((c) => {
    if (c.isLoader === "yes") {
      html += `<div class="single-chat">
        <div class="user"><p>${escapeHtml(c.user)}</p></div>
        <div class="gemini"><img src="${commonIcon.geminiLaoder}" alt="avater icon"></div>
      </div>`;
      return;
    }
    html += `<div class="single-chat">
      <div class="user"><p>${escapeHtml(c.user)}</p></div>
      <div class="gemini"><img src="${commonIcon.chatGeminiIcon}" alt="avater icon"><div class="gemini-p" id="g_${c.id}">${loadText(c.gemini)}${c.error ? `<p class="response-error" role="status">${escapeHtml(c.error)}</p>` : ""}</div></div>
      <div class="copy-icon copy-icon-one" data-copy="${c.id}"><img src="${icon.copyIcon}" alt="copy icon"></div>
    </div>`;
  });
  scrollView.innerHTML = html;
  refreshIcons(scrollView);
  hljsBlock(scrollView);
  refreshCopy();
  scrollView.scrollTop = scrollView.scrollHeight;
  if (scroll) scrollView.scrollTop = scrollView.scrollHeight;
}

function refreshIcons(scope) {
  const icon = themeIcon();
  scope.querySelectorAll(".node-icon").forEach((el) => {
    if (el.dataset.icon) el.src = icon[el.dataset.icon];
  });
  // common icons referenced by data-common
  scope.querySelectorAll("[data-common]").forEach((el) => {
    el.src = commonIcon[el.dataset.common];
  });
}

function hljsBlock(el) {
  el.querySelectorAll("pre code").forEach((b) => {
    b.classList.add("hljs");
    if (window.hljs) hljs.highlightElement(b);
  });
}

// Parse Markdown before sanitizing model-provided HTML.
function loadText(text) {
  return DOMPurify.sanitize(marked.parse(String(text ?? ""), { gfm: true, breaks: true }));
}

// ---------- prompts ----------
function renderPrompts() {
  const main = $("promptMain");
  const icon = themeIcon();
  const promptsCopy = [...suggestPrompt];
  promptsCopy.sort(() => Math.random() - 0.5);
  const rand = promptsCopy.slice(0, 4);
  main.innerHTML = rand
    .map((p) => {
      let img = icon[p.icon];
      if (!img) img = commonIcon[p.icon];
      if (!img && p.icon.startsWith("__")) img = commonIcon[p.icon.replace(/__/g, "")];
      return `<div class="prompt" data-prompt="${p.id}">
        <p>${escapeHtml(p.sort)}</p>
        <div class="icon"><img src="${img}" alt="icon"></div>
      </div>`;
    })
    .join("");
}

function suggestPromptHandler(id) {
  const p = suggestPrompt.find((x) => x.id === id);
  if (!p) return;
  $("promptInput").value = p.long;
  $("promptInput").focus();
}

// ---------- settings ----------
function renderSettings() {
  const icon = themeIcon();
  ["linkIcon", "moonIcon", "wallIcon"].forEach((k) => {
    const el = document.querySelector(`#settingMain .node-icon[data-icon="${k}"]`);
    if (el) el.src = icon[k];
  });
  $("settingMain").className = `setting-main ${settingsShow ? "settngs-show" : "settings-hide"}`;
  renderToggles();
}

function renderToggles() {
  const theme = localStorage.getItem("theme") || "dark";
  setToggle($("themeToggle"), theme === "dark");
}

function setToggle(btn, on) {
  btn.className = `btn-main ${on ? "on-main" : "off-main"}`;
  btn.innerHTML = `<div class="btn-round ${on ? "on-round" : "off-round"}"></div>`;
}

function toggleTheme() {
  const cur = localStorage.getItem("theme") || "dark";
  localStorage.setItem("theme", cur === "dark" ? "light" : "dark");
  applyTheme();
  renderAll();
}

function settingsHandler() {
  settingsShow = !settingsShow;
  advanceShow = false;
  renderSettings();
  renderAdvance();
}

function toggleAdvanceGeminiHandler() {
  advanceShow = !advanceShow;
  settingsShow = false;
  renderAdvance();
  renderSettings();
}

function renderAdvance() {
  const icon = themeIcon();
  $("modelSelect").value = settingsModel.model;
  const el = $("advanceMain");
  el.className = `advance-main ${advanceShow ? "advance-on" : "advance-off"}`;
  el.innerHTML = `
    <h4>Model</h4>
    <div class="gemini" id="geminiModelRow">
      <img src="${commonIcon.geminiIcon}" alt="gemini icon"><p>Gemini</p>
      <img src="${settingsModel.model === "gemini-3.8-flash" ? icon.okIcon : ""}" alt="ok icon">
    </div>
    <div class="advance-gemini">
      <img src="${commonIcon.advanceGeminiIcon}" alt="advance gemini"><p>Gemini Advance</p>
      <button id="upgradeBtn">Upgrade</button>
    </div>`;
  refreshIcons(el);
  $("geminiModelRow").onclick = () => {
    settingsModel.model = "gemini-3.8-flash";
    localStorage.setItem("gemini_model", "gemini-3.8-flash");
    newChatHandler();
    advanceShow = false;
    renderAdvance();
  };
  $("upgradeBtn").onclick = (e) => {
    e.stopPropagation();
    settingsModel.model = "gemini-3.6-flash";
    localStorage.setItem("gemini_model", "gemini-3.6-flash");
    advanceShow = false;
    renderAdvance();
    renderViews();
  };
}

// ---------- intro prompt ----------
function showIntroPrompt() {
  const icon = themeIcon();
  introShow = true;
  const el = $("introMain");
  el.style.display = "";
  el.innerHTML = `
    <img src="${commonIcon.googleBigIcon}" alt="google big">
    <p>Experience limitless conversations! <span>Sign in</span> to unlock<span> unlimited chat</span> and browse through your entire chat history—more than the last 5 interactions.</p>
    <div class="cross" id="introCross"><img src="${icon.crossIcon}" alt="cross"></div>`;
  refreshIcons(el);
  $("introCross").onclick = () => {
    el.style.display = "none";
    introShow = false;
  };
}

// ---------- send ----------
async function handleSend() {
  const input = $("promptInput");
  const userText = input.value.trim();
  if (!userText || isLoader) return;

  if (!activeChat) {
    activeChat = { id: Date.now().toString(), title: userText.slice(0, 20), chats: [] };
  }
  const chat = activeChat;
  const history = chat.chats
    .filter((c) => c.isLoader === "no" && c.gemini && !c.error)
    .flatMap((c) => [{ role: "user", parts: [{ text: c.user }] }, { role: "model", parts: [{ text: c.gemini }] }]);
  const entry = { id: Date.now().toString(), user: userText, gemini: "", isLoader: "yes" };
  chat.chats.push(entry);
  const controller = new AbortController();
  streamController = controller;
  isLoader = true;
  input.value = "";
  renderViews();
  renderHeader();

  const persist = () => {
    localStorage.setItem("chat_" + chat.id, JSON.stringify(chat));
    if (!chatById(chat.id)) {
      recentChats.push({ id: chat.id, title: chat.title });
      localStorage.setItem("recent_chats_v1", JSON.stringify(recentChats));
    }
    renderSidebar();
  };
  const update = () => {
    if (activeChat !== chat) return;
    const view = $("scrollChatView");
    const followBottom = view.scrollHeight - view.scrollTop - view.clientHeight < 80;
    const el = $("g_" + entry.id);
    if (!el) renderViews();
    else el.innerHTML = loadText(entry.gemini);
    if (followBottom) view.scrollTop = view.scrollHeight;
  };

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: settingsModel.model,
        stream: true,
        messages: [...history, { role: "user", parts: [{ text: userText }] }],
      }),
    });
    if (!res.ok || !res.body) throw new Error("Unable to get a response. Please try again.");
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let complete = false;
    const consume = (line) => {
      if (!line.trim()) return;
      const event = JSON.parse(line);
      if (event.type === "error") throw new Error(event.message);
      if (event.type === "done") complete = true;
      if (event.type === "delta") {
        entry.gemini += event.text;
        entry.isLoader = "no";
        update();
      }
    };
    try {
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop();
        lines.forEach(consume);
        if (done) break;
      }
      consume(buffer);
      if (!complete) throw new Error("Response interrupted. Please try again.");
      if (!entry.gemini) throw new Error("No response generated. Please try again.");
    } finally {
      await reader.cancel();
      reader.releaseLock();
    }
  } catch (err) {
    entry.error = err.name === "AbortError" ? "Response stopped." : err.message;
  } finally {
    entry.isLoader = "no";
    persist();
    if (streamController === controller) {
      streamController = null;
      isLoader = false;
      $("loaderBar").style.display = "none";
    }
    if (activeChat === chat) {
      update();
      const el = $("g_" + entry.id);
      if (el) hljsBlock(el);
      if (entry.error) renderViews();
      refreshCopy();
    }
  }
}

// ---------- copy ----------
function refreshCopy() {
  document.querySelectorAll("[data-copy]").forEach((el) => {
    el.onclick = () => {
      const chat = activeChat.chats.find((c) => c.id === el.dataset.copy);
      if (!chat) return;
      let text = chat.gemini;
      const code = text.match(/```([^`]+?)```/g);
      if (code) text = code.reduce((acc, e) => acc + e, "");
      navigator.clipboard.writeText(text).then(() => {
        const span = document.createElement("span");
        span.className = "copy-message";
        span.textContent = "Copied!";
        el.appendChild(span);
        setTimeout(() => span.remove(), 2000);
      });
    };
  });
}

// ---------- header ----------
function renderHeader() {
  const icon = themeIcon();
  $("headerMenuIconImg").src = icon.menuIcon;
  const right = $("headerRight");
  let rightHtml = "";
  if (activeChat) {
    rightHtml += `<div class="plus-icon new-plus-icon" id="headerPlusBtn"><img class="node-icon" data-icon="plusIcon" alt="plus icon"></div>`;
  }
  rightHtml += `<div class="login" id="loginBtn"><img src="${commonIcon.googleLogo}" alt="google logo"><p>Sign in</p></div>`;
  right.innerHTML = rightHtml;
  refreshIcons(right);
  $("loginBtn").onclick = showIntroPrompt;
  if (activeChat) $("headerPlusBtn").onclick = newChatHandler;
}

// ---------- render all ----------
function renderAll() {
  document.documentElement.setAttribute("data-theme", localStorage.getItem("theme") || "dark");
  renderSidebar();
  renderHeader();
  renderViews();
  renderSettings();
  renderAdvance();
  refreshIcons(document);
}

// ---------- init ----------
function init() {
  applyTheme();
  renderAll();
  // sidebar events
  $("menuIconBtn").onclick = toggleSideBar;
  $("newChatButton").onclick = newChatHandler;
  $("recentChatList").addEventListener("click", (e) => {
    const chat = e.target.closest("[data-chat]");
    if (chat && !e.target.closest("[data-del]")) openRecent(chat.dataset.chat);
    const del = e.target.closest("[data-del]");
    if (del) deleteRecent(del.dataset.del);
    if (e.target.closest("#showMoreBtn")) showMoreHandler();
  });
  document.querySelectorAll("#settingsSection .node-icon").forEach((el) => {
    el.src = themeIcon()[el.dataset.icon];
  });
  document.querySelectorAll("#sidebar [data-p]").forEach((el) => {
    el.style.display = isSidebarLong ? "" : "none";
  });
  // header
  $("headerMenuBtn").onclick = toggleSideBar;
  $("geminiName").onclick = toggleAdvanceGeminiHandler;
  // settings
  $("themeToggle").onclick = toggleTheme;
  // input
  $("modelSelect").addEventListener("change", (e) => {
    settingsModel.model = e.target.value;
    localStorage.setItem("gemini_model", settingsModel.model);
    renderAdvance();
  });
  $("chatForm").addEventListener("submit", (e) => {
    e.preventDefault();
    handleSend();
  });
  // prompts
  $("promptMain").addEventListener("click", (e) => {
    const card = e.target.closest("[data-prompt]");
    if (card) suggestPromptHandler(+card.dataset.prompt);
  });
  refreshCopy();
  // intro prompt after 2s (exact template timing)
  setTimeout(() => {
    const isShowIntroAlready = localStorage.getItem("isIntroShow");
    if (!isShowIntroAlready) {
      showIntroPrompt();
      localStorage.setItem("isIntroShow", "true");
    }
  }, 2000);
  // global click-away (App.js settingHandler)
  document.addEventListener("click", (e) => {
    if (
      (settingsShow && !e.target.closest("#settingMain") && !e.target.closest(".settings")) ||
      (advanceShow && !e.target.closest("#advanceMain") && !e.target.closest("#geminiName"))
    ) {
      settingsShow = false;
      advanceShow = false;
      renderSettings();
      renderAdvance();
    }
  });
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
