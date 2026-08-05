import axios from 'axios'

export const TOKEN_KEY = 'rrbs.token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

/**
 * Where the API lives.
 *
 * Default `/api` is a same-origin relative path, which covers both development
 * (Vite proxies /api to :4000) and a single-service deployment (Express serves
 * this bundle itself). A split deployment — frontend on Vercel/Netlify, backend
 * on Render/Railway — has no same-origin API, so it sets VITE_API_BASE_URL to
 * the backend's absolute origin at build time. See docs/DEPLOY.md.
 *
 * Vite inlines this at build time, so it is baked into the bundle: changing it
 * means rebuilding, not restarting.
 */
const baseURL = import.meta.env.VITE_API_BASE_URL || '/api'

const client = axios.create({ baseURL })

// Attach the bearer token to every outgoing request.
client.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// A 401 means the token is missing, invalid or expired — drop it and send the
// user to /login. 403 is left alone so RoleGate/ProtectedRoute can show /403.
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      setToken(null)
      if (!window.location.pathname.startsWith('/login')) {
        window.location.assign('/login?expired=1')
      }
    }
    return Promise.reject(error)
  }
)

/** Pulls the message out of the { data, error, meta } envelope. */
export function errorMessage(error, fallback = 'Something went wrong.') {
  return error?.response?.data?.error?.message ?? fallback
}

/** Pulls per-field validation details out of the envelope, if present. */
export function errorDetails(error) {
  return error?.response?.data?.error?.details ?? null
}

export default client
