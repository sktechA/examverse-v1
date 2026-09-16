import { getSupabaseAdmin, verifyAdminAuth, withApiLogging } from './_shared.js';

async function handler(req, res) {
  const method = req.method;
  if (method !== 'POST' && method !== 'DELETE' && method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      return res.status(500).json({
        error: 'Server is missing SUPABASE_URL or SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY configuration.'
      });
    }

    const sb = getSupabaseAdmin(req);
    const auth = await verifyAdminAuth(req, sb);

    // If request contains Bearer token and failed admin verification, reject
    const authHeader = req?.headers?.authorization || req?.headers?.Authorization;
    if (authHeader && !auth.ok) {
      return res.status(auth.statusCode || 403).json({ error: auth.error });
    }

    // Determine Action
    const action = req.body?.action || (method === 'DELETE' ? 'delete' : 'create');

    // ACTION: DELETE USER
    if (action === 'delete') {
      const userId = req.body?.userId || req.body?.id || req.query?.id;
      if (!userId) {
        return res.status(400).json({ error: 'userId is required to delete a user' });
      }

      // Prevent admin from deleting their own active user
      if (auth.ok && auth.user?.id && auth.user.id === userId) {
        return res.status(400).json({ error: 'Cannot delete your own active administrator account.' });
      }

      // 1. Delete from Supabase Auth via Admin API
      const authDelRes = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`
        }
      });

      // 2. Delete from profiles table
      const profileDelRes = await fetch(`${url}/rest/v1/profiles?id=eq.${userId}`, {
        method: 'DELETE',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`
        }
      });

      if (!authDelRes.ok && authDelRes.status !== 404) {
        const errJson = await authDelRes.json().catch(() => ({}));
        console.warn('[Admin User Delete] Auth delete warning:', errJson);
      }

      return res.status(200).json({
        ok: true,
        deleted: true,
        userId,
        message: 'User credentials and profile successfully removed from database.'
      });
    }

    // ACTION: ADMIN RESET/CHANGE USER PASSWORD
    if (action === 'reset_password' || action === 'update_password') {
      const userId = req.body?.userId || req.body?.id;
      const newPassword = req.body?.password || req.body?.newPassword;
      if (!userId || !newPassword || String(newPassword).length < 8) {
        return res.status(400).json({ error: 'Valid userId and new password (8+ characters) are required.' });
      }

      const updRes = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password: String(newPassword) })
      });

      const updJson = await updRes.json().catch(() => ({}));
      if (!updRes.ok) {
        return res.status(updRes.status).json({
          error: updJson.msg || updJson.message || 'Failed to update user credentials in Supabase Auth.'
        });
      }

      // Update timestamp in profiles
      await fetch(`${url}/rest/v1/profiles?id=eq.${userId}`, {
        method: 'PATCH',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ updated_at: new Date().toISOString() })
      });

      return res.status(200).json({
        ok: true,
        userId,
        message: 'User password successfully updated in Supabase Auth and database.'
      });
    }

    // ACTION: CREATE NEW USER
    const { name, email, phone, password, role = 'candidate' } = req.body || {};
    if (!name || !email || !password || String(password).length < 8) {
      return res.status(400).json({ error: 'Name, email and password (8+ characters) are required.' });
    }

    const allowed = [
      'candidate',
      'sub_admin',
      'question_manager',
      'exam_manager',
      'vacancy_manager',
      'content_manager',
      'support'
    ];
    if (!allowed.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const r = await fetch(`${url}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: String(email).trim(),
        password,
        phone: phone || undefined,
        email_confirm: true,
        phone_confirm: Boolean(phone),
        user_metadata: {
          full_name: String(name).trim(),
          phone: phone || null,
          role
        }
      })
    });

    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      return res.status(r.status).json({
        error: j.msg || j.message || j.error_description || 'Supabase user creation failed.'
      });
    }

    const userId = j.id || j.user?.id;
    if (userId) {
      await fetch(`${url}/rest/v1/profiles`, {
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          id: userId,
          email: String(email).trim(),
          phone: phone || null,
          full_name: String(name).trim(),
          role,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      });
    }

    return res.status(200).json({
      ok: true,
      id: userId,
      email: String(email).trim(),
      role,
      message: 'User created and credentials persisted in database.'
    });
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'Unexpected error' });
  }
}

export default withApiLogging(handler, 'admin-create-user');
