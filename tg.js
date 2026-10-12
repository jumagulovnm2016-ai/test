/* Автоотправка результата теста преподавателю в Telegram.
   Страница задаёт window.TG_CFG = { title, needFio, getReport }:
   getReport() возвращает текст результата, когда экран результата показан, иначе null. */
(function () {
  "use strict";
  var TOKEN = "8469771865:AAFRhxAfYsggVYE3UEPd82PXrPBmk56xwis";
  var CHAT = "188183172";
  var cfg = window.TG_CFG || {};
  var KEY = "tg-sent-v1";
  var visible = false, firstCheck = true, busy = false;

  function hash(s) { var h = 0x811c9dc5; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36); }
  function sentSet() { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { return []; } }
  function remember(h) { try { var a = sentSet(); a.push(h); localStorage.setItem(KEY, JSON.stringify(a.slice(-200))); } catch (e) {} }
  function stamp() { var d = new Date(), z = function (n) { return String(n).padStart(2, "0"); };
    return z(d.getDate()) + "." + z(d.getMonth() + 1) + "." + d.getFullYear() + " " + z(d.getHours()) + ":" + z(d.getMinutes()); }

  // ---------- интерфейс: плашка состояния и окно ввода ФИО ----------
  var css = document.createElement("style");
  css.textContent =
    ".tgbar{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:9999;max-width:min(560px,calc(100% - 24px));" +
    "background:#1f3864;color:#fff;border-radius:10px;padding:12px 14px;font:15px/1.4 'PT Sans',Arial,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.25);display:flex;gap:10px;align-items:center;flex-wrap:wrap}" +
    ".tgbar.bad{background:#b3261e}.tgbar button{font:inherit;font-weight:700;border:0;border-radius:7px;padding:7px 12px;cursor:pointer;background:#fff;color:#1f3864}" +
    ".tgbar .x{background:transparent;color:#fff;padding:4px 8px}" +
    ".tgfio{position:fixed;inset:0;z-index:10000;background:rgba(10,20,30,.55);display:grid;place-items:center;padding:16px}" +
    ".tgfio form{background:#fff;color:#18232f;border-radius:12px;padding:20px;max-width:420px;width:100%;display:grid;gap:10px;font:16px/1.4 'PT Sans',Arial,sans-serif}" +
    ".tgfio h3{margin:0;color:#1f3864;font-size:19px}.tgfio input{font:inherit;padding:10px 12px;border:1.5px solid #c9d6da;border-radius:8px}" +
    ".tgfio .err{color:#b3261e;font-size:14px;margin:0}.tgfio button{font:inherit;font-weight:700;border:0;border-radius:8px;padding:10px 14px;background:#1f3864;color:#fff;cursor:pointer}";
  document.head.appendChild(css);
  var bar = null;
  function show(msg, bad, text) {
    if (!bar) { bar = document.createElement("div"); bar.className = "tgbar"; bar.setAttribute("role", "status"); document.body.appendChild(bar); }
    bar.className = "tgbar" + (bad ? " bad" : "");
    bar.innerHTML = "";
    var s = document.createElement("span"); s.textContent = msg; s.style.flex = "1 1 220px"; bar.appendChild(s);
    if (text) {
      var b = document.createElement("button"); b.type = "button"; b.textContent = "Отправить через Telegram";
      b.onclick = function () { window.open("https://t.me/share/url?url=" + encodeURIComponent(" ") + "&text=" + encodeURIComponent(text), "_blank", "noopener"); };
      bar.appendChild(b);
    }
    var x = document.createElement("button"); x.type = "button"; x.className = "x"; x.setAttribute("aria-label", "Закрыть"); x.textContent = "✕";
    x.onclick = function () { bar.remove(); bar = null; }; bar.appendChild(x);
  }
  function askFio() {
    return new Promise(function (res) {
      var saved = ""; try { saved = localStorage.getItem("tg-fio") || ""; } catch (e) {}
      var w = document.createElement("div"); w.className = "tgfio";
      w.innerHTML = '<form><h3>Отправка результата преподавателю</h3><label for="tgfioin">Введите ФИО полностью</label>' +
        '<input id="tgfioin" autocomplete="name" maxlength="120" placeholder="Иванов Иван Иванович"><p class="err" hidden>Введите хотя бы фамилию и имя, буквами.</p>' +
        '<button type="submit">Отправить</button></form>';
      document.body.appendChild(w);
      var inp = w.querySelector("input"), err = w.querySelector(".err"); inp.value = saved; inp.focus();
      w.querySelector("form").onsubmit = function (e) {
        e.preventDefault();
        var v = inp.value.trim().replace(/\s+/g, " ");
        if (v.split(" ").length < 2 || !/^[A-Za-zА-Яа-яЁёӨөҮүҢң'\- ]+$/.test(v)) { err.hidden = false; return; }
        try { localStorage.setItem("tg-fio", v); } catch (e2) {}
        w.remove(); res(v);
      };
    });
  }

  // ---------- отправка ----------
  async function send(text) {
    try {
      await fetch("https://api.telegram.org/bot" + TOKEN + "/sendMessage", { method: "POST", mode: "no-cors",
        body: new URLSearchParams({ chat_id: CHAT, text: text.slice(0, 4000) }) });
      return true;
    } catch (e) { return false; }
  }
  async function deliver(report) {
    busy = true;
    var text = report;
    if (cfg.needFio) { var fio = await askFio(); text = "ФИО: " + fio + "\n" + text; }
    text = "Тест «" + (cfg.title || document.title) + "»\n" + text + "\nОтправлено: " + stamp();
    show("Отправляем результат преподавателю…");
    var ok = await send(text);
    if (ok) show("Результат отправлен преподавателю.", false, null);
    else show("Автоматически отправить не удалось. Нажмите кнопку и выберите чат преподавателя.", true, text);
    busy = false;
  }

  // ---------- слежение за экраном результата ----------
  setInterval(function () {
    if (busy || typeof cfg.getReport !== "function") return;
    var r = null; try { r = cfg.getReport(); } catch (e) { r = null; }
    r = r && String(r).trim();
    if (!r) { visible = false; firstCheck = false; return; }
    if (visible) { firstCheck = false; return; }
    visible = true;
    var h = hash(r);
    var reloadOfOld = firstCheck && sentSet().indexOf(h) >= 0;   // страница перезагружена с уже отправленным результатом
    firstCheck = false;
    if (reloadOfOld) return;
    remember(h);
    deliver(r);
  }, 700);
})();
