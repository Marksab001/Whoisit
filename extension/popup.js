const status = document.getElementById("status");

async function findInstagramTab() {
  const tabs = await chrome.tabs.query({ url: ["https://www.instagram.com/*"] });
  return tabs.find(tab => tab.id != null && !String(tab.url || "").includes("/accounts/login")) || tabs.find(tab => tab.id != null);
}

async function checkConnection() {
  try {
    const tab = await findInstagramTab();
    if (!tab?.id) throw new Error("Instagram tab not found");
    const response = await chrome.tabs.sendMessage(tab.id, { type: "GET_SESSION_INFO" });
    if (!response?.connected) throw new Error("Instagram sign-in required");
    status.dataset.state = "online";
    status.querySelector("strong").textContent = "Instagram connected";
    status.querySelector("small").textContent = response.username ? `Signed in as @${response.username}` : "Session detected";
  } catch (error) {
    status.dataset.state = "offline";
    status.querySelector("strong").textContent = "Instagram not connected";
    status.querySelector("small").textContent = error.message || "Open Instagram and sign in";
  }
}

document.getElementById("dashboard").addEventListener("click", () => chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") }));
document.getElementById("instagram").addEventListener("click", () => chrome.tabs.create({ url: "https://www.instagram.com/" }));
checkConnection();
