// Vanilla JS port of the template's Redux components (exact template behavior)
const SP = "suggest_prompt_v1";
let recentChats = JSON.parse(localStorage.getItem("recent_chats_v1")) || [];
let activeChat = null; // {id, title, model, chats: [{id,user,gemini,isLoader,newChat}]}
let isLoader = false;
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
      <div class="gemini"><img src="${commonIcon.chatGeminiIcon}" alt="avater icon"><div class="gemini-p" id="g_${c.id}">${loadText(c.gemini)}</div></div>
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

// ---------- typewriter (ReplyByGemini) ----------
function typewrite(id, htmlText) {
  const finish = () => {
    const el = $("g_" + id);
    if (el) {
      el.innerHTML = htmlText;
      hljsBlock(el);
    }
    refreshCopy();
  };
  finish();
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
  setToggle($("realtimeToggle"), (localStorage.getItem("realtime") || "no") === "yes");
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

function toggleRealtime() {
  const cur = localStorage.getItem("realtime") || "no";
  localStorage.setItem("realtime", cur === "yes" ? "no" : "yes");
  renderToggles();
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
  const msgId = Date.now().toString();
  isLoader = true;

  // loader entry (exact template: user + gemini loader gif)
  const loaderEntry = { id: msgId, user: userText, gemini: "", isLoader: "yes" };
  const renderable = [...activeChat.chats, loaderEntry];
  const temp = { ...activeChat, chats: renderable };
  const saved = activeChat;
  activeChat = temp;
  renderViews();
  activeChat = saved;

  input.value = "";
  $("loaderBar").style.display = "";

  const history = activeChat.chats
    .filter((c) => c.isLoader === "no" && c.gemini)
    .map((c) => ({ role: "user", parts: [{ text: c.user }] }, { role: "model", parts: [{ text: c.gemini }] }));

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: settingsModel.model,
        messages: [...history, { role: "user", parts: [{ text: userText }] }],
      }),
    });
    if (!res.ok) throw new Error("gemini request failed");
    const data = await res.json();
    isLoader = false;
    const reply = data.reply || "";
    activeChat = { ...activeChat, chats: [...activeChat.chats, { id: msgId, user: userText, gemini: reply, isLoader: "no" }] };
    const first = activeChat.chats.length === 1;
    if (first || !chatById(activeChat.id)) saveRecent(userText);
    localStorage.setItem("chat_" + activeChat.id, JSON.stringify(activeChat));
    renderViews();
    typewrite(msgId, loadText(reply));
  } catch (err) {
    isLoader = false;
    $("loaderBar").style.display = "none";
    renderViews();
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
  $("realtimeToggle").onclick = toggleRealtime;
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
