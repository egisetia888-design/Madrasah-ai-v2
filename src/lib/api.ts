import { auth } from './firebase';

export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const user = auth?.currentUser;
  let headers: HeadersInit = { ...options.headers };
  if (user) {
    try {
      const token = await user.getIdToken();
      headers = {
        ...headers,
        'Authorization': `Bearer ${token}`,
      };
    } catch (err) {
      console.warn('Gagal mengambil token pengguna:', err);
    }
  }
  return fetch(url, { ...options, headers });
}
