const ORIGIN = "https://rejson59.github.io";
const ENDPOINT =
  "https://bewwejewgqzctnjrbclu.supabase.co/functions/v1/mconline-reference-storage";
const status = document.getElementById("status");
const result = document.getElementById("result");
const login = document.getElementById("login");
const refresh = document.getElementById("refresh");
const probe = document.getElementById("probe");
const read = document.getElementById("read");
let provider,
  epoch = 0,
  owner = false,
  busy = false;
function buttons() {
  login.disabled = !provider || busy;
  refresh.disabled = busy;
  probe.disabled = read.disabled = !owner || busy;
}
async function request(op) {
  // Fresh provider session for EVERY call. No token in URL, DOM, logs or a new store.
  const session = await provider.getSession();
  if (typeof session?.token !== "string" || !session.token)
    throw new Error("Zaloguj się przez konto strony.");
  const response = await fetch(ENDPOINT, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ op, token: session.token }),
    signal: AbortSignal.timeout(45000),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      typeof data.error === "string"
        ? data.error
        : "Serwer nie potwierdził testu.",
    );
  return data;
}
async function check() {
  const own = ++epoch;
  owner = false;
  busy = true;
  result.textContent = "";
  buttons();
  status.textContent = "Sprawdzanie konta na serwerze…";
  try {
    const data = await request("status");
    if (own !== epoch) return;
    owner = data.owner === "rejson59" && data.mode === "probe-only";
    status.textContent = owner
      ? "Potwierdzone konto właściciela: rejson59. To dostęp wyłącznie do testu magazynu."
      : "Serwer nie potwierdził dostępu właściciela.";
  } catch (error) {
    if (own === epoch)
      status.textContent =
        error instanceof Error
          ? error.message
          : "Nie udało się potwierdzić konta.";
  } finally {
    if (own === epoch) {
      busy = false;
      buttons();
    }
  }
}
async function run(op) {
  if (!owner || busy) return;
  const own = epoch;
  busy = true;
  buttons();
  result.textContent = "Test trwa. Poczekaj na potwierdzenie…";
  try {
    const data = await request(op);
    if (own !== epoch) return;
    if (
      data.mode !== "server-roundtrip-only" ||
      data.privateReadVerified !== true ||
      data.publicReadBlocked !== true ||
      !/^[a-f0-9]{64}$/.test(data.sha256)
    )
      throw new Error("Niepełne potwierdzenie testu.");
    result.textContent = `TEST BACKENDU OK\nPrywatny odczyt: potwierdzony\nPubliczny odczyt: zablokowany\nRozmiar: ${data.bytes} bajtów\nSHA-256: ${data.sha256}\n${data.created ? "Utworzono mały plik testowy." : "Istniejący plik jest identyczny; nie nadpisano go."}\n\nOryginały Minecrafta: nieprzesłane.\nDostęp środowiska analizy: jeszcze niepotwierdzony.`;
  } catch (error) {
    if (own === epoch)
      result.textContent =
        error instanceof Error
          ? error.message
          : "Nie udało się potwierdzić testu.";
  } finally {
    if (own === epoch) {
      busy = false;
      buttons();
    }
  }
}
refresh.addEventListener("click", () => {
  if (provider) check();
});
probe.addEventListener("click", () => run("probe"));
read.addEventListener("click", () => run("read"));
login.addEventListener("click", async () => {
  if (!provider || busy) return;
  try {
    await provider.open();
  } catch {
    status.textContent =
      "Nie udało się otworzyć strony konta. Spróbuj ponownie.";
  }
});
async function start() {
  if (location.origin !== ORIGIN) {
    status.textContent =
      "Logowanie i test są dostępne wyłącznie na https://rejson59.github.io/mconline/testy/. Otwórz wersję produkcyjną.";
    refresh.disabled = true;
    return;
  }
  try {
    if (!window.RejsonAccount)
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "/js/rejson-account.js?v=1";
        script.defer = true;
        const timer = setTimeout(
          () =>
            reject(
              new Error(
                "Nie udało się załadować obsługi konta. Odśwież stronę.",
              ),
            ),
          12000,
        );
        script.onload = () => {
          clearTimeout(timer);
          resolve();
        };
        script.onerror = () => {
          clearTimeout(timer);
          reject(new Error("Nie udało się pobrać obsługi konta."));
        };
        document.head.append(script);
      });
    provider = window.RejsonAccount;
    if (!provider?.getSession || !provider?.open)
      throw new Error("Obsługa konta jest niedostępna.");
    provider.subscribe?.(() => check());
    window.addEventListener("pageshow", () => check());
    window.addEventListener("storage", (event) => {
      if (event.key === null || event.key === "rejson_community_session_v1")
        check();
    });
    await check();
  } catch (error) {
    status.textContent =
      error instanceof Error ? error.message : "Błąd obsługi konta.";
    buttons();
  }
}
start();
