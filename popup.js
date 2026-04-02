// TRC Auto Sender — Popup Script

const toggle      = document.getElementById("toggle")
const statusPanel = document.getElementById("statusPanel")
const statusDot   = document.getElementById("statusDot")
const statusText  = document.getElementById("statusText")
const statusDesc  = document.getElementById("statusDesc")
const batchEl     = document.getElementById("batchCount")
const sessionEl   = document.getElementById("sessionTime")
const logPanel    = document.getElementById("logPanel")
const hbDot       = document.getElementById("hbDot")
const hbText      = document.getElementById("hbText")

let sessionInterval = null
let sessionStart    = null

// ─── LOG ─────────────────────────────────────────────────────────────────────

function addLog(msg, type = "info") {
  const ts   = new Date().toTimeString().slice(0, 8)
  const line = document.createElement("div")
  line.className = `log-line ${type}`
  line.innerHTML = `<span class="ts">${ts}</span><span class="msg">${msg}</span>`
  logPanel.appendChild(line)
  logPanel.scrollTop = logPanel.scrollHeight
  while (logPanel.children.length > 40) {
    logPanel.removeChild(logPanel.firstChild)
  }
}

// ─── SESSION TIMER ───────────────────────────────────────────────────────────

function updateSessionTime() {
  if (!sessionStart) return
  const elapsed = Math.floor((Date.now() - sessionStart) / 1000)
  const m = String(Math.floor(elapsed / 60)).padStart(2, "0")
  const s = String(elapsed % 60).padStart(2, "0")
  sessionEl.innerHTML = `${m}<span class="stat-unit">:${s}</span>`
}

// ─── UI STATE ────────────────────────────────────────────────────────────────

function setUIState(isOn) {
  toggle.checked = isOn

  if (isOn) {
    statusPanel.classList.add("active")
    statusDot.classList.add("on")
    statusText.textContent = "RUNNING"
    statusText.parentElement.classList.add("on")
    statusDesc.textContent = "Automation engine is active..."
    hbDot.classList.add("active")
    hbText.textContent = "ACTIVE"
    if (!sessionInterval) {
      sessionStart = sessionStart || Date.now()
      sessionInterval = setInterval(updateSessionTime, 1000)
      updateSessionTime()
    }
  } else {
    statusPanel.classList.remove("active")
    statusDot.classList.remove("on")
    statusText.textContent = "OFFLINE"
    statusText.parentElement.classList.remove("on")
    statusDesc.textContent = "Enable the toggle to start automation"
    hbDot.classList.remove("active")
    hbText.textContent = "IDLE"
    if (sessionInterval) {
      clearInterval(sessionInterval)
      sessionInterval = null
    }
  }
}

function updateBatch(count) {
  batchEl.innerHTML = `${count}<span class="stat-unit">×</span>`
}

// ─── INIT — restore state from storage on popup open ─────────────────────────

browser.storage.local.get(["running", "batchCounter", "sessionStart"]).then((data) => {
  const isRunning = data.running === true
  const batch     = data.batchCounter || 0

  sessionStart = data.sessionStart || null
  updateBatch(batch)
  setUIState(isRunning)

  if (isRunning) {
    addLog("Automation is currently running.", "success")
  } else {
    addLog("System ready. Awaiting command.", "info")
  }
}).catch((err) => {
  addLog("Failed to read stored state.", "error")
  console.error("[TRC Popup] Storage read error:", err)
})

// ─── TOGGLE ──────────────────────────────────────────────────────────────────

toggle.addEventListener("change", async () => {
  const isOn = toggle.checked

  let tabs
  try {
    tabs = await browser.tabs.query({ active: true, currentWindow: true })
  } catch (err) {
    addLog("Could not access the active tab.", "error")
    return
  }

  if (!tabs || tabs.length === 0) {
    addLog("No active tab found.", "error")
    return
  }

  if (isOn) {
    sessionStart = Date.now()
    await browser.storage.local.set({ running: true, batchCounter: 0, sessionStart })
    updateBatch(0)
    setUIState(true)
    addLog("Automation started.", "success")
    browser.tabs.sendMessage(tabs[0].id, { action: "start" }).catch(() => {
      addLog("Could not reach content script. Reload the page and try again.", "error")
    })
  } else {
    sessionStart = null
    await browser.storage.local.set({ running: false, sessionStart: null })
    setUIState(false)
    addLog("Automation stopped by user.", "warn")
    browser.tabs.sendMessage(tabs[0].id, { action: "stop" }).catch(() => {})
  }
})

// ─── MESSAGES FROM CONTENT SCRIPT ────────────────────────────────────────────

browser.runtime.onMessage.addListener((msg) => {
  if (msg.action === "batchUpdate") {
    const count = msg.count || 0
    updateBatch(count)
    browser.storage.local.set({ batchCounter: count })
    addLog(`Batch #${count} submitted successfully.`, "success")
  }

  if (msg.action === "automationDone") {
    const total = msg.totalBatches || 0
    browser.storage.local.set({ running: false, sessionStart: null, batchCounter: 0 })
    sessionStart = null
    setUIState(false)
    addLog(`All orders processed. Total batches sent: ${total}.`, "success")
    updateBatch(0)
  }

  if (msg.action === "logError") {
    addLog(msg.message || "An unknown error occurred.", "error")
  }
})
