// True when running inside an Electron shell (packaged `file://` load or
// dev-server load with the preload bridge). Cloud/web deployments load the
// same bundle without the Electron bridge, so they fall through to false.
export const isElectron = Boolean(window.electronAPI) || window.location.protocol === "file:"
