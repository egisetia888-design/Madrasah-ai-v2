import { auth } from './firebase';

export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }
  const token = await user.getIdToken();
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`,
  };
  return fetch(url, { ...options, headers });
}
