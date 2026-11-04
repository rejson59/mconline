/* Wspólne konto dla projektów pod tym samym originem. Bez przekazywania tokenów w URL. */
(function (window, document) {
  "use strict";
  if (window.RejsonAccount) return;
  // Nie udajemy wspólnej sesji, gdy skrypt jest osadzony na innej domenie.
  var script = document.currentScript;
  if (script && script.src) {
    try { if (new window.URL(script.src, location.href).origin !== location.origin) return; }
    catch (e) { return; }
  }
  var SESSION = "rejson_community_session_v1";
  var RETURN = "rejson_account_return_v1";
  var URL = "https://hzbqzfimtroixnldzjeq.supabase.co/rest/v1/rpc/community_whoami";
  // Klucz publiczny anon; bez sekretów i bez nowej bazy kont.
  var KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6YnF6ZmltdHJvaXhubGR6amVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1OTYzOTEsImV4cCI6MjEwODE3MjM5MX0.oeZWOaNd6p3wZBZQQu3QWjRHlrkxV_BFQRNSN-6YntE";
  function stored() {
    try {
      var item = JSON.parse(localStorage.getItem(SESSION) || "null");
      return item && typeof item.token === "string" && item.token.length >= 16 ? item : null;
    } catch (e) { return null; }
  }
  function getSession() {
    var session = stored();
    if (!session) return Promise.resolve(null);
    return fetch(URL, { method:"POST", cache:"no-store", headers:{ apikey:KEY, Authorization:"Bearer " + KEY, "Content-Type":"application/json" }, body:JSON.stringify({p_token:session.token}) })
      .then(function (r) { if (!r.ok) throw new Error("Nie można potwierdzić konta."); return r.json(); })
      .then(function (r) {
        var current = stored();
        if (!current || current.token !== session.token) return null;
        if (!r || !Object.prototype.hasOwnProperty.call(r, "username")) throw new Error("Nieprawidłowa odpowiedź konta.");
        if (r.username === null) return null;
        if (typeof r.username !== "string" || !r.username) throw new Error("Nieprawidłowa odpowiedź konta.");
        return { username:r.username, token:session.token };
      });
  }
  function open() {
    // Link używa tylko lokalnej ścieżki; parametry projektu nie trafiają do URL logowania.
    try {
      var current = location.pathname + location.search + location.hash;
      sessionStorage.removeItem(RETURN);
      if (current.length <= 4096) sessionStorage.setItem(RETURN, JSON.stringify({path:current, at:Date.now()}));
    } catch (e) { /* Konto nadal można otworzyć bez automatycznego powrotu. */ }
    location.assign("/logowanie?powrot=1");
  }
  function subscribe(fn) {
    if (typeof fn !== "function") throw new TypeError("Wymagana funkcja");
    function storage(ev) { if (!ev || ev.key === SESSION || ev.key === null) fn(); }
    function local() { fn(); }
    window.addEventListener("storage", storage);
    window.addEventListener("rj:session-change", local);
    return function () { window.removeEventListener("storage", storage); window.removeEventListener("rj:session-change", local); };
  }
  window.RejsonAccount = Object.freeze({getSession:getSession, open:open, subscribe:subscribe});
  window.dispatchEvent(new Event("rj:account-ready"));
})(window, document);
