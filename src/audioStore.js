const DATABASE = 'sixty-second-studio'
const STORE = 'projects'
const PROJECT_KEY = 'current-project'

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function loadProject() {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE).objectStore(STORE).get(PROJECT_KEY)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveProject(project) {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readwrite')
    transaction.objectStore(STORE).put(project, PROJECT_KEY)
    transaction.oncomplete = resolve
    transaction.onerror = () => reject(transaction.error)
  })
}
