// TRC Auto Sender — Content Script
// Runs in the context of the active tab page

let running = false
let batchCounter = 0

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitUntilUnchecked() {
  // Wait until all checkboxes are unchecked (page loaded next batch)
  let attempts = 0
  const maxAttempts = 60 // 30 second timeout
  while (attempts < maxAttempts) {
    const checked = document.querySelectorAll('.el-checkbox__original:checked')
    if (checked.length === 0) break
    await sleep(500)
    attempts++
  }
}

function sendToPopup(message) {
  // Safe send — popup may not be open, so we suppress the error
  browser.runtime.sendMessage(message).catch(() => {})
}

async function startAutomation() {
  running = true
  batchCounter = 0

  browser.storage.local.set({ running: true, batchCounter: 0 })
  console.log("[TRC] Automation started.")

  while (running) {
    const checkboxes = document.querySelectorAll('.el-checkbox__original')

    if (checkboxes.length === 0) {
      console.log("[TRC] No orders remaining. Automation complete.")
      break
    }

    console.log(`[TRC] Found ${checkboxes.length/2-1} order(s). Selecting all...`)

    // Select all unchecked checkboxes
    checkboxes.forEach(cb => {
      if (!cb.checked) cb.click()
    })

    await sleep(500)

    const submitBtn = document.querySelector('.save-btn')

    if (!submitBtn) {
      console.warn("[TRC] Submit button not found. Stopping automation.")
      sendToPopup({ action: "logError", message: "Submit button not found. Automation stopped." })
      break
    }

    batchCounter++
    console.log(`[TRC] Submitting batch #${batchCounter}...`)
    submitBtn.click()

    // Notify popup of batch progress
    sendToPopup({ action: "batchUpdate", count: batchCounter })
    browser.storage.local.set({ batchCounter })

    // Wait for the page to clear checkboxes before next cycle
    await waitUntilUnchecked()
    await sleep(300)
  }

  console.log("[TRC] Automation finished.")
  running = false

  // Persist final state
  browser.storage.local.set({ running: false })

  // Notify popup that automation has completed
  sendToPopup({ action: "automationDone", totalBatches: batchCounter })
}

// Listen for messages from the popup
browser.runtime.onMessage.addListener((msg) => {
  if (msg.action === "start") {
    if (!running) {
      startAutomation()
    } else {
      console.log("[TRC] Automation is already running.")
    }
  }

  if (msg.action === "stop") {
    running = false
    console.log("[TRC] Automation stopped by user.")
    browser.storage.local.set({ running: false })
  }
})

console.log("[TRC Auto Sender] Content script loaded.")
